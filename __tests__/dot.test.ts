import { createHash } from "node:crypto";
import { DotSchema, encoderPrompt, latest, version } from "../lib/dot";
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

  it("the latest version uses the Dark Fantasy Kit's settings: 1928 × 1088 (16:9, 2 MP), 8 steps", () => {
    const v = latest(darkFantasy);
    expect(v.version).toBe("1.1.0");
    expect(v.inputs).toMatchObject({ width: 1928, height: 1088, steps: 8, seed: 54460995 });
  });

  it("keeps the Kit's refined prompt byte for byte (from ComfyUI's history)", () => {
    const text = latest(darkFantasy).inputs.finalPrompt!;
    expect(createHash("sha256").update(text, "utf8").digest("hex")).toBe("6a411ed9bb3ab29dac8d903cfffd3798d476568eabee0c8bf851a8fe3c148d87");
  });
});

describe("encoderPrompt", () => {
  const inputs = latest(darkFantasy).inputs;

  it("is the author's final prompt when there is one", () => {
    expect(encoderPrompt(inputs)).toBe(inputs.finalPrompt);
  });

  it("is 'prompt. style' otherwise, like the Dark Fantasy Kit", () => {
    expect(encoderPrompt({ ...inputs, finalPrompt: undefined, prompt: "A tower", style: "ink" })).toBe("A tower. ink");
  });
});
