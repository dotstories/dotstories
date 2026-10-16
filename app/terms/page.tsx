import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal";
import { OPERATOR } from "@/lib/operator";
import { MODELS } from "@/lib/models";

export const metadata: Metadata = {
  title: "Terms of Service · DotStories",
  description: "The rules of the DotStories community: dots, AI models, content, liability.",
  alternates: { canonical: "/terms" },
};

const mail = <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;
const models = Object.values(MODELS).filter((m) => m !== undefined);

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        DotStories is an open source community where people share AI workflows (&quot;dots&quot;) and run them on their own
        computer. These terms apply to dotstories.com, blog.dotstories.com and the DotStories app (together: DotStories). The
        site is run for the community by {OPERATOR.name} (&quot;we&quot;, &quot;us&quot;). By using DotStories you accept these
        terms. If you don&apos;t agree, please don&apos;t use DotStories.
      </p>

      <h2>1. What DotStories is</h2>
      <p>
        A dot is a model, a prompt, settings and steps that give a result you can repeat. Authors share dots; anyone can run them
        with the free DotStories app on their own hardware. The code is open source and built with the community. DotStories
        lives from what its members share and from their trust.
      </p>

      <h2>2. Who can use it</h2>
      <ul>
        <li>You must be at least 16 years old to create an account.</li>
        <li>Give correct information, keep your password safe and don&apos;t share your account. You are responsible for what happens on it.</li>
        <li>One person per account. Accounts made to get around a ban are not allowed.</li>
      </ul>

      <h2>3. Community rules</h2>
      <p>
        DotStories is a community. Everyone must follow the <Link href="/code-of-conduct">Code of Conduct</Link>: be kind, help
        others, and respect people and their work.
      </p>

      <h2>4. AI models you run</h2>
      <p>
        You must follow the terms of every AI model a dot uses: its license, its acceptable use policy and its model card. Some
        models have extra rules, for example a higher minimum age. Before you run a model for the first time, the app shows its
        key points and asks you to accept them. Each model&apos;s key points have their own page; the model&apos;s own documents
        always win.
      </p>
      <ul>
        {models.map((m) => (
          <li key={m.engine}>
            <Link href={`/models/${m.engine}`}>{m.name}</Link> by {m.maker}: <a href={m.license.url}>{m.license.name}</a>
          </li>
        ))}
      </ul>

      <h2>5. What you make with dots</h2>
      <p>
        What you generate is under the license of the model a dot uses: that license says what you may do with it, for example
        commercial use. We claim no rights to your results. You are responsible for following the license and for how you use
        your results.
      </p>

      <h2>6. Not allowed</h2>
      <p>DotStories has no sexual content or pornography, of any kind. You may also not use DotStories to make, post or share, or help others with:</p>
      <ul>
        <li>anything unlawful, or anything that breaks the policy or license of a model or other software a dot uses;</li>
        <li>content that sexualises minors in any way, or intimate images of real people without their consent;</li>
        <li>deepfakes meant to deceive or harm, harassment, threats, hate, or content that promotes violence or terrorism;</li>
        <li>content that infringes copyright, trademarks or other rights, including other people&apos;s dots without permission;</li>
        <li>malware, or dots built to harm the computer of the person running them, collect their data or mine cryptocurrency;</li>
        <li>spam, scams, fake accounts, fake likes or views, or misleading dots;</li>
        <li>attacking, overloading, scraping in bulk or probing DotStories, or getting around its limits or security.</li>
      </ul>

      <h2>7. Your content</h2>
      <ul>
        <li>
          You keep all rights to what you post (dots, comments, pictures, files). You give us a free, worldwide, non-exclusive
          licence to store, copy, show and share it on DotStories as needed to run the service, for as long as it is online.
        </li>
        <li>
          When you publish a dot, others may view it and run it. If you allow forks, others may copy and change it under the
          licence you choose.
        </li>
        <li>You confirm you have the rights to everything you post and that it doesn&apos;t break any law or anyone&apos;s rights.</li>
      </ul>

      <h2>8. What we do about misuse</h2>
      <p>
        We may remove content, limit features, suspend or close accounts and block access, without warning when needed. We tell
        you why, unless the law or safety says otherwise, and you can reply to {mail} to ask us to look again. We report illegal
        content, especially child sexual abuse material, to the police and the competent authorities.
      </p>

      <h2>9. Report a problem</h2>
      <p>
        To report illegal content or anything against these terms, email {mail} with the link, what is wrong and why, and your
        name and email (child abuse material can be reported anonymously). We look at every report and tell you what we did. If
        we act on your content, we tell you why and you can ask us to review the decision. This address is also our point of
        contact for authorities under the EU Digital Services Act; we answer in English or Dutch.
      </p>

      <h2>10. Free for everyone</h2>
      <p>DotStories is free. Dots are shared for everyone to run, learn from and build on.</p>

      <h2>11. Your own computer, at your own risk</h2>
      <p>
        Dots and models run on your own hardware. The app installs Python, libraries and AI models from their official sources
        (such as Hugging Face and PyPI) and runs dots in a restricted environment. Running models uses a lot of power, memory and
        disk space. You use the app and run models at your own risk; keep your own backups. We are not liable for damage to your
        computer, data or anything else caused by running dots or models.
      </p>

      <h2>12. No guarantees</h2>
      <p>
        DotStories is provided &quot;as is&quot;, without guarantees. AI results can be wrong, unexpected or different on other
        hardware. Dots are made by their authors, not by us, and we don&apos;t check every dot. DotStories, a dot or any content
        can be changed or taken down at any time.
      </p>

      <h2>13. Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential damage, lost profit or data, or damage
        caused by dots, AI results, third-party software or models, or other users. Our total liability is limited to €100. This is a maximum, not an amount we owe. These limits
        don&apos;t apply to damage caused by intent or gross negligence, and they don&apos;t take away rights consumers have under
        mandatory law.
      </p>

      <h2>14. Indemnity</h2>
      <p>
        If your content or your misuse of DotStories causes claims or costs for us, you cover them, to the extent the law allows.
      </p>

      <h2>15. Ending</h2>
      <p>
        You can stop using DotStories and delete your account at any time in Profile → Delete account (or email {mail}). We can
        end or suspend your access as described in section 8.
      </p>

      <h2>16. Changes</h2>
      <p>
        We may change these terms at any time. It is your responsibility to read them and stay up to date; the date at the top
        shows the last change. We announce important changes on the site. If you keep using DotStories after a change, the new
        terms apply.
      </p>

      <h2>17. Law and disputes</h2>
      <p>
        Dutch law applies. Disputes go to the competent court in Amsterdam, unless mandatory consumer law lets you go to the
        court where you live. If part of these terms is invalid, the rest still applies.
      </p>
      <p>
        How we handle personal data: see the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
