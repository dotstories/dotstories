/** Can this browser make images with the web engine? Checked before Run, with a reason to show if not. */

export type Support = { ok: true; gpu: string } | { ok: false; reason: string };

// The image decoder's biggest buffer at 2 MP (1928 × 1088) is about 1.6 GB.
const NEEDED_BINDING = 1.75 * 1024 ** 3;

type Nav = { gpu?: Pick<GPU, "requestAdapter"> };
type Win = object; // window: the File System Access API (showDirectoryPicker) is not in TypeScript's DOM types yet

export async function checkSupport(nav: Nav | undefined = globalThis.navigator, win: Win | undefined = globalThis.window): Promise<Support> {
  if (!nav?.gpu) return { ok: false, reason: "This browser has no WebGPU. Use Chrome or Edge on a desktop computer." };
  if (!win || !("showDirectoryPicker" in win)) return { ok: false, reason: "This browser can't open your models folder. Use Chrome or Edge on a desktop computer." };
  const adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" }).catch(() => null);
  if (!adapter) return { ok: false, reason: "WebGPU is on, but no graphics card was found. Update your graphics driver, then reload." };
  const binding = Math.min(adapter.limits.maxStorageBufferBindingSize, adapter.limits.maxBufferSize);
  if (binding < NEEDED_BINDING)
    return { ok: false, reason: `Your graphics card allows buffers up to ${(binding / 1024 ** 3).toFixed(1)} GB; this dot needs 2 GB.` };
  const { vendor, architecture, description } = adapter.info;
  return { ok: true, gpu: description || [vendor, architecture].filter(Boolean).join(" ") || "your graphics card" };
}
