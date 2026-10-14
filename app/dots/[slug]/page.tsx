import { Tag } from "@carbon/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DotRunner from "@/components/dot-runner";
import ViewPing from "@/components/view-ping";
import { latest } from "@/lib/dot";
import { parseState, toQuery } from "@/lib/dot-state";
import { dots, findDot } from "@/lib/dots";
import { shareUrl, timeAgo } from "@/lib/share";
import { getStats } from "@/lib/stats";

export const dynamicParams = false; // only known dots; anything else is a 404

export function generateStaticParams() {
  return dots.map((d) => ({ slug: d.slug }));
}

/** Link previews (X, Discord, WhatsApp…) show the dot and, for shared setups, the prompt. */
export async function generateMetadata({ params, searchParams }: PageProps<"/dots/[slug]">): Promise<Metadata> {
  const dot = findDot((await params).slug);
  if (!dot) return { title: "DotStories" };
  const state = parseState(dot, await searchParams);
  const title = `${dot.name} · DotStories`;
  const description = state.prompt ? `Prompt: ${state.prompt.slice(0, 180)}` : dot.description;
  return {
    title,
    description,
    alternates: { canonical: `/dots/${dot.slug}` },
    openGraph: { title, description, url: shareUrl(dot, state), images: [{ url: dot.cover }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [dot.cover] },
  };
}

const ENGINES = { "krea2-turbo": "Krea 2", "stable-audio-3": "Stable Audio 3" };

function Meta({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col text-xs">
      <span className="font-semibold">{title}</span>
      <span>{children}</span>
    </div>
  );
}

export default async function DotPage({ params, searchParams }: PageProps<"/dots/[slug]">) {
  const dot = findDot((await params).slug);
  if (!dot) notFound();
  const initial = parseState(dot, await searchParams); // the URL has the visitor's setup
  const stats = await getStats(dot.slug);
  const link = (href: string, text: string) => (
    <a className="cds--link !text-xs" href={href} target="_blank" rel="noreferrer">
      {text}
    </a>
  );

  return (
    <main className="container flex flex-1 flex-col gap-6 px-6 py-12">
      <ViewPing slug={dot.slug} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{dot.name}</h1>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-light">{timeAgo(latest(dot).date)}</span>
          <div className="flex gap-1">
            <Tag size="sm" type="purple" className="!m-0">
              {dot.kind === "image" ? "Image" : "Music"}
            </Tag>
            <Tag size="sm" type="gray" className="!m-0">
              {ENGINES[dot.engine]}
            </Tag>
          </div>
        </div>
      </header>

      <p className="text-[var(--cds-text-secondary)]">{dot.description}</p>

      <div className="flex flex-wrap gap-4">
        <Meta title="Comments">{stats.comments} comments</Meta>
        {dot.forkable && dot.source && <Meta title="Source">{link(dot.source, "Fork on GitHub")}</Meta>}
        <Meta title="Author">{dot.author.url ? link(dot.author.url, dot.author.name) : dot.author.name}</Meta>
        <Meta title="License">{link(dot.license.url, dot.license.name)}</Meta>
      </div>

      <DotRunner key={toQuery(dot, initial)} dot={dot} initial={initial} stats={stats} />

      <section id="comments" aria-labelledby="comments-title" className="flex flex-col gap-2">
        <h2 id="comments-title" className="text-lg font-semibold">
          Comments
        </h2>
        {stats.comments === 0 && <p className="text-sm text-[var(--cds-text-secondary)]">No comments yet.</p>}
      </section>
    </main>
  );
}
