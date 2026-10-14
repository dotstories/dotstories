"use client";

import { ArrowRight } from "@carbon/icons-react";
import { Button, InlineNotification, PasswordInput, Stack, TextInput } from "@carbon/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login, newPassword, register, requestReset, resendCode, verify } from "@/actions/auth";
import { PASSWORD_RULES } from "@/lib/auth-schemas";
import { useSubmit } from "./use-submit";

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <InlineNotification kind="error" title={message} lowContrast hideCloseButton role="alert" />;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" renderIcon={ArrowRight} disabled={pending} className="!w-full !max-w-none">
      {pending ? "One moment…" : children}
    </Button>
  );
}

/** Logged in: go back where the visitor came from. */
function useDone(next: string) {
  const router = useRouter();
  return () => {
    router.push(next);
    router.refresh();
  };
}

/** Log in or create an account. Unverified emails continue with the code step. */
export function CredentialsForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const done = useDone(next);
  const [pendingVerify, setPendingVerify] = useState<{ email: string; password: string } | null>(null);
  const { pending, error, values, run } = useSubmit(mode === "login" ? login : register, (r, v) =>
    r.verify ? setPendingVerify({ email: v.email, password: v.password }) : done(),
  );

  if (pendingVerify) return <VerifyForm {...pendingVerify} next={next} />;

  return (
    <form action={run}>
      <Stack gap={5}>
        <TextInput id="email" name="email" type="email" labelText="Email" autoComplete="email" defaultValue={values.email} required />
        <PasswordInput
          id="password"
          name="password"
          labelText="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          helperText={mode === "register" ? PASSWORD_RULES : undefined}
          required
        />
        <FormError message={error} />
        {mode === "login" && (
          <Link href="/reset-password" className="cds--link self-start text-sm">
            Forgot password?
          </Link>
        )}
        <Submit pending={pending}>{mode === "login" ? "Log in" : "Create account"}</Submit>
        <p className="text-sm">
          {mode === "login" ? "No account yet? " : "Already have an account? "}
          <Link className="cds--link" href={`/${mode === "login" ? "register" : "login"}?next=${encodeURIComponent(next)}`}>
            {mode === "login" ? "Create one" : "Log in"}
          </Link>
        </p>
      </Stack>
    </form>
  );
}

function VerifyForm({ email, password, next }: { email: string; password: string; next: string }) {
  const done = useDone(next);
  const [resent, setResent] = useState(false);
  const { pending, error, run } = useSubmit(verify, () => done(), () => ({ email, password }));
  const resend = useSubmit(resendCode, () => setResent(true));

  return (
    <Stack gap={5}>
      <form action={run}>
        <Stack gap={5}>
          <p>
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
          <TextInput
            id="code"
            name="code"
            labelText="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
          />
          <FormError message={error || resend.error} />
          <Submit pending={pending}>Verify</Submit>
        </Stack>
      </form>
      <form action={resend.run}>
        <input type="hidden" name="email" defaultValue={email} />
        <Button type="submit" kind="ghost" size="sm" disabled={resend.pending}>
          {resent ? "New code sent" : "Send a new code"}
        </Button>
      </form>
    </Stack>
  );
}

export function ResetForm() {
  const [sent, setSent] = useState(false);
  const { pending, error, run } = useSubmit(requestReset, () => setSent(true));
  if (sent)
    return <p role="status">If an account exists for that email, we sent a link to reset the password. It works for 30 minutes.</p>;
  return (
    <form action={run}>
      <Stack gap={5}>
        <TextInput id="email" name="email" type="email" labelText="Email" autoComplete="email" required />
        <FormError message={error} />
        <Submit pending={pending}>Send reset link</Submit>
      </Stack>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useSubmit(newPassword, () => setSaved(true), () => ({ token }));
  if (saved)
    return (
      <p role="status">
        Password changed.{" "}
        <Link className="cds--link" href="/login">
          Log in
        </Link>
      </p>
    );
  return (
    <form action={run}>
      <Stack gap={5}>
        <PasswordInput id="password" name="password" labelText="New password" autoComplete="new-password" helperText={PASSWORD_RULES} required />
        <FormError message={error} />
        <Submit pending={pending}>Save password</Submit>
      </Stack>
    </form>
  );
}
