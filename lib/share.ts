import { type Dot, latest, version as findVersion } from "./dot";
import { type DotState, inputsFor, toQuery } from "./dot-state";

export const SITE = "https://dotstories.com";
export const BLOG = "https://blog.dotstories.com";

export const dotPath = (dot: Dot) => `/dots/${dot.slug}`;

/** The dot page with the visitor's exact setup: open it and you see the same thing. */
export function shareUrl(dot: Dot, state: DotState) {
  const q = toQuery(dot, state);
  return `${SITE}${dotPath(dot)}${q ? `?${q}` : ""}`;
}

/** Everything needed to reproduce the result, as JSON. */
export function setupJson(dot: Dot, state: DotState) {
  const v = (state.v && findVersion(dot, state.v)) || latest(dot);
  return JSON.stringify(
    {
      dot: `${SITE}${dotPath(dot)}`,
      version: v.version,
      engine: dot.engine,
      inputs: inputsFor(dot, state),
      ...("postSteps" in v && { postSteps: v.postSteps }),
    },
    null,
    2,
  );
}

export function shareLinks(dot: Dot, url: string) {
  const text = `${dot.name} on DotStories`;
  return {
    x: `https://x.com/intent/post?${new URLSearchParams({ text, url })}`,
    reddit: `https://www.reddit.com/submit?${new URLSearchParams({ url, title: text })}`,
  };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago", "yesterday". */
export function timeAgo(date: string | Date, now = new Date()) {
  const seconds = (new Date(date).getTime() - now.getTime()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "now";
}
