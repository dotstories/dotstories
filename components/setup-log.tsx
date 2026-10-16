"use client";

import { useEffect, useRef } from "react";
import type { SetupLine } from "@/lib/runner";

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The DotStories app setting itself up, live, like build logs. Follows the newest line unless you scroll up. */
type Line = SetupLine & { id?: string }; // id: unique when logs are combined

export default function SetupLog({ lines, title, status }: { lines: Line[]; title: string; status?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

  useEffect(() => {
    if (follow.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines.length]);

  return (
    <div className="setup-log">
      <div className="setup-log__title">
        <span>{title}</span>
        {status && <span>{status}</span>}
      </div>
      <div
        ref={box}
        role="log"
        aria-label="Setup log"
        aria-live="polite"
        className="setup-log__lines"
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
        }}
      >
        {lines.length === 0 && (
          <div className="setup-log__line">
            <span className="setup-log__waiting">Waiting for the app…</span>
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id ?? l.n} className="setup-log__line">
            <span className="setup-log__time">{clock(l.t)}</span>
            <span className="setup-log__text">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
