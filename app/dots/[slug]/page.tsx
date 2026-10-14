import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DotRunner from "@/components/dot-runner";
import { parseState, toQuery } from "@/lib/dot-state";
import { dots, findDot } from "@/lib/dots";

export const dynamicParams = false; // only known dots; anything else is a 404

export function generateStaticParams() {
  return dots.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/dots/[slug]">): Promise<Metadata> {
  const dot = findDot((await params).slug);
  return { title: dot ? `${dot.name} · DotStories` : "DotStories", description: dot?.description };
}

export default async function DotPage({ params, searchParams }: PageProps<"/dots/[slug]">) {
  const dot = findDot((await params).slug);
  if (!dot) notFound();
  const initial = parseState(dot, await searchParams); // the URL has the visitor's setup

  return (
    <main className="container flex flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{dot.name}</h1>
        <p className="text-[var(--cds-text-secondary)]">{dot.description}</p>
        <p className="text-sm text-[var(--cds-text-secondary)]">
          by {dot.author.url ? <a className="cds--link" href={dot.author.url}>{dot.author.name}</a> : dot.author.name} ·{" "}
          <a className="cds--link" href={dot.license.url} target="_blank" rel="noreferrer">
            {dot.license.name}
          </a>
          {dot.forkable && dot.source && (
            <>
              {" "}·{" "}
              <a className="cds--link" href={dot.source} target="_blank" rel="noreferrer">
                Fork on GitHub
              </a>
            </>
          )}
        </p>
      </div>
      <DotRunner key={toQuery(dot, initial)} dot={dot} initial={initial} />
    </main>
  );
}
