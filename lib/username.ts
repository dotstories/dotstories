import { z } from "zod";

/** Letters, numbers, dots and underscores, up to 20. Unique, case-insensitive (see migrations). */
export const USERNAME = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._]{1,20}$/, "Use letters, numbers, dots and underscores (max 20).");

/** A first username from an email or a name. Callers add digits if it's taken. */
export function suggestUsername(from: string) {
  const base = from
    .split("@")[0]
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // é → e
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 15);
  return base || "user";
}
