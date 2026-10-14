"use client";

import { Download } from "@carbon/icons-react";
import { Button, InlineLoading } from "@carbon/react";
import { Suspense, use, useSyncExternalStore } from "react";
import { detectOS, DOWNLOADS, type OS, releaseExists } from "@/lib/download";

const STEPS: Record<"windows" | "mac", string[]> = {
  windows: [
    "Open DotStories-Windows.exe.",
    "If Windows warns you (the app is new): click More info → Run anyway.",
    "DotStories appears next to the clock. The first start sets things up (a few GB, once).",
    "Come back here and press Run.",
  ],
  mac: [
    "Open DotStories-Mac.dmg and drag DotStories to Applications.",
    "First time only: right-click DotStories → Open → Open (the app is new).",
    "DotStories appears in the menu bar. The first start sets things up (a few GB, once).",
    "Come back here and press Run.",
  ],
};

const noSubscribe = () => () => {};

const loading = <InlineLoading description="Checking the latest version…" />;

export default function DownloadApp({ os: given }: { os?: OS }) {
  // The browser's OS: null while rendering on the server, so no hydration mismatch.
  const detected = useSyncExternalStore(noSubscribe, () => detectOS(navigator.userAgent), () => null);
  const os = given ?? detected;
  if (!os) return loading; // server: the release check only runs in the browser
  return (
    <Suspense fallback={loading}>
      <Choice os={os} />
    </Suspense>
  );
}

function Choice({ os }: { os: OS }) {
  const released = use(releaseExists());

  if (os === "phone")
    return (
      <p>
        The DotStories app needs a Windows or Mac computer. Open dotstories.com there to install it. Here you can
        browse dots.
      </p>
    );

  if (!released)
    return <p>The first release is coming soon. The app is being tested on Windows and Mac.</p>;

  const main = os === "mac" ? "mac" : "windows";
  const other = main === "mac" ? "windows" : "mac";
  const label = { windows: "Download for Windows", mac: "Download for Mac" };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button href={DOWNLOADS[main]} renderIcon={Download} size="lg">
          {label[main]}
        </Button>
        {os === "other" ? (
          <Button href={DOWNLOADS[other]} renderIcon={Download} size="lg" kind="secondary">
            {label[other]}
          </Button>
        ) : (
          <a className="cds--link" href={DOWNLOADS[other]}>
            Also for {other === "mac" ? "Mac" : "Windows"}
          </a>
        )}
      </div>
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {STEPS[main].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="text-sm text-[var(--cds-text-secondary)]">
        Needs Windows 10/11 (64-bit) or a Mac with Apple Silicon (M1 or newer). First image dot: about 40 GB free disk.
        Free, open source, runs on your own computer.
      </p>
    </div>
  );
}
