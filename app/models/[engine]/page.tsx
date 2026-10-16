import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LegalPage from "@/components/legal";
import { MODELS, type Model } from "@/lib/models";

type Props = { params: Promise<{ engine: string }> };

const models = Object.values(MODELS).filter((m) => m !== undefined);
const find = (engine: string): Model | undefined => models.find((m) => m.engine === engine);

export const dynamicParams = false; // only known models; anything else is a 404

export function generateStaticParams() {
  return models.map((m) => ({ engine: m.engine }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = find((await params).engine);
  if (!m) return {};
  return {
    title: `${m.name} terms · DotStories`,
    description: `Key points of the ${m.name} terms: intended use, out-of-scope uses, training data, safety, risks, license.`,
    alternates: { canonical: `/models/${m.engine}` },
  };
}

const mail = (email: string) => <a href={`mailto:${email}`}>{email}</a>;

/** One model's key points (model card, license, use policy). Same data as the first-run dialog. */
export default async function ModelPage({ params }: Props) {
  const m = find((await params).engine);
  if (!m) notFound();

  return (
    <LegalPage title={m.name}>
      <p>
        Dots can run {m.name} by {m.maker} on your computer. These are the key points of its terms. You accept them before your
        first run, and they add to our <Link href="/terms">Terms</Link>. The model&apos;s own documents always win:{" "}
        <a href={m.license.url}>{m.license.name}</a>
        {m.aup && (
          <>
            , <a href={m.aup}>Acceptable Use Policy</a>
          </>
        )}{" "}
        and <a href={m.card}>model card</a>.
      </p>
      {m.attribution && <p>{m.attribution}.</p>}

      <h2>Capabilities and intended use</h2>
      <p>{m.summary.use}</p>
      <h2>Out-of-scope uses</h2>
      <p>{m.summary.outOfScope}</p>
      <h2>Training data</h2>
      <p>{m.summary.training}</p>
      <h2>Safety</h2>
      <p>{m.summary.safety}</p>
      <h2>Risks and limitations</h2>
      <p>{m.summary.risks}</p>
      <h2>License and outputs</h2>
      <p>
        {m.summary.outputs} License: <a href={m.license.url}>{m.license.name}</a>.
      </p>
      <h2>Reporting and contact</h2>
      <p>
        {m.report ? (
          <>
            Report harmful, illegal or policy-violating results to {mail(m.report)} (reports of child sexual abuse material are
            passed on to the authorities). You can also report to us (Terms, section 9).
          </>
        ) : (
          <>Report harmful, illegal or policy-violating results to us (Terms, section 9). We pass them on to {m.maker} when needed.</>
        )}{" "}
        {m.summary.support ? <>General questions about the model: {mail(m.summary.support)}.</> : <>More about the model: <a href={m.card}>model card</a>.</>}
      </p>
    </LegalPage>
  );
}
