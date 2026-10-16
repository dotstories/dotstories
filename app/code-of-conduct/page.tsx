import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal";
import { OPERATOR } from "@/lib/operator";
import { DISCORD, REPO } from "@/lib/community";

export const metadata: Metadata = {
  title: "Code of Conduct · DotStories",
  description: "How we treat each other in the DotStories community.",
  alternates: { canonical: "/code-of-conduct" },
};

export default function CodeOfConduct() {
  return (
    <LegalPage title="Code of Conduct">
      <p>
        DotStories is its community: the people who share dots, help each other and build the project. This code applies
        everywhere the community meets: dotstories.com, comments, the <a href={REPO}>GitHub repository</a> and our{" "}
        <a href={DISCORD}>Discord</a>.
      </p>

      <h2>Do</h2>
      <ul>
        <li>Be kind and welcoming, especially to people who are new.</li>
        <li>Assume positive intent: most mistakes are just mistakes.</li>
        <li>Ask questions, share what you know and help others get their dots working.</li>
        <li>Give credit: say whose dot or idea you built on.</li>
        <li>Give feedback on the work, not the person.</li>
      </ul>

      <h2>Don&apos;t</h2>
      <ul>
        <li>Harass, insult, threaten or discriminate against anyone.</li>
        <li>Stalk, dox or publish anyone&apos;s private information (doxxing).</li>
        <li>Post sexual content, or anything unlawful or against the <Link href="/terms">Terms</Link>.</li>
        <li>Spam, advertise unasked or flood comments.</li>
        <li>Pass off other people&apos;s dots or work as your own.</li>
      </ul>

      <h2>Report a problem</h2>
      <p>
        If someone breaks this code, use the report option or email <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> with
        a link and what happened. We look at every report, keep the reporter&apos;s name private and act on it: a warning, removing
        content, or suspending or closing an account.
      </p>
    </LegalPage>
  );
}
