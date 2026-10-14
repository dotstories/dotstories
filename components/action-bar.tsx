"use client";

import { Favorite, Forum, Share, ViewFilled } from "@carbon/icons-react";
import { OverflowMenu, OverflowMenuItem } from "@carbon/react";
import { useState } from "react";
import type { Dot } from "@/lib/dot";
import type { DotState } from "@/lib/dot-state";
import { setupJson, shareLinks, shareUrl } from "@/lib/share";

export type DotStats = { views: number; likes: number; comments: number };

const n = (x: number) => x.toLocaleString("en-US");

/** Comments · Share · Likes ........ Views, like the old DotStories dot card. */
export default function ActionBar({ dot, state, stats }: { dot: Dot; state: DotState; stats: DotStats }) {
  const [copied, setCopied] = useState<string | null>(null);
  const url = shareUrl(dot, state);
  const links = shareLinks(dot, url);

  const copy = async (text: string, done: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(done);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-y border-[var(--cds-border-subtle)] py-1">
      <a href="#comments" aria-label={`${n(stats.comments)} comments`} className="cds--btn cds--btn--ghost cds--btn--icon-only">
        <Forum size={20} />
      </a>

      <OverflowMenu renderIcon={() => <Share size={20} />} aria-label="Share" iconDescription="Share" size="lg">
        <OverflowMenuItem itemText="Copy link" onClick={() => copy(url, "Link copied")} />
        <OverflowMenuItem itemText="Copy setup" onClick={() => copy(setupJson(dot, state), "Setup copied")} />
        <OverflowMenuItem itemText="Share on X" href={links.x} target="_blank" rel="noreferrer" />
        <OverflowMenuItem itemText="Share on Reddit" href={links.reddit} target="_blank" rel="noreferrer" />
      </OverflowMenu>

      <span className="flex items-center gap-1 px-3 text-sm" title="Likes">
        <Favorite size={20} aria-label="Likes" />
        <span>{n(stats.likes)}</span>
      </span>

      <span role="status" className="text-sm text-[var(--cds-support-success)]">
        {copied}
      </span>

      <span className="ml-auto flex items-center gap-1 pr-3 text-xs font-semibold">
        {n(stats.views)} Views <ViewFilled size={20} />
      </span>
    </div>
  );
}
