//! The app's own status server on 127.0.0.1:47760.
//! It answers from the first second, so the website can show the first-time setup live
//! (what uv downloads and installs, like build logs) before the engine itself is running.
//! Only std: tested on its own, no network crates.

use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

pub const PORT: u16 = 47760;
/// Lines kept in memory (the full log is in engine.log).
const KEEP: usize = 1000;
const MAX_LINE: usize = 400;
/// Nothing new for this long while installing → a "still working" line, so nobody thinks it froze.
pub const QUIET: Duration = Duration::from_secs(20);

/// Same list as the engine (runner/engine/src/dotstories_engine/server.py).
pub const ALLOWED_ORIGINS: &[&str] = &[
    "https://dotstories.com",
    "https://www.dotstories.com",
    "http://localhost:3000",
    "http://localhost:8787",
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Phase {
    Starting,
    Installing,
    Ready,
    Error,
    Stopped,
}

impl Phase {
    fn name(self) -> &'static str {
        match self {
            Phase::Starting => "starting",
            Phase::Installing => "installing",
            Phase::Ready => "ready",
            Phase::Error => "error",
            Phase::Stopped => "stopped",
        }
    }
}

pub struct State {
    started: Instant,
    last_line: Instant,
    phase: Phase,
    message: String,
    version: String,
    /// (number, seconds since start, text). Numbers keep growing, so the site asks "since N".
    lines: VecDeque<(u64, f64, String)>,
    total: u64,
}

pub type Shared = Arc<Mutex<State>>;

impl State {
    pub fn new(version: &str) -> Self {
        let now = Instant::now();
        State {
            started: now,
            last_line: now,
            phase: Phase::Starting,
            message: "Starting…".into(),
            version: version.into(),
            lines: VecDeque::new(),
            total: 0,
        }
    }

    pub fn shared(version: &str) -> Shared {
        Arc::new(Mutex::new(State::new(version)))
    }

    pub fn set(&mut self, phase: Phase, message: &str) {
        self.phase = phase;
        self.message = message.into();
    }

    pub fn phase(&self) -> Phase {
        self.phase
    }

    /// One line of output (uv, the engine). Colors and blank lines are dropped, long lines cut.
    pub fn log(&mut self, line: &str) {
        let clean = strip_ansi(line);
        let text = clean.trim_end();
        if text.trim().is_empty() {
            return;
        }
        let text: String = text.chars().take(MAX_LINE).collect();
        let t = self.started.elapsed().as_secs_f64();
        self.lines.push_back((self.total, t, text));
        self.total += 1;
        self.last_line = Instant::now();
        while self.lines.len() > KEEP {
            self.lines.pop_front();
        }
    }

    /// Called every few seconds: while installing and silent for a while, say we're still busy.
    pub fn heartbeat(&mut self, now: Instant) -> bool {
        if self.phase != Phase::Installing || now.duration_since(self.last_line) < QUIET {
            return false;
        }
        let secs = now.duration_since(self.started).as_secs();
        self.log(&format!("Still working: large downloads take a while ({}m {:02}s so far)", secs / 60, secs % 60));
        true
    }

    #[cfg(test)]
    fn pretend_quiet(&mut self, for_: Duration) {
        self.last_line -= for_;
    }

    /// {"phase", "message", "version", "next", "lines": [{"n", "t", "text"}]}, lines numbered `since` and up.
    pub fn json(&self, since: u64) -> String {
        let lines: Vec<String> = self
            .lines
            .iter()
            .filter(|(n, _, _)| *n >= since)
            .map(|(n, t, text)| format!(r#"{{"n":{n},"t":{t:.1},"text":{}}}"#, quote(text)))
            .collect();
        format!(
            r#"{{"phase":"{}","message":{},"version":{},"next":{},"lines":[{}]}}"#,
            self.phase.name(),
            quote(&self.message),
            quote(&self.version),
            self.total,
            lines.join(",")
        )
    }
}

/// JSON string with escapes.
fn quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Terminal color codes (ESC [ ... letter) and carriage-return progress redraws.
fn strip_ansi(s: &str) -> String {
    let last = s.rsplit('\r').find(|part| !part.trim().is_empty()).unwrap_or("");
    let mut out = String::with_capacity(last.len());
    let mut chars = last.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for c in chars.by_ref() {
                    if c.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

/// One HTTP response for a request head ("GET /status?since=3 HTTP/1.1\r\nOrigin: …\r\n\r\n").
pub fn respond(head: &str, state: &State) -> String {
    let mut lines = head.lines();
    let first = lines.next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let (method, target) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
    let origin = lines
        .map_while(|l| (!l.is_empty()).then_some(l))
        .find_map(|l| {
            let (k, v) = l.split_once(':')?;
            k.trim().eq_ignore_ascii_case("origin").then(|| v.trim().to_string())
        });
    let allowed = origin.as_deref().is_some_and(|o| ALLOWED_ORIGINS.contains(&o));

    // A browser page from another site: no access at all. No Origin (curl, the user): may read.
    if origin.is_some() && !allowed {
        return http(403, "Forbidden", &[], r#"{"error":"origin not allowed"}"#);
    }
    let mut cors = vec![("Vary", "Origin".to_string())];
    if let Some(o) = origin.filter(|_| allowed) {
        cors.push(("Access-Control-Allow-Origin", o));
    }

    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    match (method, path) {
        ("OPTIONS", _) => {
            cors.push(("Access-Control-Allow-Methods", "GET, OPTIONS".into()));
            cors.push(("Access-Control-Allow-Private-Network", "true".into()));
            http(204, "No Content", &cors, "")
        }
        ("GET", "/status") => {
            let since = query
                .split('&')
                .find_map(|kv| kv.strip_prefix("since="))
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            http(200, "OK", &cors, &state.json(since))
        }
        _ => http(404, "Not Found", &cors, r#"{"error":"not found"}"#),
    }
}

fn http(code: u16, reason: &str, headers: &[(&str, String)], body: &str) -> String {
    let mut out = format!("HTTP/1.1 {code} {reason}\r\n");
    for (k, v) in headers {
        out.push_str(&format!("{k}: {v}\r\n"));
    }
    if !body.is_empty() {
        out.push_str("Content-Type: application/json\r\n");
    }
    out.push_str(&format!(
        "Cache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    ));
    out
}

/// Listen on 127.0.0.1 only (never the network) and answer each request on its own thread.
pub fn serve(state: Shared) -> std::io::Result<()> {
    let listener = TcpListener::bind(("127.0.0.1", PORT))?;
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let state = state.clone();
            thread::spawn(move || handle(stream, &state));
        }
    });
    Ok(())
}

fn handle(mut stream: TcpStream, state: &Shared) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = Vec::new();
    let mut chunk = [0u8; 1024];
    // The head only (we never need a body); at most 16 KB.
    while !buf.windows(4).any(|w| w == b"\r\n\r\n") && buf.len() < 16 * 1024 {
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(n) => buf.extend_from_slice(&chunk[..n]),
        }
    }
    let head = String::from_utf8_lossy(&buf);
    let response = respond(&head, &state.lock().unwrap());
    let _ = stream.write_all(response.as_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(method: &str, path: &str, origin: Option<&str>) -> String {
        let o = origin.map(|o| format!("Origin: {o}\r\n")).unwrap_or_default();
        format!("{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:47760\r\n{o}\r\n")
    }

    fn body(response: &str) -> &str {
        response.split("\r\n\r\n").nth(1).unwrap()
    }

    #[test]
    fn status_lists_new_lines_since_n() {
        let mut s = State::new("0.2.0");
        s.set(Phase::Installing, "Setting up");
        s.log("Resolved 150 packages in 2ms");
        s.log("Downloading torch (2.4GiB)");
        let all = respond(&req("GET", "/status", Some("https://dotstories.com")), &s);
        assert!(all.starts_with("HTTP/1.1 200 OK"));
        assert!(all.contains("Access-Control-Allow-Origin: https://dotstories.com"));
        let b = body(&all);
        assert!(b.starts_with(r#"{"phase":"installing","message":"Setting up","version":"0.2.0","next":2,"lines":[{"n":0,"#));
        assert!(b.contains(r#""text":"Downloading torch (2.4GiB)"}"#));

        let newer = respond(&req("GET", "/status?since=1", Some("https://dotstories.com")), &s);
        assert!(!body(&newer).contains("Resolved"));
        assert!(body(&newer).contains("Downloading torch"));
    }

    #[test]
    fn other_sites_are_refused_and_curl_may_read() {
        let s = State::new("0.2.0");
        assert!(respond(&req("GET", "/status", Some("https://evil.example")), &s).starts_with("HTTP/1.1 403"));
        let curl = respond(&req("GET", "/status", None), &s);
        assert!(curl.starts_with("HTTP/1.1 200"));
        assert!(!curl.contains("Access-Control-Allow-Origin"));
    }

    #[test]
    fn preflight_allows_the_site_and_private_network() {
        let s = State::new("0.2.0");
        let r = respond(&req("OPTIONS", "/status", Some("http://localhost:8787")), &s);
        assert!(r.starts_with("HTTP/1.1 204"));
        assert!(r.contains("Access-Control-Allow-Private-Network: true"));
        assert!(r.contains("Access-Control-Allow-Origin: http://localhost:8787"));
        assert!(respond(&req("GET", "/nope", None), &s).starts_with("HTTP/1.1 404"));
    }

    #[test]
    fn lines_are_cleaned_numbered_and_capped() {
        let mut s = State::new("0.2.0");
        s.log("\u{1b}[32mInstalled\u{1b}[0m 3 packages \"ok\"\t\\");
        s.log("   ");
        s.log("50%\r100% done\r");
        s.log(&"x".repeat(1000));
        let j = s.json(0);
        assert!(j.contains(r#""text":"Installed 3 packages \"ok\"\t\\"}"#), "{j}");
        assert!(j.contains(r#""text":"100% done"}"#), "{j}");
        assert!(j.contains(&format!(r#""text":"{}"}}"#, "x".repeat(MAX_LINE))));
        assert!(j.contains(r#""next":3"#));

        for i in 0..KEEP + 50 {
            s.log(&format!("line {i}"));
        }
        assert_eq!(s.lines.len(), KEEP);
        assert_eq!(s.lines.front().unwrap().0, 3 + 50); // oldest dropped, numbers kept
    }

    #[test]
    fn heartbeat_only_while_installing_and_quiet() {
        let mut s = State::new("0.2.0");
        s.set(Phase::Installing, "Setting up");
        s.log("Downloading torch (2.4GiB)");
        assert!(!s.heartbeat(Instant::now())); // just logged
        s.pretend_quiet(QUIET + Duration::from_secs(1));
        assert!(s.heartbeat(Instant::now()));
        assert!(s.json(0).contains("Still working"));
        s.set(Phase::Ready, "Ready");
        s.pretend_quiet(QUIET + Duration::from_secs(1));
        assert!(!s.heartbeat(Instant::now()));
    }

    #[test]
    fn serves_on_a_real_socket() {
        // The real port may be taken by a running app: test the same handler on a free port.
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let state = State::shared("0.2.0");
        state.lock().unwrap().log("hello");
        let st = state.clone();
        thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            handle(stream, &st);
        });
        let mut c = TcpStream::connect(("127.0.0.1", port)).unwrap();
        c.write_all(req("GET", "/status", Some("https://dotstories.com")).as_bytes()).unwrap();
        let mut out = String::new();
        c.read_to_string(&mut out).unwrap();
        assert!(out.contains(r#""text":"hello""#), "{out}");
    }
}
