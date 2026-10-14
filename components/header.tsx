import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";

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
          {session ? (
            <>
              <span className="text-sm" data-testid="username">
                {session.user.username}
              </span>
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
