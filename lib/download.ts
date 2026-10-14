export type OS = "windows" | "mac" | "phone" | "other";

const LATEST = "https://github.com/Dayonel/dotstories/releases/latest";

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
