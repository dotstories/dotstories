"use client";

import { Button, InlineNotification, TextInput } from "@carbon/react";
import { useActionState } from "react";
import { type DeleteResult, deleteAccount } from "@/actions/account";

/** Danger zone: type your username, then everything of yours is deleted and you're logged out. */
export default function DeleteAccount({ username }: { username: string }) {
  const [state, action, pending] = useActionState<DeleteResult, FormData>(deleteAccount, {});

  return (
    <section aria-labelledby="delete-account" className="flex flex-col gap-4 border-t border-[var(--cds-border-subtle)] pt-8">
      <h2 id="delete-account" className="text-xl font-semibold">
        Delete account
      </h2>
      <p className="text-sm text-[var(--cds-text-secondary)]">
        Removes your email, name, picture, password, logins, uploads, likes and saved setups. Your comments show as
        &quot;[deleted]&quot; so replies from others stay readable. This can&apos;t be undone.
      </p>
      <form action={action} className="flex flex-col gap-4 md:max-w-sm">
        <TextInput id="confirm" name="confirm" labelText={`Type ${username} to confirm`} autoComplete="off" required />
        {state.error && <InlineNotification kind="error" title={state.error} lowContrast hideCloseButton role="alert" />}
        <Button type="submit" kind="danger" disabled={pending}>
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </form>
    </section>
  );
}
