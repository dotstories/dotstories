import { type Dot, latest, version as findVersion } from "./dot";

/**
 * What a visitor changed on a dot. Lives in the URL (source of truth, shareable)
 * and in localStorage when logged out.
 */
export type DotState = { v?: string; prompt?: string; seed?: number };
type Params = Record<string, string | string[] | undefined>;

const first = (x: string | string[] | undefined) => (Array.isArray(x) ? x[0] : x);

export function parseState(dot: Dot, params: Params): DotState {
  const state: DotState = {};
  const v = first(params.v);
  if (v && findVersion(dot, v)) state.v = v;
  const prompt = first(params.prompt);
  if (prompt && prompt.length <= 4000) state.prompt = prompt;
  const seed = Number(first(params.seed));
  if (first(params.seed) && Number.isInteger(seed) && seed >= 0 && seed <= 2 ** 32 - 1) state.seed = seed;
  return state;
}

const versionOf = (dot: Dot, state: DotState) => (state.v && findVersion(dot, state.v)) || latest(dot);

/** Only what differs from the dot's defaults: short, readable links. */
export function toQuery(dot: Dot, state: DotState): string {
  const v = versionOf(dot, state);
  const q = new URLSearchParams();
  if (v.version !== latest(dot).version) q.set("v", v.version);
  if (state.prompt !== undefined && state.prompt !== v.inputs.prompt) q.set("prompt", state.prompt);
  if (state.seed !== undefined && state.seed !== v.inputs.seed) q.set("seed", String(state.seed));
  return q.toString();
}

/** The dot's inputs with the visitor's changes. A changed prompt drops the author's final prompt (it was made from theirs). */
export function inputsFor<D extends Dot>(dot: D, state: DotState): D["versions"][number]["inputs"] {
  const { inputs } = versionOf(dot, state) as D["versions"][number];
  const changed = state.prompt !== undefined && state.prompt !== inputs.prompt;
  const { finalPrompt, ...rest } = inputs as typeof inputs & { finalPrompt?: string };
  return {
    ...rest,
    ...(finalPrompt !== undefined && !changed ? { finalPrompt } : {}),
    ...(changed ? { prompt: state.prompt } : {}),
    ...(state.seed !== undefined ? { seed: state.seed } : {}),
  } as D["versions"][number]["inputs"];
}

const key = (dot: Dot) => `dotstories:dot:${dot.slug}`;

export function loadSaved(dot: Dot): DotState {
  try {
    const raw = JSON.parse(localStorage.getItem(key(dot)) ?? "{}");
    return parseState(dot, Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)])));
  } catch {
    return {};
  }
}

export function save(dot: Dot, state: DotState) {
  try {
    localStorage.setItem(key(dot), JSON.stringify(state));
  } catch {
    // private mode / storage full: the URL still has everything
  }
}
