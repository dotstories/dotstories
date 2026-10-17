import { checkSupport } from "../lib/engine/support";

const GB = 1024 ** 3;
const adapter = (binding = 2 * GB, info: Partial<GPUAdapterInfo> = { vendor: "nvidia", architecture: "lovelace" }) =>
  ({ limits: { maxStorageBufferBindingSize: binding, maxBufferSize: 4 * GB }, info }) as unknown as GPUAdapter;
const nav = (a: GPUAdapter | null) => ({ gpu: { requestAdapter: async () => a } });
const win = { showDirectoryPicker: () => {} };

describe("checkSupport", () => {
  it("is ok on a desktop Chrome/Edge with a big enough GPU, and names the GPU", async () => {
    expect(await checkSupport(nav(adapter()), win)).toEqual({ ok: true, gpu: "nvidia lovelace" });
  });

  it("explains each missing piece", async () => {
    expect(await checkSupport({}, win)).toMatchObject({ ok: false, reason: expect.stringContaining("no WebGPU") });
    expect(await checkSupport(nav(adapter()), {})).toMatchObject({ ok: false, reason: expect.stringContaining("models folder") });
    expect(await checkSupport(nav(null), win)).toMatchObject({ ok: false, reason: expect.stringContaining("no graphics card") });
    expect(await checkSupport(nav(adapter(GB)), win)).toMatchObject({ ok: false, reason: expect.stringContaining("up to 1.0 GB") });
  });
});
