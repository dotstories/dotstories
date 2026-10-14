import { checkUpload, extensionFor, kindOf, LIMITS, MB, newKey } from "../lib/uploads";

describe("upload limits per type", () => {
  it("5 MB images, 100 MB music, 500 MB video", () => {
    expect(LIMITS).toEqual({ image: 5 * MB, music: 100 * MB, video: 500 * MB });
  });

  it("knows the kind from the file type", () => {
    expect(kindOf("image/webp")).toBe("image");
    expect(kindOf("audio/flac")).toBe("music");
    expect(kindOf("audio/webm")).toBe("music");
    expect(kindOf("video/mp4")).toBe("video");
    expect(kindOf("application/x-msdownload")).toBeNull();
    expect(kindOf("image/svg+xml")).toBeNull(); // SVG can carry scripts
  });

  it("accepts files within the limit, refuses the rest with a clear reason", () => {
    expect(checkUpload("image/webp", 4 * MB)).toEqual({ ok: true, kind: "image" });
    expect(checkUpload("image/webp", 6 * MB)).toEqual({ ok: false, error: "Too big: images can be up to 5 MB." });
    expect(checkUpload("audio/flac", 101 * MB)).toEqual({ ok: false, error: "Too big: music can be up to 100 MB." });
    expect(checkUpload("video/mp4", 400 * MB).ok).toBe(true);
    expect(checkUpload("text/html", 1)).toEqual({ ok: false, error: "This file type isn't supported." });
    expect(checkUpload("image/png", 0).ok).toBe(false);
  });

  it("stores files under the owner's folder with a random name", () => {
    const key = newKey("user-1", "image/webp");
    expect(key).toMatch(/^u\/user-1\/[0-9a-f-]{36}\.webp$/);
    expect(newKey("user-1", "image/webp")).not.toBe(key);
    expect(extensionFor("audio/mpeg")).toBe("mp3");
  });
});
