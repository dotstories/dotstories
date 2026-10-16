import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = {
  title: "Privacy Policy · DotStories",
  description: "What personal data DotStories uses, why, where it is stored and your rights.",
  alternates: { canonical: "/privacy" },
};

const USE: [string, string, string][] = [
  ["Email, username, password (stored only as a secure hash), profile picture", "Your account and logging in", "Contract"],
  ["Name, email and picture from Google or GitHub, if you log in with them", "Creating your account from that login", "Contract"],
  ["6-digit codes (kept 10 minutes) and password-reset links (30 minutes)", "Checking your email address and resetting your password", "Contract"],
  ["Comments, likes, saved dot settings (prompt, seed, version), files you upload", "Showing them on DotStories and keeping your setup on every device", "Contract"],
  ["Which model terms you accepted, and when", "Not asking again, and showing you accepted them", "Contract"],
  ["View counts per dot", "Showing how popular a dot is. We only store totals, not who viewed.", "Legitimate interest"],
  ["IP address, browser and request details, handled by our host Cloudflare", "Delivering the site, security, stopping bots and abuse. Logs are kept for a few days.", "Legitimate interest"],
  [`Emails you send to ${OPERATOR.email}, and reports`, "Answering you and handling reports", "Legitimate interest / legal obligation"],
];

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        DotStories is a community, and trust is what it runs on. {OPERATOR.name} (&quot;we&quot;) runs the site for the community
        and is responsible (&quot;controller&quot;) for the personal data described here. We collect as little as possible, never
        sell it and never use it for advertising.
      </p>

      <h2>1. What we use, and why</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why</th>
            <th>Legal basis</th>
          </tr>
        </thead>
        <tbody>
          {USE.map(([data, why, basis]) => (
            <tr key={data}>
              <td>{data}</td>
              <td>{why}</td>
              <td>{basis}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>2. What stays on your computer</h2>
      <p>
        Dots run in the DotStories app on your own computer. Your prompts and what you make (images, music) stay there and are not
        sent to us, unless you choose to share them. Your Hugging Face token stays on your computer: the website only passes it to
        the app on your own machine (127.0.0.1) and we never receive or store it. The app downloads software and AI models
        directly from their sources, such as Hugging Face and PyPI, which see your IP address like any download.
      </p>

      <h2>3. Who processes data for us</h2>
      <ul>
        <li>
          Cloudflare (hosting, database, file storage, security, email forwarding). The database runs in Western Europe and
          uploaded files are stored in the EU. Cloudflare is a US company; where data is handled outside the EU (for example while
          delivering pages worldwide), the EU-US Data Privacy Framework and the EU Standard Contractual Clauses apply.
        </li>
        <li>Zoho (ZeptoMail), EU data center: sends verification codes and password-reset emails.</li>
        <li>GitHub: hosts the open source code and the app downloads.</li>
        <li>Google or GitHub: only if you choose to log in with them; their own privacy policies apply.</li>
      </ul>
      <p>They only process data on our instructions, under data processing agreements.</p>

      <h2>4. How long we keep it</h2>
      <p>
        Your data stays until you delete your account (Profile → Delete account). Then we remove right away your email, name,
        picture, password, logins, likes, saved setups, accepted model terms and uploads, and the text of your comments (they
        show as &quot;[deleted]&quot; so replies from others stay readable). What is left is an anonymous placeholder (&quot;Deleted
        user&quot;). Your email, username and social logins are kept only as a hash (a scrambled code we can compare a new sign-up
        against but can&apos;t read back), so nobody can pose as you and banned users can&apos;t return (legitimate interest).
        Copies in backups are gone within 30 days. We only keep what the law requires, for as long as it requires.
      </p>
      <p>
        A comment you delete is removed right away; we keep no copy. If the police, a prosecutor or a court orders us to preserve
        or hand over specific data, we keep that data for as long as the order requires, and only that data.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You can ask to see, correct, delete or receive a copy of your data, object to or limit how we use it, and withdraw
        consent. Email <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> from the address of your account; we answer within
        one month. You can also complain to the Dutch Data Protection Authority, the{" "}
        <a href="https://autoriteitpersoonsgegevens.nl">Autoriteit Persoonsgegevens</a>.
      </p>

      <h2>6. Security</h2>
      <p>
        Everything goes over HTTPS, passwords are stored only as salted hashes, and access to data is limited to what is needed
        to run DotStories. The code is open source, so anyone can check how data is handled.
      </p>

      <h2>7. Age</h2>
      <p>Accounts are for people aged 16 and over. If we learn that a younger person has an account, we delete it.</p>

      <h2>8. Cookies</h2>
      <p>
        We only use cookies and browser storage that DotStories needs to work: no tracking, no advertising. See the{" "}
        <Link href="/cookies">Cookie Policy</Link>.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may change this policy at any time; the date at the top shows the last change. We announce important changes on the
        site.
      </p>
    </LegalPage>
  );
}
