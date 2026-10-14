// DotStories Runner: lives in the tray, runs dots for dotstories.com on this computer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;

use std::fs::File;
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use engine::{Paths, Status, SITE};
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

            let status = MenuItem::with_id(app, "status", Status::Starting.label(), false, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "Open DotStories", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&status, &open, &quit])?;

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
            let child = child.clone();

            thread::spawn(move || {
                let set = |s: Status| {
                    let _ = status.set_text(s.label());
                    let _ = tray.set_tooltip(Some(format!("DotStories · {}", s.label())));
                };
                if let Err(e) = std::fs::create_dir_all(&paths.data).and_then(|_| engine::prepare(&paths, &version)) {
                    return set(Status::Error(e.to_string()));
                }
                set(Status::Installing);

                let log = File::create(paths.log()).ok();
                let mut cmd = engine::command(&paths, std::process::id());
                cmd.stdout(Stdio::piped())
                    .stderr(log.map(Stdio::from).unwrap_or_else(Stdio::null)); // uv progress → engine.log

                match cmd.spawn() {
                    Ok(mut c) => {
                        let out = c.stdout.take().expect("stdout");
                        *child.lock().unwrap() = Some(c);
                        for line in BufReader::new(out).lines().map_while(Result::ok) {
                            if let Some(s) = engine::parse_line(&line) {
                                set(s);
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
