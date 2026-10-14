import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email."));

export const PASSWORD_RULES = "At least 8 characters, with an uppercase letter, a lowercase letter and a number.";
const password = z.string().regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,128}$/, PASSWORD_RULES);

export const LoginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });
export const RegisterSchema = z.object({ email, password });
export const VerifySchema = z.object({ email, password: z.string().min(1), code: z.string().regex(/^\d{6}$/, "6 digits.") });
export const EmailSchema = z.object({ email });
export const NewPasswordSchema = z.object({ token: z.string().min(1), password });
