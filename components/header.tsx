import { LogoGithub } from "@carbon/icons-react";
import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { REPO } from "@/lib/community";
import Avatar from "./avatar";

export default async function Header() {
  const session = await auth();
  return (
    <header className="sticky top-0 z-10 flex h-14 w-full justify-center border-b border-[var(--cds-border-subtle)] bg-[var(--cds-background)]">
      <nav className="container flex items-center justify-between px-4">
        <Link href="/" aria-label="DotStories" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} priority />
          <span className="hidden font-semibold sm:block">DotStories</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/dots" className="cds--link">
            Dots
          </Link>
          <Link href="/download" className="cds--link">
            Get the app
          </Link>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            aria-label="DotStories on GitHub (opens in a new tab)"
            className="cds--link flex items-center gap-1"
          >
            <LogoGithub size={20} />
            <span className="hidden md:inline">GitHub</span>
          </a>
          {session ? (
            <>
              <Link href="/profile" className="flex items-center gap-2 text-sm" aria-label="Your profile">
                <Avatar src={session.user.image} name={session.user.username} />
                <span data-testid="username">{session.user.username}</span>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="cds--link text-sm">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="cds--link">
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
