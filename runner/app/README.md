# DotStories Runner app

The small app people install once. It lives in the tray (menu bar on Mac) and runs dots for dotstories.com on their own computer.

## What it does

1. On first start, copies the engine (`runner/engine`) into the app data folder.
2. Starts it with the bundled **uv**: uv downloads Python 3.12 + torch + diffusers (first time only, a few GB), then runs `dotstories-engine serve` on `127.0.0.1:47761`.
3. Tray menu: status (*Setting up…* → *Ready on RTX 4080*), **Open DotStories**, **Quit**.
4. Quit stops the engine (and the engine stops itself if the app disappears).

Everything (Python, libraries, models, outputs) stays in the app data folder. The user's own Python is never touched. uv's install log: `engine.log` in the same folder.

## Build

CI builds a Windows installer (`.exe`) and a Mac `.dmg` on every PR: see the **Runner app** workflow artifacts.

Locally (needs Rust + Node):

```bash
# put uv for your platform in src-tauri/binaries/uv-<target-triple>[.exe]
cd src-tauri && cargo test
cd .. && npx @tauri-apps/cli@2 build
```

## Release

```bash
git tag runner-v0.1.0 && git push origin runner-v0.1.0
```

Builds both installers and publishes a GitHub Release with stable names, so these links always point to the newest app:

- https://github.com/Dayonel/dotstories/releases/latest/download/DotStories-Windows.exe
- https://github.com/Dayonel/dotstories/releases/latest/download/DotStories-Mac.dmg

Bump `version` in `src-tauri/tauri.conf.json` and `Cargo.toml` first.

## Not yet

- Code signing (Apple notarization, Windows signing): unsigned builds show a warning.
- OS sandbox (layer 2): AppContainer / App Sandbox.
- Auto-start on login, auto-update.
