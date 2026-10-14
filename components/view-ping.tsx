"use client";

import { useEffect } from "react";

const today = () => new Date().toISOString().slice(0, 10);

/** Counts this visit: once per dot per day per browser. Fire-and-forget. */
export default function ViewPing({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `dotstories:viewed:${slug}`;
    try {
      if (localStorage.getItem(key) === today()) return;
      localStorage.setItem(key, today());
    } catch {
      // storage blocked: still count it
    }
    navigator.sendBeacon(`/api/dots/${slug}/view`);
  }, [slug]);
  return null;
}
