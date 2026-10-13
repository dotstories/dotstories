import { z } from "zod";

/** What the runner needs to make the output. Mirrors runner/engine parse_job(). */
export const InputsSchema = z.object({
  prompt: z.string().min(1).max(4000),
  style: z.string().min(1).max(4000),
  seed: z.number().int().min(0).max(2 ** 32 - 1),
  width: z.number().int().min(64).max(2048),
  height: z.number().int().min(64).max(2048),
  steps: z.number().int().min(1).max(50),
});

/** Runs in the browser after the runner is done (sandboxed, Pyodide). */
export const ShaderStepSchema = z.object({
  type: z.literal("shader"),
  script: z.string().regex(/^\/dots\/[a-z0-9-]+\/[a-z0-9_]+\.py$/), // e.g. /dots/dark-fantasy/shader.py
  files: z.array(z.string().regex(/^(?!.*\.\.)[A-Za-z0-9_./-]+$/, "no .. in paths")), // next to the script, e.g. fonts/Cinzel.ttf
  preset: z.string(),
  text: z.object({ title: z.string(), region: z.string(), subtitle: z.string(), quote: z.string() }),
});

export const VersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver like 1.0.0"),
  date: z.string(),
  changelog: z.string(),
  inputs: InputsSchema,
  postSteps: z.array(ShaderStepSchema),
  sample: z.string(), // image the author got: what users should get too
});

export const DotSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string(),
  kind: z.enum(["image", "music"]),
  engine: z.enum(["krea2-turbo"]),
  author: z.object({ name: z.string(), url: z.string().url().optional() }),
  license: z.object({ name: z.string(), url: z.string().url(), commercial: z.string() }),
  forkable: z.boolean(),
  source: z.string().url().optional(), // where the dot's files live, for "Fork on GitHub"
  versions: z.array(VersionSchema).min(1),
});

export type Dot = z.infer<typeof DotSchema>;
export type Inputs = z.infer<typeof InputsSchema>;
export type DotVersion = z.infer<typeof VersionSchema>;
export type ShaderStep = z.infer<typeof ShaderStepSchema>;

const semver = (v: string) => v.split(".").map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

export const latest = (dot: Dot) => dot.versions.reduce((a, b) => (newer(b.version, a.version) ? b : a));
export const version = (dot: Dot, v: string) => dot.versions.find((x) => x.version === v);

/** Newest first. */
export const sortedVersions = (dot: Dot) => [...dot.versions].sort((a, b) => (newer(a.version, b.version) ? -1 : 1));
