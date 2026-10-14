import { z } from "zod";

/** What the runner needs to make an image. Mirrors runner/engine parse_job(). */
export const InputsSchema = z.object({
  prompt: z.string().min(1).max(4000),
  style: z.string().min(1).max(4000),
  seed: z.number().int().min(0).max(2 ** 32 - 1),
  width: z.number().int().min(64).max(2048),
  height: z.number().int().min(64).max(2048),
  steps: z.number().int().min(1).max(50),
});

/** What the runner needs to make music (Stable Audio 3). */
export const MusicInputsSchema = z.object({
  prompt: z.string().min(1).max(4000),
  seed: z.number().int().min(0).max(2 ** 32 - 1),
  seconds: z.number().int().min(1).max(380),
  steps: z.number().int().min(1).max(250),
});

/** Runs in the browser after the runner is done (sandboxed, Pyodide). */
export const ShaderStepSchema = z.object({
  type: z.literal("shader"),
  script: z.string().regex(/^\/dots\/[a-z0-9-]+\/[a-z0-9_]+\.py$/), // e.g. /dots/dark-fantasy/shader.py
  files: z.array(z.string().regex(/^(?!.*\.\.)[A-Za-z0-9_./-]+$/, "no .. in paths")), // next to the script, e.g. fonts/Cinzel.ttf
  preset: z.string(),
  text: z.object({ title: z.string(), region: z.string(), subtitle: z.string(), quote: z.string() }),
});

const versionBase = {
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver like 1.0.0"),
  date: z.string(),
  changelog: z.string(),
  sample: z.string(), // what the author got: what users should get too
};

export const ImageVersionSchema = z.object({
  ...versionBase,
  inputs: InputsSchema,
  postSteps: z.array(ShaderStepSchema),
});

export const MusicVersionSchema = z.object({ ...versionBase, inputs: MusicInputsSchema });

const dotBase = {
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string(),
  cover: z.string(), // card image
  author: z.object({ name: z.string(), url: z.string().url().optional() }),
  license: z.object({ name: z.string(), url: z.string().url(), commercial: z.string() }),
  forkable: z.boolean(),
  source: z.string().url().optional(), // where the dot's files live, for "Fork on GitHub"
};

export const ImageDotSchema = z.object({
  ...dotBase,
  kind: z.literal("image"),
  engine: z.literal("krea2-turbo"),
  versions: z.array(ImageVersionSchema).min(1),
});

export const MusicDotSchema = z.object({
  ...dotBase,
  kind: z.literal("music"),
  engine: z.literal("stable-audio-3"),
  versions: z.array(MusicVersionSchema).min(1),
});

export const DotSchema = z.discriminatedUnion("kind", [ImageDotSchema, MusicDotSchema]);

export type ImageDot = z.infer<typeof ImageDotSchema>;
export type MusicDot = z.infer<typeof MusicDotSchema>;
export type Dot = z.infer<typeof DotSchema>;
export type Inputs = z.infer<typeof InputsSchema>;
export type MusicInputs = z.infer<typeof MusicInputsSchema>;
export type ShaderStep = z.infer<typeof ShaderStepSchema>;
type VersionOf<D extends Dot> = D["versions"][number];

/** Engines the runner app can run today. */
export const RUNNABLE_ENGINES: Dot["engine"][] = ["krea2-turbo"];

const semver = (v: string) => v.split(".").map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

export const latest = <D extends Dot>(dot: D): VersionOf<D> =>
  (dot.versions as VersionOf<D>[]).reduce((a, b) => (newer(b.version, a.version) ? b : a));

export const version = <D extends Dot>(dot: D, v: string): VersionOf<D> | undefined =>
  (dot.versions as VersionOf<D>[]).find((x) => x.version === v);

/** Newest first. */
export const sortedVersions = <D extends Dot>(dot: D): VersionOf<D>[] =>
  [...(dot.versions as VersionOf<D>[])].sort((a, b) => (newer(a.version, b.version) ? -1 : 1));
