/** Only same-site paths: "/dots" yes, "//evil.com" or "https://evil.com" no. */
export const safeRedirect = (url: string | null | undefined, fallback = "/") =>
  url && /^\/(?![\\/])/.test(url) ? url : fallback;
