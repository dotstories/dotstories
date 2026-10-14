"use client";

import { useActionState } from "react";
import type { Result } from "@/actions/auth";

type Values = Record<string, string>;
type State = { error: string; values: Values };

/**
 * A form action that calls a server action: pending state, error message, and the last values
 * (React resets forms after an action; inputs use them as defaultValue so nothing is lost).
 * extra: values that shouldn't sit in the page (e.g. the password during the code step).
 */
export function useSubmit(action: (values: unknown) => Promise<Result>, onResult: (r: Result, values: Values) => void, extra?: () => Values) {
  const [state, run, pending] = useActionState(
    async (_: State, form: FormData): Promise<State> => {
      const values = { ...(Object.fromEntries(form) as Values), ...extra?.() };
      try {
        const r = await action(values);
        if (r.error) return { error: r.error, values };
        onResult(r, values);
        return { error: "", values };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Something went wrong.", values };
      }
    },
    { error: "", values: {} },
  );
  return { pending, error: state.error, values: state.values, run };
}
