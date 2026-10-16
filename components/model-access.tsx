"use client";

import { Launch } from "@carbon/icons-react";
import { Button, TextInput } from "@carbon/react";
import { useState } from "react";
import type { Model } from "@/lib/models";
import type { Access } from "@/lib/runner";
import { useRunStore } from "@/store/run";

const STATUS: Record<Exclude<Access["status"], "ok">, string> = {
  "no-token": "Paste your token to continue.",
  "bad-token": "Hugging Face didn't accept this token. Create a new one with Read access and paste it again.",
  "not-accepted": `Your token works, but the terms aren't accepted on this Hugging Face account yet. Accept them on the model page, then press "Check again".`,
  offline: `The DotStories app couldn't reach Hugging Face. Check your internet connection, then press "Check again".`,
};

/**
 * The model is gated on Hugging Face: each person accepts the maker's terms there once, with their own
 * free account, and the app downloads with their token. The token goes to the app on this computer
 * (127.0.0.1), never to dotstories.com.
 */
export default function ModelAccess({ model, access }: { model: Model; access: Access }) {
  const { saveToken, recheckAccess } = useRunStore();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const status = access.status === "ok" ? null : STATUS[access.status];

  const act = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={`Get access to ${model.name}`} className="flex flex-col gap-4 rounded border border-[var(--cds-border-subtle)] p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">One more step: {model.name} on Hugging Face</h2>
        <p className="text-sm text-[var(--cds-text-secondary)]">
          {model.maker} shares {model.name} on Hugging Face, which asks everyone to accept the terms there once, with a
          free account. Your token is saved only in the DotStories app on this computer. It is never sent to
          dotstories.com.
        </p>
      </div>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>
          Sign in to Hugging Face and accept the terms on the{" "}
          <a className="cds--link" href={access.url} target="_blank" rel="noreferrer">
            {model.name} page <Launch className="inline" aria-hidden />
          </a>
          .
        </li>
        <li>
          Create a token with <strong>Read</strong> access in{" "}
          <a className="cds--link" href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">
            your Hugging Face settings <Launch className="inline" aria-hidden />
          </a>
          .
        </li>
        <li className="flex flex-col gap-2">
          <span>Paste it here. Your dot runs by itself when access works.</span>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (token.trim()) act(() => saveToken(token))();
            }}
          >
            <TextInput
              id="hf-token"
              type="password"
              labelText="Hugging Face token"
              placeholder="hf_…"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button type="submit" size="md" disabled={busy || !token.trim()}>
              Save to the app
            </Button>
          </form>
        </li>
      </ol>
      {status && (
        <p role="status" className="text-sm text-[var(--cds-support-warning)]">
          {status}
        </p>
      )}
      {(access.status === "not-accepted" || access.status === "offline") && (
        <Button kind="tertiary" size="sm" className="self-start" disabled={busy} onClick={act(recheckAccess)}>
          Check again
        </Button>
      )}
    </section>
  );
}
