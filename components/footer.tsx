"use client";

import { LogoGithub } from "@carbon/icons-react";
import { Link as CarbonLink } from "@carbon/react";

export default function Footer() {
  return (
    <footer className="w-full border-t border-[var(--cds-border-subtle)]">
      <div className="container flex flex-col items-center justify-between gap-6 px-8 py-12 md:flex-row">
        <span className="text-sm text-[var(--cds-text-secondary)]">
          DotStories · What is possible today with AI · Open source
        </span>
        <CarbonLink
          href="https://github.com/Dayonel/dotstories"
          target="_blank"
          aria-label="Source code on GitHub (opens in a new tab)"
          renderIcon={() => <LogoGithub size={20} />}
        >
          GitHub
        </CarbonLink>
      </div>
    </footer>
  );
}
