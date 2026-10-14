import { DotSchema, latest, version } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";

describe("dot format", () => {
  it("the Dark Fantasy dot is valid", () => {
    expect(DotSchema.parse(darkFantasy)).toBeTruthy();
  });

  it("picks the latest version by default", () => {
    const dot = {
      ...darkFantasy,
      versions: [
        { ...darkFantasy.versions[0], version: "1.0.0" },
        { ...darkFantasy.versions[0], version: "1.2.0" },
        { ...darkFantasy.versions[0], version: "1.10.0" },
      ],
    };
    expect(latest(dot).version).toBe("1.10.0");
    expect(version(dot, "1.2.0")?.version).toBe("1.2.0");
    expect(version(dot, "9.9.9")).toBeUndefined();
  });

  it("rejects bad dots", () => {
    const bad = (patch: object) => DotSchema.safeParse({ ...darkFantasy, ...patch }).success;
    expect(bad({ slug: "Not A Slug" })).toBe(false);
    expect(bad({ versions: [] })).toBe(false);
    expect(bad({ engine: "unknown" })).toBe(false);
  });

  it("inputs match what the runner accepts", () => {
    const inputs = latest(darkFantasy).inputs;
    expect(inputs.steps).toBe(8);
    expect(inputs.width % 16).toBe(0);
    expect(inputs.height % 16).toBe(0);
  });
});
