import type { Metadata } from "next";
import DownloadApp from "@/components/download-app";

export const metadata: Metadata = { title: "Get the app · DotStories" };

export default function DownloadPage() {
  return (
    <main className="container flex flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Get the DotStories app</h1>
        <p className="text-[var(--cds-text-secondary)]">
          Install once. Then press Run on any dot: it runs on your computer, for free.
        </p>
      </div>
      <DownloadApp />
    </main>
  );
}
