import Link from "next/link";
import DotRunner from "@/components/dot-runner";
import { parseState, toQuery } from "@/lib/dot-state";
import { acceptedTerms } from "@/lib/accepted-terms";
import { darkFantasy } from "@/lib/dots/dark-fantasy";
import { sessionWithSetup } from "@/lib/saved-state";

export default async function Home({ searchParams }: PageProps<"/">) {
  const search = await searchParams;
  const initial = parseState(darkFantasy, search);
  const session = await sessionWithSetup(darkFantasy, "/", search);
  const accepted = session ? await acceptedTerms(session.user.id) : [];
  return (
    <main className="container flex flex-1 flex-col gap-10 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">DotStories</h1>
        <p className="text-[var(--cds-text-secondary)]">What is possible today with AI.</p>
      </div>
      {/* key: a new link (back/forward, restored setup) starts fresh */}
      <DotRunner
        key={toQuery(darkFantasy, initial)}
        dot={darkFantasy}
        initial={initial}
        showVersions={false}
        loggedIn={!!session}
        acceptedTerms={accepted}
      />
      <Link href="/dots" className="cds--link self-start">
        Browse all dots →
      </Link>
    </main>
  );
}
