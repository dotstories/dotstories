import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-14 w-full justify-center border-b border-[var(--cds-border-subtle)] bg-[var(--cds-background)]">
      <nav className="container flex items-center justify-between px-4">
        <Link href="/" aria-label="DotStories" className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} priority />
          <span className="hidden font-semibold sm:block">DotStories</span>
        </Link>
      </nav>
    </header>
  );
}
