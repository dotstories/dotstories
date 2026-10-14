"use client";

import { Forum, Share, ViewFilled } from "@carbon/icons-react";
import { OverflowMenu, OverflowMenuItem } from "@carbon/react";
import { useState } from "react";
import type { Dot } from "@/lib/dot";
import type { DotState } from "@/lib/dot-state";
import type { DotStats } from "@/lib/stats";
import { setupJson, shareLinks, shareUrl } from "@/lib/share";
import LikeButton from "./like-button";


const n = (x: number) => x.toLocaleString("en-US");

/** Comments · Share · Likes ........ Views, like the old DotStories dot card. */
type Props = { dot: Dot; state: DotState; stats: DotStats; liked?: boolean; loggedIn?: boolean };

export default function ActionBar({ dot, state, stats, liked = false, loggedIn = false }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const url = shareUrl(dot, state);
  const links = shareLinks(dot, url);

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
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
        <OverflowMenuItem itemText="Share on X" onClick={() => open(links.x)} />
        <OverflowMenuItem itemText="Share on Reddit" onClick={() => open(links.reddit)} />
      </OverflowMenu>

      <LikeButton slug={dot.slug} initial={{ liked, likes: stats.likes }} loggedIn={loggedIn} />

      <span role="status" className="text-sm text-[var(--cds-support-success)]">
        {copied}
      </span>

      <span className="ml-auto flex items-center gap-1 pr-3 text-xs font-semibold">
        {n(stats.views)} Views <ViewFilled size={20} />
      </span>
    </div>
  );
}
