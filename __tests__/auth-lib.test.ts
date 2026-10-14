/** @jest-environment node */
import { codeMatches, newCode } from "../lib/codes";
import { hashPassword, verifyPassword } from "../lib/password";
import { LoginSchema, NewPasswordSchema, RegisterSchema } from "../lib/auth-schemas";
import { retiredHash } from "../lib/retired-hash";
import { USERNAME, suggestUsername } from "../lib/username";

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("Secret123");
    const b = await hashPassword("Secret123");
    expect(a).not.toBe(b);
    expect(a.startsWith("pbkdf2-sha256$100000$")).toBe(true);
    expect(await verifyPassword("Secret123", a)).toBe(true);
    expect(await verifyPassword("secret123", a)).toBe(false);
    expect(await verifyPassword("Secret123", "garbage")).toBe(false);
  });
});

describe("email codes", () => {
  it("are 6 digits", () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });
  it("compare in constant time", () => {
    expect(codeMatches("012345", "012345")).toBe(true);
    expect(codeMatches("012345", "012346")).toBe(false);
    expect(codeMatches("012345", "01234")).toBe(false);
  });
});

describe("usernames", () => {
  it("letters, numbers, dots and underscores, up to 20", () => {
    for (const ok of ["dayo", "Dayo.Nel_99", "a", "x".repeat(20)]) expect(USERNAME.safeParse(ok).success).toBe(true);
    for (const bad of ["", "x".repeat(21), "da yo", "dayo!", "dayo-nel", "ñandu"]) expect(USERNAME.safeParse(bad).success).toBe(false);
  });

  it("deleted_… is reserved for deleted accounts", () => {
    expect(USERNAME.safeParse("deleted_abc").success).toBe(false);
    expect(USERNAME.safeParse("Deleted_x").success).toBe(false);
    expect(USERNAME.safeParse("deletedfan").success).toBe(true);
  });

  it("suggests one from an email or name", () => {
    expect(suggestUsername("nestor.p@example.com")).toBe("nestor.p");
    expect(suggestUsername("Néstor Plysyuk")).toBe("nestor_plysyuk");
    expect(suggestUsername("a-very-long-name-from-somewhere@x.io").length).toBeLessThanOrEqual(15);
    expect(suggestUsername("!!!")).toBe("user");
  });
});

describe("forms", () => {
  it("normalises the email", () => {
    expect(LoginSchema.parse({ email: " Me@Example.COM ", password: "x" }).email).toBe("me@example.com");
  });
  it("asks for a decent password", () => {
    expect(RegisterSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
    expect(RegisterSchema.safeParse({ email: "a@b.co", password: "alllowercase1" }).success).toBe(false);
    expect(RegisterSchema.safeParse({ email: "a@b.co", password: "Good1pass" }).success).toBe(true);
    expect(NewPasswordSchema.safeParse({ token: "t", password: "Good1pass" }).success).toBe(true);
  });
});

describe("retired emails and usernames", () => {
  it("are stored as a SHA-256 hash, the same for any case or spacing", async () => {
    const hash = await retiredHash("email", "Me@Example.com ");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("example");
    expect(await retiredHash("email", "me@example.com")).toBe(hash);
    expect(await retiredHash("username", "me@example.com")).not.toBe(hash); // kinds never collide
  });
});
