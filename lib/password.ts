// PBKDF2-SHA256 with WebCrypto: built into Cloudflare Workers, no dependency.
// 100k iterations is the Workers maximum.
const ITERATIONS = 100_000;
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !hash) return false;
  try {
    const actual = new Uint8Array(await derive(password, unb64(salt), Number(iterations)));
    const expected = unb64(hash);
    let diff = actual.length ^ expected.length;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ (expected[i] ?? 0);
    return diff === 0;
  } catch {
    return false;
  }
}
