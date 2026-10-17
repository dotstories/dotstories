import { type Download, downloadsFor, findModelFiles, type Folder, type ModelFiles } from "@dotstories/web-engine";

/**
 * The person's ComfyUI models folder: picked once, remembered in this browser (IndexedDB), read with
 * the File System Access API. Models already there are used as they are, so nothing is downloaded twice.
 */

/** A picked folder as far as we need it: the engine's Folder plus the permission calls. */
export type ModelsFolder = Folder & {
  queryPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" | "readwrite" }): Promise<PermissionState>;
};

/** Where the folder handle is remembered (IndexedDB in the app, a Map in tests). */
export type HandleStore = { get(): Promise<ModelsFolder | undefined>; set(folder: ModelsFolder): Promise<void> };

export type Scan = { files: ModelFiles; missing: [] } | { files: Partial<ModelFiles>; missing: Download[]; bytes: number };

type Picker = (options: { id: string; mode: "read" | "readwrite" }) => Promise<ModelsFolder>;

/** Asks for the folder (must run from a click) and remembers it. Closing the dialog returns null. */
export async function pickModelsFolder(store: HandleStore, picker?: Picker): Promise<ModelsFolder | null> {
  const pick = picker ?? (globalThis as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker;
  if (!pick) throw new Error("This browser can't open folders. Use Chrome or Edge on a desktop computer.");
  try {
    const folder = await pick({ id: "comfyui-models", mode: "read" });
    await store.set(folder);
    return folder;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

/**
 * Makes sure the page may use the folder. Browsers forget the permission between visits: asking again
 * shows a small prompt and must run from a click. "readwrite" is only needed to download into it.
 */
export async function allowed(folder: ModelsFolder, mode: "read" | "readwrite", ask: boolean): Promise<boolean> {
  if ((await folder.queryPermission({ mode })) === "granted") return true;
  return ask && (await folder.requestPermission({ mode })) === "granted";
}

/** Which Krea 2 files the folder has, and what is missing with its download size. */
export async function scanModelsFolder(folder: Folder): Promise<Scan> {
  const { files, missing } = await findModelFiles(folder);
  if (!missing.length) return { files: files as ModelFiles, missing: [] };
  const downloads = downloadsFor(missing);
  return { files, missing: downloads, bytes: downloads.reduce((sum, d) => sum + d.size, 0) };
}

/** The real store: one IndexedDB entry. Handles survive reloads; their permission does not. */
export const indexedDbStore: HandleStore = {
  get: () => idb("readonly", (s) => s.get(KEY)),
  set: (folder) => idb("readwrite", (s) => s.put(folder, KEY)).then(() => undefined),
};

const [DB, STORE, KEY] = ["dotstories", "handles", "models"];

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = run(open.result.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}
