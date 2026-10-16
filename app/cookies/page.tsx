import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal";

export const metadata: Metadata = {
  title: "Cookie Policy · DotStories",
  description: "The few cookies and browser storage DotStories uses. No tracking, no ads.",
  alternates: { canonical: "/cookies" },
};

const COOKIES = [
  ["authjs.session-token", "Keeps you logged in", "30 days, or until you log out"],
  ["authjs.csrf-token", "Protects logins and forms against forged requests", "Until you close the browser"],
  ["authjs.callback-url", "Brings you back to the page you were on after logging in", "Until you close the browser"],
  ["__cf_bm, cf_clearance", "Set by Cloudflare to tell people from bots and block attacks", "30 minutes to a few days"],
];

const STORAGE = [
  ["dotstories:dot:…", "The prompt, seed and version you last used on a dot (when logged out)", "Until you clear it"],
  ["dotstories:viewed:…", "The date you last viewed a dot, so a visit is counted once a day", "Until you clear it"],
  ["dotstories:model-terms", "Which model terms you accepted in this browser, so you aren't asked again", "Until you clear it"],
];

function Table({ rows }: { rows: string[][] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>What it does</th>
          <th>Kept</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, what, kept]) => (
          <tr key={name}>
            <td>
              <code>{name}</code>
            </td>
            <td>{what}</td>
            <td>{kept}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Cookies() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        DotStories only uses cookies and browser storage that are <strong>needed for the site to work</strong>. No analytics, no
        advertising, no tracking across sites. Because these are strictly necessary, the law doesn&apos;t require a cookie
        banner, so you won&apos;t see one.
      </p>

      <h2>Cookies</h2>
      <Table rows={COOKIES} />
      <p>Names may start with __Secure- or __Host-, which means the browser only sends them over HTTPS.</p>

      <h2>Browser storage (localStorage)</h2>
      <p>Stored only in your browser, never sent to us:</p>
      <Table rows={STORAGE} />

      <h2>Removing them</h2>
      <p>
        You can delete cookies and site data in your browser settings at any time. If you delete the login cookie you are logged
        out; the rest of the site keeps working.
      </p>

      <p>
        More about your data: see the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
