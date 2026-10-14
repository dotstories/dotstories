"use client";

import { useState, useTransition } from "react";
import type { Result } from "@/actions/auth";

/** Runs a server action from a form: pending state + error message. */
export function useSubmit(
  action: (values: unknown) => Promise<Result>,
  onResult: (r: Result, values: Record<string, string>) => void,
) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const submit = (values: Record<string, string>) =>
    start(async () => {
      setError("");
      try {
        const r = await action(values);
        if (r.error) setError(r.error);
        else onResult(r, values);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  return { pending, error, submit };
}

export const formValues = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form)) as Record<string, string>;
