"use server";

import { and, eq, gt } from "drizzle-orm";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { emailCodes, passwordResets, users } from "@/db/schema";
import { EmailSchema, LoginSchema, NewPasswordSchema, RegisterSchema, VerifySchema } from "@/lib/auth-schemas";
import { CODE_ATTEMPTS, CODE_MINUTES, codeMatches, newCode, RESET_MINUTES } from "@/lib/codes";
import { getDb } from "@/lib/db";
import { sendCode, sendResetLink } from "@/lib/mail";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getUserByEmail, uniqueUsername } from "@/lib/users";
import { isRetired } from "@/lib/retired";

const DELETED_EMAIL = "This email belonged to a deleted account and can't be used again.";

// These actions are the sign-in flow itself: they run before there is a session.
export type Result = { ok?: true; verify?: true; error?: string };

const firstError = (e: { issues: { message: string }[] }) => ({ error: e.issues[0]?.message ?? "Check the form." });
const minutes = (m: number) => new Date(Date.now() + m * 60_000);

async function emailNewCode(email: string) {
  const code = newCode();
  await getDb()
    .insert(emailCodes)
    .values({ email, code, expires: minutes(CODE_MINUTES), attempts: 0 })
    .onConflictDoUpdate({ target: emailCodes.email, set: { code, expires: minutes(CODE_MINUTES), attempts: 0 } });
  await sendCode(email, code);
}

async function logIn(email: string, password: string): Promise<Result> {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) return { error: "Wrong email or password." };
    throw e;
  }
}

// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function register(values: unknown): Promise<Result> {
  const parsed = RegisterSchema.safeParse(values);
  if (!parsed.success) return firstError(parsed.error);
  const { email, password } = parsed.data;

  const [existing, retired] = await Promise.all([getUserByEmail(email), isRetired("email", email)]);
  if (retired) return { error: DELETED_EMAIL };
  if (existing?.emailVerified) return { error: "This email already has an account. Log in instead." };
  if (existing) {
    // Signed up before but never verified: keep the account, take the new password.
    await getDb().update(users).set({ password: await hashPassword(password) }).where(eq(users.id, existing.id));
  } else {
    await getDb()
      .insert(users)
      .values({ email, password: await hashPassword(password), username: await uniqueUsername(email) });
  }
  await emailNewCode(email);
  return { verify: true };
}

// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function login(values: unknown): Promise<Result> {
  const parsed = LoginSchema.safeParse(values);
  if (!parsed.success) return firstError(parsed.error);
  const { email, password } = parsed.data;

  const user = await getUserByEmail(email);
  if (user?.password && !user.emailVerified) {
    if (await verifyPassword(password, user.password)) {
      await emailNewCode(email);
      return { verify: true };
    }
  }
  return logIn(email, password);
}

// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function verify(values: unknown): Promise<Result> {
  const parsed = VerifySchema.safeParse(values);
  if (!parsed.success) return firstError(parsed.error);
  const { email, password, code } = parsed.data;
  const db = getDb();

  const row = await db
    .select()
    .from(emailCodes)
    .where(and(eq(emailCodes.email, email), gt(emailCodes.expires, new Date())))
    .get();
  if (!row) return { error: "The code expired. Send a new one." };
  if (!codeMatches(code, row.code)) {
    if (row.attempts + 1 >= CODE_ATTEMPTS) {
      await db.delete(emailCodes).where(eq(emailCodes.email, email));
      return { error: "Too many tries. Send a new code." };
    }
    await db.update(emailCodes).set({ attempts: row.attempts + 1 }).where(eq(emailCodes.email, email));
    return { error: "Wrong code." };
  }

  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.email, email));
  await db.delete(emailCodes).where(eq(emailCodes.email, email));
  return logIn(email, password);
}

// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function resendCode(values: unknown): Promise<Result> {
  const parsed = EmailSchema.safeParse(values);
  if (!parsed.success) return firstError(parsed.error);
  const user = await getUserByEmail(parsed.data.email);
  if (user && !user.emailVerified) await emailNewCode(parsed.data.email);
  return { ok: true };
}

/** Always says "sent": never reveals whether an email has an account. */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function requestReset(values: unknown): Promise<Result> {
  const parsed = EmailSchema.safeParse(values);
  if (!parsed.success) return firstError(parsed.error);
  const { email } = parsed.data;
  const user = await getUserByEmail(email);
  if (user?.password) {
    const token = crypto.randomUUID();
    await getDb().delete(passwordResets).where(eq(passwordResets.email, email));
    await getDb().insert(passwordResets).values({ token, email, expires: minutes(RESET_MINUTES) });
    await sendResetLink(email, token);
  }
  return { ok: true };
}

// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function newPassword(values: unknown): Promise<Result> {
  const parsed = NewPasswordSchema.safeParse(values);
  if (!parsed.success) return firstError(parsed.error);
  const { token, password } = parsed.data;
  const db = getDb();

  const reset = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.token, token), gt(passwordResets.expires, new Date())))
    .get();
  if (!reset) return { error: "This link expired. Ask for a new one." };

  // Resetting by email also proves the email: mark it verified.
  await db
    .update(users)
    .set({ password: await hashPassword(password), emailVerified: new Date() })
    .where(eq(users.email, reset.email));
  await db.delete(passwordResets).where(eq(passwordResets.email, reset.email));
  return { ok: true };
}
