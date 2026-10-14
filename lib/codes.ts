/** 6-digit email codes, uniformly random. */
export function newCode() {
  const max = 4_294_000_000; // multiple of 1e6 below 2^32: no modulo bias
  const n = new Uint32Array(1);
  do crypto.getRandomValues(n);
  while (n[0] >= max);
  return String(n[0] % 1_000_000).padStart(6, "0");
}

export function codeMatches(given: string, expected: string) {
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (given.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const CODE_MINUTES = 10;
export const CODE_ATTEMPTS = 5;
export const RESET_MINUTES = 30;
