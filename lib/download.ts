import { REPO } from "./community";

export type OS = "windows" | "mac" | "phone" | "other";

const LATEST = `${REPO}/releases/latest`;

/** Stable names, published by .github/workflows/release.yml. */
export const DOWNLOADS = {
  windows: `${LATEST}/download/DotStories-Windows.exe`,
  mac: `${LATEST}/download/DotStories-Mac.dmg`,
};

/** Is a release published? (GitHub API, no login needed.) */
export const RELEASE_API = "https://api.github.com/repos/Dayonel/dotstories/releases/latest";

export function detectOS(userAgent: string): OS {
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(userAgent)) return "phone";
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "mac";
  return "other";
}

let checked: Promise<boolean> | null = null;

/** Is a release published? Asked once per page load. Only a 404 means "not yet". */
export const releaseExists = () =>
  (checked ??= fetch(RELEASE_API).then(
    (r) => r.status !== 404, // rate-limited or GitHub down: offer the links anyway
    () => true,
  ));

export const resetReleaseCheck = () => (checked = null); // tests

/** Start downloading the installer for this computer. The page stays open: it's a file, not a page. */
export function downloadInstaller(os: "windows" | "mac") {
  const a = document.createElement("a");
  a.href = DOWNLOADS[os];
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
}

/** The installer for this browser's computer, if there is one and it's released. */
export async function installerFor(userAgent: string): Promise<"windows" | "mac" | null> {
  const os = detectOS(userAgent);
  if (os !== "windows" && os !== "mac") return null;
  return (await releaseExists()) ? os : null;
}
