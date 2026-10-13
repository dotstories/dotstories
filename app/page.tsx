import Link from "next/link";
import Demo from "@/components/demo";
import { darkFantasy } from "@/lib/dots/dark-fantasy";

export default function Home() {
  return (
    <main className="container flex flex-1 flex-col gap-10 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">DotStories</h1>
        <p className="text-[var(--cds-text-secondary)]">What is possible today with AI.</p>
      </div>
      <Demo dot={darkFantasy} />
      <Link href="/dots" className="cds--link self-start">
        Browse all dots →
      </Link>
    </main>
  );
}
