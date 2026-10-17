import { allowed, type HandleStore, type ModelsFolder, pickModelsFolder, scanModelsFolder } from "../lib/engine/models-folder";

/** A fake ComfyUI models folder: "dir/file" paths → size. */
function folder(paths: Record<string, number>, name = "models", permission: PermissionState = "granted"): ModelsFolder & { asked: string[] } {
  const asked: string[] = [];
  const dir = (prefix: string, dirName: string): ModelsFolder & { asked: string[] } => ({
    name: dirName,
    asked,
    async getDirectoryHandle(n) {
      if (!Object.keys(paths).some((p) => p.startsWith(`${prefix}${n}/`))) throw new DOMException("not found", "NotFoundError");
      return dir(`${prefix}${n}/`, n);
    },
    async getFileHandle(n) {
      const size = paths[prefix + n];
      if (size === undefined) throw new DOMException("not found", "NotFoundError");
      return { getFile: async () => ({ name: n, size }) as File };
    },
    async queryPermission() {
      return permission;
    },
    async requestPermission({ mode }) {
      asked.push(mode);
      return "granted";
    },
  });
  return dir("", name);
}

const memoryStore = () => {
  let saved: ModelsFolder | undefined;
  const store: HandleStore & { saved?: ModelsFolder } = {
    get: async () => saved,
    set: async (f) => {
      saved = f;
      store.saved = f;
    },
  };
  return store;
};

const ALL = {
  "diffusion_models/krea2_turbo_fp8_scaled.safetensors": 13141730784,
  "text_encoders/qwen3vl_4b_fp8_scaled.safetensors": 5242467968,
  "vae/qwen_image_vae.safetensors": 253806246,
};

describe("pickModelsFolder", () => {
  it("remembers the picked folder", async () => {
    const store = memoryStore();
    const picked = folder(ALL);
    expect(await pickModelsFolder(store, async () => picked)).toBe(picked);
    expect(store.saved).toBe(picked);
  });

  it("returns null and remembers nothing when the dialog is closed", async () => {
    const store = memoryStore();
    const closed = async () => Promise.reject(new DOMException("closed", "AbortError"));
    expect(await pickModelsFolder(store, closed)).toBeNull();
    expect(store.saved).toBeUndefined();
  });

  it("explains when the browser can't open folders", async () => {
    await expect(pickModelsFolder(memoryStore())).rejects.toThrow("Use Chrome or Edge");
  });
});

describe("allowed", () => {
  it("is true without asking when the permission is still there", async () => {
    const f = folder(ALL);
    expect(await allowed(f, "read", true)).toBe(true);
    expect(f.asked).toEqual([]);
  });

  it("asks again only when allowed to (after a click)", async () => {
    const f = folder(ALL, "models", "prompt");
    expect(await allowed(f, "read", false)).toBe(false);
    expect(await allowed(f, "readwrite", true)).toBe(true);
    expect(f.asked).toEqual(["readwrite"]);
  });
});

describe("scanModelsFolder", () => {
  it("finds all three Krea 2 files in a ComfyUI models folder", async () => {
    const scan = await scanModelsFolder(folder(ALL));
    expect(scan.missing).toEqual([]);
    expect(Object.keys(scan.files).sort()).toEqual(["textEncoder", "transformer", "vae"]);
  });

  it("lists what is missing with the download size", async () => {
    const rest = Object.fromEntries(Object.entries(ALL).filter(([path]) => !path.startsWith("diffusion_models/")));
    const scan = await scanModelsFolder(folder(rest));
    expect(scan.missing).toEqual([{ folder: "diffusion_models", name: "krea2_turbo_fp8_scaled.safetensors", size: 13141730784 }]);
    expect(scan).toMatchObject({ bytes: 13141730784 });
  });

  it("works from the ComfyUI folder too (it has models/ inside)", async () => {
    const comfy = folder(Object.fromEntries(Object.entries(ALL).map(([p, s]) => [`models/${p}`, s])), "ComfyUI");
    expect((await scanModelsFolder(comfy)).missing).toEqual([]);
  });
});
