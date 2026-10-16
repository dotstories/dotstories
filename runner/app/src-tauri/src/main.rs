// DotStories Runner: lives in the tray, runs dots for dotstories.com on this computer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;
mod status;

use std::fs::File;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use engine::{Paths, Status, SITE};
use status::{Phase, Shared};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, RunEvent};

fn main() {
    let child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let child_on_exit = child.clone();

    tauri::Builder::default()
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory); // menu bar only, no Dock icon

            let status_item = MenuItem::with_id(app, "status", Status::Starting.label(), false, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Open DotStories", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&status_item, &open, &quit])?;

            let tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .tooltip("DotStories")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => engine::open_url(SITE),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let paths = Paths {
                data: app.path().app_data_dir()?,
                resources: app.path().resource_dir()?,
                exe_dir: std::env::current_exe()?.parent().expect("exe folder").to_path_buf(),
            };
            let version = app.package_info().version.to_string();

            // The website watches this from the first second (setup log, then "ready").
            let live = status::State::shared(&version);
            if let Err(e) = status::serve(live.clone()) {
                live.lock().unwrap().log(&format!("Status server not started: {e}"));
            }
            heartbeat(live.clone());

            let child = child.clone();
            thread::spawn(move || {
                let set = |s: Status| {
                    let _ = status_item.set_text(s.label());
                    let _ = tray.set_tooltip(Some(format!("DotStories · {}", s.label())));
                    let (phase, message) = match &s {
                        Status::Starting => (Phase::Starting, "Starting the engine…".to_string()),
                        Status::Installing => (Phase::Installing, s.label()),
                        Status::Ready { device } => (Phase::Ready, format!("Ready on {device}")),
                        Status::Error(e) => (Phase::Error, e.clone()),
                        Status::Stopped => (Phase::Stopped, s.label()),
                    };
                    let mut l = live.lock().unwrap();
                    l.set(phase, &message);
                    if phase != Phase::Installing {
                        l.log(&message);
                    }
                };
                if let Err(e) = std::fs::create_dir_all(&paths.data).and_then(|_| engine::prepare(&paths, &version)) {
                    return set(Status::Error(e.to_string()));
                }
                let log_file = Arc::new(Mutex::new(File::create(paths.log()).ok()));

                // 1. Install Python + AI libraries (only slow the first time). Every line goes to the live log.
                set(Status::Installing);
                live.lock().unwrap().log("Setting up DotStories: Python and the AI libraries (first time only, a few GB)");
                let mut sync = engine::sync_command(&paths);
                sync.stdout(Stdio::piped()).stderr(Stdio::piped());
                let ok = match sync.spawn() {
                    Ok(mut c) => {
                        let readers = [
                            pipe(c.stdout.take().map(|o| Box::new(o) as Box<dyn Read + Send>), &live, &log_file),
                            pipe(c.stderr.take().map(|e| Box::new(e) as Box<dyn Read + Send>), &live, &log_file),
                        ];
                        let status = c.wait();
                        readers.into_iter().flatten().for_each(|r| {
                            let _ = r.join();
                        });
                        status.map(|s| s.success()).unwrap_or(false)
                    }
                    Err(e) => {
                        live.lock().unwrap().log(&format!("Could not start the installer: {e}"));
                        false
                    }
                };
                if !ok {
                    return set(Status::Error(format!("Setup failed (see {})", paths.log().display())));
                }

                // 2. Start the engine. Its JSON lines say when it's ready; everything else is logged.
                set(Status::Starting);
                let mut cmd = engine::command(&paths, std::process::id());
                cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
                match cmd.spawn() {
                    Ok(mut c) => {
                        let out = c.stdout.take().expect("stdout");
                        let _ = pipe(c.stderr.take().map(|e| Box::new(e) as Box<dyn Read + Send>), &live, &log_file);
                        *child.lock().unwrap() = Some(c);
                        for line in BufReader::new(out).lines().map_while(Result::ok) {
                            match engine::parse_line(&line) {
                                Some(s) => set(s),
                                None => write_log(&log_file, &line),
                            }
                        }
                        set(Status::Stopped);
                    }
                    Err(e) => set(Status::Error(format!("{e} (see {})", paths.log().display()))),
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while starting DotStories")
        .run(move |_app, event| match event {
            // No windows: don't quit when "the last window closes"; only from the tray.
            RunEvent::ExitRequested { api, code: None, .. } => api.prevent_exit(),
            RunEvent::Exit => {
                if let Some(mut c) = child_on_exit.lock().unwrap().take() {
                    let _ = c.kill(); // the engine also stops itself when we're gone
                }
            }
            _ => {}
        });
}

/// Each line of a child's output → the live log (website) and engine.log (disk).
fn pipe(
    from: Option<Box<dyn Read + Send>>,
    live: &Shared,
    file: &Arc<Mutex<Option<File>>>,
) -> Option<thread::JoinHandle<()>> {
    let from = from?;
    let (live, file) = (live.clone(), file.clone());
    Some(thread::spawn(move || {
        for line in BufReader::new(from).lines().map_while(Result::ok) {
            live.lock().unwrap().log(&line);
            write_log(&file, &line);
        }
    }))
}

fn write_log(file: &Arc<Mutex<Option<File>>>, line: &str) {
    if let Some(f) = file.lock().unwrap().as_mut() {
        let _ = writeln!(f, "{line}");
    }
}

/// Long downloads print nothing for minutes: say "still working" so the setup never looks frozen.
fn heartbeat(live: Shared) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(5));
        let mut l = live.lock().unwrap();
        l.heartbeat(Instant::now());
        if matches!(l.phase(), Phase::Ready | Phase::Error | Phase::Stopped) {
            break;
        }
    });
}
