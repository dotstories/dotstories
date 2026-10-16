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
