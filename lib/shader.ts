import type { ShaderStep } from "./dot";

/** Runs a dot's Python post-step in the browser (public/python-worker.mjs, Pyodide). */
type Pending = { resolve: (png: Blob) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<string, Pending>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker("/python-worker.mjs", { type: "module" });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.error) p.reject(new Error(data.error));
    else p.resolve(new Blob([data.png], { type: "image/png" }));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "Python failed to start"));
    pending.clear();
    worker = null;
  };
  return worker;
}

async function download(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return res.arrayBuffer();
}

export async function runPostStep(step: ShaderStep, image: Blob): Promise<Blob> {
  const dir = step.script.slice(0, step.script.lastIndexOf("/") + 1);
  const name = step.script.slice(dir.length);
  const files = Object.fromEntries(
    await Promise.all([name, ...step.files].map(async (f) => [f, await download(dir + f)] as const)),
  );
  const buf = await image.arrayBuffer();
  const id = `step${++seq}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(
      { id, files, image: buf, module: name.replace(/\.py$/, ""), args: { text: step.text, preset: step.preset } },
      [buf, ...Object.values(files)],
    );
  });
}
