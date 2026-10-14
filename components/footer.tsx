import { LogoGithub, LogoLinkedin, LogoX } from "@carbon/icons-react";
import Link from "next/link";
import { BLOG } from "@/lib/share";
import { OPERATOR } from "@/lib/operator";
import LogoFull from "./logo-full";

const SOCIAL = [
  { href: "https://github.com/Dayonel/dotstories", label: "DotStories source code on GitHub (opens in a new tab)", Icon: LogoGithub },
];

export default function Footer() {
  return (
    <footer className="w-full border-t border-[var(--cds-border-subtle)]">
      <div className="container flex flex-col items-center gap-10 px-8 pt-12 pb-10 md:pt-16">
        <div className="flex w-full flex-col items-center justify-between gap-10 md:flex-row">
          <Link href="/" aria-label="DotStories home" className="text-[var(--cds-text-primary)]">
            <LogoFull className="h-12 w-auto" />
          </Link>
          <div className="flex flex-col items-center gap-6 md:items-end">
            <div className="flex gap-6">
              {SOCIAL.map(({ href, label, Icon }) => (
                <a key={href} href={href} target="_blank" rel="noreferrer" aria-label={label} className="text-[var(--cds-icon-primary)]">
                  <Icon size={28} />
                </a>
              ))}
            </div>
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <a className="cds--link" href={`mailto:${OPERATOR.email}`}>
                {OPERATOR.email}
              </a>
              <a className="cds--link" href={`${BLOG}/`}>
                Blog
              </a>
              <Link className="cds--link" href="/terms">
                Terms
              </Link>
              <Link className="cds--link" href="/privacy">
                Privacy
              </Link>
              <Link className="cds--link" href="/cookies">
                Cookies
              </Link>
            </nav>
          </div>
        </div>
        <p className="text-center text-xs text-[var(--cds-text-secondary)]">
          © {new Date().getFullYear()} {OPERATOR.name}
        </p>
      </div>
    </footer>
  );
}
