"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { acceptModelTerms } from "@/actions/model-terms";
import { loadAccepted, saveAccepted } from "./model-terms";
import { type Model, termsKey } from "./models";

const noSubscribe = () => () => {};

/**
 * Has this person accepted the model's terms? Logged in: D1 (passed from the server as `fromServer`).
 * Logged out: this browser. Accepting saves to both, so logging in later doesn't ask again on this device.
 */
export function useModelTerms(model: Model | undefined, loggedIn: boolean, fromServer: string[] = []) {
  const key = model ? termsKey(model) : "";
  const inBrowser = useSyncExternalStore(
    noSubscribe,
    () => !!key && loadAccepted().includes(key),
    () => false,
  );
  const [justAccepted, setJustAccepted] = useState(false);
  const accepted = !model || justAccepted || inBrowser || fromServer.includes(key);

  const accept = useCallback(() => {
    if (!key) return;
    setJustAccepted(true);
    saveAccepted(key);
    if (loggedIn) acceptModelTerms(key).catch(() => {}); // offline: this browser still remembers
  }, [key, loggedIn]);

  return [accepted, accept] as const;
}
