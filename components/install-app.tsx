"use client";

import { CheckmarkFilled, CircleDash, Download, InProgress } from "@carbon/icons-react";
import { Button, InlineLoading } from "@carbon/react";
import Link from "next/link";
import { type ReactNode, Suspense, use, useSyncExternalStore } from "react";
import { detectOS, downloadInstaller, releaseExists } from "@/lib/download";
import { useRunStore } from "@/store/run";
import SetupLog from "./setup-log";

const FILE = { windows: "DotStories-Windows.exe", mac: "DotStories-Mac.dmg" };
const OPEN = {
  windows: "Open DotStories-Windows.exe from your downloads. If Windows warns you (the app is new): More info → Run anyway.",
  mac: "Open DotStories-Mac.dmg, drag DotStories to Applications, then right-click it → Open (first time only).",
};

const noSubscribe = () => () => {};

/**
 * Pressed Run without the app: the installer is downloading (started by Run, see demo.tsx). Wait for it
 * to start, show its setup live, then the dot runs by itself (see store/run.ts watch).
 */
export default function InstallApp() {
  const os = useSyncExternalStore(noSubscribe, () => detectOS(navigator.userAgent), () => null);
  if (!os) return null;
  if (os !== "windows" && os !== "mac")
    return <p className="text-sm">The DotStories app is for Windows and Mac computers.</p>;
  return (
    <Suspense fallback={<InlineLoading description="Checking the latest version…" />}>
      <Steps os={os} />
    </Suspense>
  );
}

type Step = { title: string; body: ReactNode; state: "done" | "now" | "next" };

function Steps({ os }: { os: "windows" | "mac" }) {
  const released = use(releaseExists());
  const { runner, installing, logs } = useRunStore();

  if (!released) return <p className="text-sm">The first release of the DotStories app is coming soon.</p>;

  const found = runner.state === "setup" || runner.state === "ready";
  const settingUp = runner.state === "setup";
  const steps: Step[] = [
    {
      title: "Download",
      state: found ? "done" : "now",
      body: (
        <>
          Your download started: {FILE[os]}.{" "}
          <Button kind="ghost" size="sm" renderIcon={Download} onClick={() => downloadInstaller(os)}>
            Download again
          </Button>
        </>
      ),
    },
    { title: "Open it", state: found ? "done" : "now", body: OPEN[os] },
    {
      title: "Setup (first time only)",
      state: runner.state === "ready" ? "done" : settingUp ? "now" : "next",
      body: "The app installs Python and the AI libraries by itself. A few GB, so it can take a while.",
    },
    { title: "Run", state: runner.state === "ready" ? "now" : "next", body: "Your dot starts by itself when the app is ready." },
  ];

  return (
    <section aria-label="Install the DotStories app" className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.title} className="flex gap-3" aria-current={s.state === "now" ? "step" : undefined}>
            <StepIcon state={s.state} />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">{s.title}</span>
              <span className="text-[var(--cds-text-secondary)]">{s.body}</span>
            </div>
          </li>
        ))}
      </ol>
      {(installing || settingUp || logs.length > 0) && (
        <SetupLog
          lines={logs}
          title="DotStories app · setup"
          status={runner.state === "setup" ? runner.setup.message : found ? "Ready" : "Waiting for the app"}
        />
      )}
      <p className="text-sm text-[var(--cds-text-secondary)]">
        Trouble?{" "}
        <Link className="cds--link" href="/download">
          Step-by-step install
        </Link>
      </p>
    </section>
  );
}

function StepIcon({ state }: { state: Step["state"] }) {
  const props = { size: 20, className: "mt-0.5 shrink-0", "aria-hidden": true } as const;
  if (state === "done") return <CheckmarkFilled {...props} className={`${props.className} text-[var(--cds-support-success)]`} />;
  if (state === "now") return <InProgress {...props} className={`${props.className} text-[var(--cds-interactive)]`} />;
  return <CircleDash {...props} />;
}
