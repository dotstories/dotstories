//! Starts the Python engine (runner/engine) with the bundled `uv`.
//! uv installs Python and the AI libraries on first run, into the app's data folder.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

pub const SITE: &str = "https://dotstories.com";

/// The data folder moved (Roaming → Local on Windows: it holds GBs, Roaming is for small settings
/// that sync). Move an existing one over once: instant on the same drive, nothing downloads again.
/// Returns true if it moved.
pub fn move_data(old: &Path, new: &Path) -> io::Result<bool> {
    if old == new || !old.is_dir() || new.exists() {
        return Ok(false);
    }
    if let Some(parent) = new.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(old, new)?;
    Ok(true)
}

/// Where things live.
pub struct Paths {
    /// App data folder: Python, libraries, models, outputs. Writable.
    pub data: PathBuf,
    /// Bundled resources (read-only): the engine source.
    pub resources: PathBuf,
    /// Folder of the app binary: the bundled `uv` sits next to it.
    pub exe_dir: PathBuf,
}

impl Paths {
    pub fn engine_src(&self) -> PathBuf {
        self.resources.join("engine")
    }
    pub fn engine(&self) -> PathBuf {
        self.data.join("engine")
    }
    pub fn uv(&self) -> PathBuf {
        self.exe_dir.join(if cfg!(windows) { "uv.exe" } else { "uv" })
    }
    pub fn log(&self) -> PathBuf {
        self.data.join("engine.log")
    }
}

/// Copy the engine out of the (read-only) app bundle once per app version.
pub fn prepare(p: &Paths, version: &str) -> io::Result<bool> {
    let marker = p.engine().join(".app-version");
    if fs::read_to_string(&marker).ok().as_deref() == Some(version) {
        return Ok(false);
    }
    if p.engine().exists() {
        fs::remove_dir_all(p.engine())?;
    }
    copy_dir(&p.engine_src(), &p.engine())?;
    fs::write(marker, version)?;
    Ok(true)
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// Step 1, first start: `uv sync` installs Python and the AI libraries. Its output is the live setup log.
pub fn sync_command(p: &Paths) -> Command {
    let mut cmd = uv(p);
    cmd.args(["sync", "--frozen", "--extra", "ml", "--python", "3.12"]);
    cmd
}

/// Step 2: `uv run ... dotstories-engine serve`, with everything kept inside the app data folder.
pub fn command(p: &Paths, parent_pid: u32) -> Command {
    let mut cmd = uv(p);
    cmd.args(["run", "--frozen", "--extra", "ml", "--python", "3.12", "dotstories-engine", "serve"])
        .env("DOTSTORIES_PARENT_PID", parent_pid.to_string());
    cmd
}

fn uv(p: &Paths) -> Command {
    let mut cmd = Command::new(p.uv());
    cmd.current_dir(p.engine())
        .env("UV_PYTHON_PREFERENCE", "only-managed") // never touch the user's own Python
        .env("UV_PYTHON_INSTALL_DIR", p.data.join("python"))
        .env("UV_CACHE_DIR", p.data.join("uv-cache"))
        .env("UV_PROJECT_ENVIRONMENT", p.data.join("venv"))
        .env("DOTSTORIES_HOME", p.data.join("home"))
        .env("PYTHONUNBUFFERED", "1")
        .env("NO_COLOR", "1"); // plain lines for the log
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: no black console box
    }
    cmd
}

#[derive(Debug, Clone, PartialEq)]
pub enum Status {
    Starting,
    Installing,
    Ready { device: String },
    Error(String),
    Stopped,
}

impl Status {
    /// Short text for the tray menu.
    pub fn label(&self) -> String {
        match self {
            Status::Starting => "Starting…".into(),
            Status::Installing => "Setting up: downloading Python + AI libraries (first time only)…".into(),
            Status::Ready { device } => format!("Ready on {device}"),
            Status::Error(e) => format!("Error: {}", e.chars().take(80).collect::<String>()),
            Status::Stopped => "Stopped. Restart the app.".into(),
        }
    }
}

/// The engine prints one JSON object per line (see runner/engine cli.py).
pub fn parse_line(line: &str) -> Option<Status> {
    let v: serde_json::Value = serde_json::from_str(line.trim()).ok()?;
    match v.get("event")?.as_str()? {
        "serving" => Some(Status::Ready {
            device: v.get("device").and_then(|d| d.as_str()).unwrap_or("this computer").to_string(),
        }),
        "error" => Some(Status::Error(v.get("message")?.as_str()?.to_string())),
        _ => None,
    }
}

/// Open a URL in the user's browser.
pub fn open_url(url: &str) {
    #[cfg(windows)]
    let _ = Command::new("cmd").args(["/C", "start", "", url]).spawn();
    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = Command::new("xdg-open").arg(url).spawn();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("dotstories-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn paths(root: &Path) -> Paths {
        Paths { data: root.join("data"), resources: root.join("res"), exe_dir: root.join("bin") }
    }

    #[test]
    fn parses_serving_line() {
        let s = parse_line(r#"{"event": "serving", "url": "http://127.0.0.1:47761", "device": "RTX 4080"}"#);
        assert_eq!(s, Some(Status::Ready { device: "RTX 4080".into() }));
        assert_eq!(s.unwrap().label(), "Ready on RTX 4080");
    }

    #[test]
    fn parses_error_line_and_ignores_the_rest() {
        assert_eq!(
            parse_line(r#"{"event": "error", "message": "CUDA out of memory"}"#),
            Some(Status::Error("CUDA out of memory".into()))
        );
        assert_eq!(parse_line(r#"{"event": "progress", "step": 1}"#), None);
        assert_eq!(parse_line("Downloading torch (2.4GiB)"), None);
        assert_eq!(parse_line(""), None);
    }

    #[test]
    fn long_errors_are_cut_for_the_menu() {
        assert!(Status::Error("x".repeat(500)).label().len() < 100);
    }

    #[test]
    fn command_keeps_everything_in_the_data_folder() {
        let root = temp("cmd");
        let p = paths(&root);
        let cmd = command(&p, 42);
        let args: Vec<_> = cmd.get_args().map(|a| a.to_string_lossy().to_string()).collect();
        assert_eq!(args.last().unwrap(), "serve");
        assert!(args.contains(&"--frozen".to_string()));
        let env = |k: &str| {
            cmd.get_envs()
                .find(|(key, _)| *key == k)
                .and_then(|(_, v)| v.map(|v| v.to_string_lossy().to_string()))
                .unwrap()
        };
        assert!(env("DOTSTORIES_HOME").starts_with(&p.data.to_string_lossy().to_string()));
        assert!(env("UV_PYTHON_INSTALL_DIR").starts_with(&p.data.to_string_lossy().to_string()));
        assert_eq!(env("UV_PYTHON_PREFERENCE"), "only-managed");
        assert_eq!(env("DOTSTORIES_PARENT_PID"), "42");
        assert_eq!(cmd.get_program(), p.uv().as_os_str());
    }

    #[test]
    fn sync_installs_into_the_data_folder_first() {
        let root = temp("sync");
        let p = paths(&root);
        let cmd = sync_command(&p);
        let args: Vec<_> = cmd.get_args().map(|a| a.to_string_lossy().to_string()).collect();
        assert_eq!(args[..2], ["sync".to_string(), "--frozen".to_string()]);
        assert!(args.contains(&"ml".to_string()));
        let env = |k: &str| cmd.get_envs().find(|(key, _)| *key == k).and_then(|(_, v)| v).map(|v| v.to_owned());
        assert!(env("UV_PROJECT_ENVIRONMENT").unwrap().to_string_lossy().starts_with(&*p.data.to_string_lossy()));
        assert_eq!(env("UV_PYTHON_PREFERENCE").unwrap(), "only-managed");
        assert!(env("DOTSTORIES_PARENT_PID").is_none());
    }

    #[test]
    fn prepare_copies_the_engine_once_per_version() {
        let root = temp("prep");
        let p = paths(&root);
        fs::create_dir_all(p.engine_src().join("src/pkg")).unwrap();
        fs::write(p.engine_src().join("pyproject.toml"), "[project]").unwrap();
        fs::write(p.engine_src().join("src/pkg/a.py"), "print(1)").unwrap();

        assert!(prepare(&p, "0.1.0").unwrap()); // first time: copied
        assert_eq!(fs::read_to_string(p.engine().join("src/pkg/a.py")).unwrap(), "print(1)");
        assert!(!prepare(&p, "0.1.0").unwrap()); // same version: skipped

        fs::write(p.engine_src().join("src/pkg/a.py"), "print(2)").unwrap();
        assert!(prepare(&p, "0.2.0").unwrap()); // new app version: fresh copy
        assert_eq!(fs::read_to_string(p.engine().join("src/pkg/a.py")).unwrap(), "print(2)");
    }

    #[test]
    fn moves_old_data_once() {
        let root = std::env::temp_dir().join(format!("ds-move-{}", std::process::id()));
        let (old, new) = (root.join("Roaming/app"), root.join("Local/app"));
        fs::create_dir_all(old.join("home/models")).unwrap();
        fs::write(old.join("home/models/part"), b"x").unwrap();

        assert!(move_data(&old, &new).unwrap());
        assert!(new.join("home/models/part").is_file());
        assert!(!old.exists());
        assert!(!move_data(&old, &new).unwrap()); // nothing left to move

        fs::create_dir_all(&old).unwrap(); // both exist: keep the new one, touch nothing
        assert!(!move_data(&old, &new).unwrap());
        assert!(old.is_dir() && new.join("home/models/part").is_file());
        assert!(!move_data(&new, &new).unwrap());
        fs::remove_dir_all(&root).unwrap();
    }
}
