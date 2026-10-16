import Link from "next/link";
import { LEGAL_UPDATED, OPERATOR } from "@/lib/operator";

/** Shared frame for the legal pages: title, date, readable text, who runs DotStories. */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="container flex-1 px-6 py-12">
      <article className="legal">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {LEGAL_UPDATED}</p>
        {children}
        <h2>Contact</h2>
        <p>
          DotStories is an open-source community project. Email:{" "}
          <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
        </p>
        <p className="legal-also">
          See also: <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/cookies">Cookies</Link> · <Link href="/code-of-conduct">Code of Conduct</Link>
        </p>
      </article>
    </main>
  );
}
