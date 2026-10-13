import Image from "next/image";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex items-center gap-4">
        <Image src="/logo.png" alt="" width={48} height={48} priority />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">DotStories</h1>
          <p className="text-zinc-400">What is possible today with AI.</p>
        </div>
      </header>

      <figure className="flex flex-col gap-3">
        <Image
          src="/demo/weeping-gate.jpg"
          alt="The Weeping Gate, a dark fantasy thumbnail"
          width={1280}
          height={720}
          priority
          className="w-full rounded-lg"
        />
        <figcaption className="text-sm text-zinc-400">
          Made with one click using the Dark Fantasy Thumbnail dot. Runs free on your own computer — coming soon.
        </figcaption>
      </figure>
    </main>
  );
}
