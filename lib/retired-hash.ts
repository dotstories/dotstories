/** What a deleted account leaves behind so it can't be used again: its email, username and social logins. */
export type RetiredKind = "email" | "username" | "login";

/**
 * SHA-256 of the value (lowercase, trimmed). Stored instead of the value itself: enough to say "that one is
 * taken", not to read it back.
 */
export async function retiredHash(kind: RetiredKind, value: string) {
  const data = new TextEncoder().encode(`dotstories:${kind}:${value.trim().toLowerCase()}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
