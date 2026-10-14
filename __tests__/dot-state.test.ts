import { latest } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { inputsFor, loadSaved, parseState, save, toQuery } from "../lib/dot-state";

const defaults = latest(darkFantasy).inputs;

describe("parseState (URL → state)", () => {
  it("reads version, prompt and seed", () => {
    const s = parseState(darkFantasy, { v: "1.0.0", prompt: "A tower", seed: "42" });
    expect(s).toEqual({ v: "1.0.0", prompt: "A tower", seed: 42 });
  });

  it("ignores anything invalid instead of crashing", () => {
    expect(parseState(darkFantasy, { v: "9.9.9", seed: "-5", prompt: "" })).toEqual({});
    expect(parseState(darkFantasy, { seed: "abc", prompt: "x".repeat(5000) })).toEqual({});
    expect(parseState(darkFantasy, { prompt: ["a", "b"] })).toEqual({ prompt: "a" });
  });
});

describe("toQuery (state → URL)", () => {
  it("only keeps what differs from the dot's defaults", () => {
    expect(toQuery(darkFantasy, { prompt: defaults.prompt, seed: defaults.seed })).toBe("");
    expect(toQuery(darkFantasy, { prompt: "A tower", seed: 7 })).toBe("prompt=A+tower&seed=7");
  });

  it("keeps a non-latest version", () => {
    const dot = { ...darkFantasy, versions: [...darkFantasy.versions, { ...darkFantasy.versions[0], version: "1.1.0" }] };
    expect(toQuery(dot, { v: "1.0.0" })).toBe("v=1.0.0");
    expect(toQuery(dot, { v: "1.1.0" })).toBe("");
  });

  it("round-trips", () => {
    const state = { prompt: "Fog & ruins, 100%", seed: 9 };
    const back = parseState(darkFantasy, Object.fromEntries(new URLSearchParams(toQuery(darkFantasy, state))));
    expect(back).toEqual(state);
  });
});

describe("inputsFor", () => {
  it("fills in the dot defaults", () => {
    expect(inputsFor(darkFantasy, { prompt: "A tower" })).toEqual({ ...defaults, prompt: "A tower" });
  });
});

describe("localStorage (logged out)", () => {
  beforeEach(() => localStorage.clear());

  it("saves and loads per dot", () => {
    save(darkFantasy, { prompt: "A tower", seed: 3 });
    expect(loadSaved(darkFantasy)).toEqual({ prompt: "A tower", seed: 3 });
  });

  it("ignores broken data", () => {
    localStorage.setItem("dotstories:dot:dark-fantasy-thumbnail", "{nope");
    expect(loadSaved(darkFantasy)).toEqual({});
  });
});
