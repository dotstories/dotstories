"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Dot } from "./dot";
import { type DotState, loadSaved, save, toQuery } from "./dot-state";

export const SYNC_MS = 300; // browsers limit how often the URL may change

/**
 * The visitor's changes to a dot. `initial` comes from the URL (read on the server).
 * Changes go to the URL (shareable, survives refresh) and to localStorage.
 * The page remounts this with a new `initial` when the URL changes from outside.
 */
export function useDotState(dot: Dot, initial: DotState) {
  const router = useRouter();
  const [state, setState] = useState(initial);

  // A visit without a link: bring back this browser's last setup.
  useEffect(() => {
    if (window.location.search) return;
    const q = toQuery(dot, loadSaved(dot));
    // Client-side on purpose: localStorage only exists in the browser, the server can't redirect to it.
    // eslint-disable-next-line react-doctor/nextjs-no-client-side-redirect
    if (q) router.replace(`?${q}`, { scroll: false });
  }, [dot, router]);

  // Changed something: update the URL and remember it.
  useEffect(() => {
    if (state === initial) return;
    const t = setTimeout(() => {
      const q = toQuery(dot, state);
      window.history.replaceState(window.history.state, "", q ? `?${q}` : window.location.pathname);
      save(dot, state);
    }, SYNC_MS);
    return () => clearTimeout(t);
  }, [dot, state, initial]);

  const update = (patch: DotState) => setState((s) => ({ ...s, ...patch }));
  return [state, update] as const;
}
