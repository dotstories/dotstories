// Runs a dot's Python post-step (e.g. shader.py) in the browser with Pyodide.
// Inside a web worker: off the main thread and inside the browser's sandbox.
// Not bundled: loaded only when a dot needs it.
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const ready = (async () => {
  const py = await loadPyodide();
  await py.loadPackage(["numpy", "pillow"]);
  return py;
})();

// { id, files: { "shader.py": ArrayBuffer, "fonts/x.ttf": ArrayBuffer }, image: ArrayBuffer, module, args }
self.onmessage = async ({ data }) => {
  const { id, files, image, module, args } = data;
  try {
    const py = await ready;
    const dir = `/dot/${id}`;
    for (const [path, buf] of Object.entries(files)) {
      py.FS.mkdirTree(`${dir}/${path.split("/").slice(0, -1).join("/")}`);
      py.FS.writeFile(`${dir}/${path}`, new Uint8Array(buf));
    }
    py.FS.writeFile(`${dir}/input.png`, new Uint8Array(image));
    py.globals.set("dot_dir", dir);
    py.globals.set("dot_module", module);
    py.globals.set("dot_args", py.toPy(args));
    await py.runPythonAsync(`
import importlib, sys
sys.path.insert(0, dot_dir)
m = importlib.import_module(dot_module)
m.still(f"{dot_dir}/input.png", dot_args["text"], dot_args["preset"]).save(f"{dot_dir}/output.png")
sys.path.remove(dot_dir)
sys.modules.pop(dot_module, None)
`);
    const out = py.FS.readFile(`${dir}/output.png`);
    self.postMessage({ id, png: out.buffer }, [out.buffer]);
  } catch (e) {
    self.postMessage({ id, error: String(e?.message ?? e) });
  }
};
