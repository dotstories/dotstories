/** Accepted model terms in this browser (logged out). Logged in, D1 keeps them: actions/model-terms.ts. */
const KEY = "dotstories:model-terms";

export function loadAccepted(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return []; // storage blocked (private window) or broken: ask again
  }
}

export function saveAccepted(key: string) {
  try {
    const all = new Set(loadAccepted()).add(key);
    localStorage.setItem(KEY, JSON.stringify([...all]));
  } catch {
    // storage blocked: accepted for this visit only
  }
}
