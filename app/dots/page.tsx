import type { Metadata } from "next";
import DotCard from "@/components/dot-card";
import { dots } from "@/lib/dots";

export const metadata: Metadata = { title: "Dots · DotStories" };

export default function DotsPage() {
  return (
    <main className="container flex flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dots</h1>
        <p className="text-[var(--cds-text-secondary)]">
          Workflows that solve one problem well. Pick one, press Run, get the exact result.
        </p>
      </div>
      <div className="dot-tiles grid grid-cols-1 md:grid-cols-2">
        {dots.map((d) => (
          <DotCard key={d.slug} dot={d} />
        ))}
      </div>
    </main>
  );
}
