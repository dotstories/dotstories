"use client";

import { ArrowRight } from "@carbon/icons-react";
import { Tag } from "@carbon/react";
import Link from "next/link";
import type { Dot } from "@/lib/dot";

/** Clickable tile, like createcv's /resumes cards. */
export default function DotCard({ dot }: { dot: Dot }) {
  return (
    <Link href={`/dots/${dot.slug}`} aria-label={dot.name} className="cds--link cds--tile cds--tile--clickable dot-tile">
      {/* eslint-disable-next-line @next/next/no-img-element -- static sample */}
      <img src={dot.cover} alt="" width={640} height={360} className="w-full rounded" loading="lazy" />
      <span className="font-semibold">{dot.name}</span>
      <p className="line-clamp-2 text-xs text-[var(--cds-text-helper)]">{dot.description}</p>
      <div className="mt-auto flex items-end justify-between">
        <div className="flex gap-2">
          <Tag className="pointer-events-none !m-0" type="purple" size="sm">
            {dot.kind === "image" ? "Image" : "Music"}
          </Tag>
        </div>
        <ArrowRight />
      </div>
    </Link>
  );
}
