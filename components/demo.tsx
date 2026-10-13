"use client";

import { PlayFilledAlt } from "@carbon/icons-react";
import { Button, InlineLoading, InlineNotification, ProgressBar, TextArea } from "@carbon/react";
import { useEffect, useState } from "react";
import { type Dot, latest, version as findVersion } from "@/lib/dot";
import { isRunning, useRunStore } from "@/store/run";

export default function Demo({ dot, version }: { dot: Dot; version?: string }) {
  const v = (version && findVersion(dot, version)) || latest(dot);
  const [prompt, setPrompt] = useState(v.inputs.prompt);
  const { runner, job, image, error, shading, checkRunner, run } = useRunStore();
  const running = isRunning(job, shading);
  const title = v.postSteps[0]?.text.title ?? dot.name;

  useEffect(() => {
    checkRunner();
  }, [checkRunner]);

  return (
    <section aria-label="Try a dot" className="flex flex-col gap-6">
      <div className="hidden flex-col gap-4 md:flex">
        <TextArea
          id="prompt"
          labelText={`Prompt · ${dot.name}`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxCount={4000}
          enableCounter
        />
        <div className="flex items-center gap-4">
          <Button
            renderIcon={PlayFilledAlt}
            disabled={runner.state !== "ready" || running || !prompt.trim()}
            onClick={() => run({ ...v.inputs, prompt }, v.postSteps)}
          >
            Run
          </Button>
          <Status />
        </div>
        {error && <InlineNotification kind="error" title="Run failed" subtitle={error} lowContrast hideCloseButton />}
      </div>

      <p className="text-sm text-[var(--cds-text-secondary)] md:hidden">
        Running a dot needs a desktop computer. You can browse dots here.
      </p>

      <figure className="flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- result comes from the local runner */}
        <img
          src={image ?? v.sample}
          alt={`${title}, ${image ? "your result" : "a dark fantasy thumbnail"}`}
          width={1280}
          height={720}
          className="w-full rounded"
        />
        <figcaption className="text-sm text-[var(--cds-text-secondary)]">
          {image ? "Your result, made on your computer." : `Made with one click using the ${dot.name} dot.`}{" "}
          {dot.license.name}: {dot.license.commercial}.
        </figcaption>
      </figure>
    </section>
  );
}

function Status() {
  const { runner, job, shading } = useRunStore();

  if (shading) return <InlineLoading description="Adding title and effects in your browser…" />;
  if (job?.status === "loading" || job?.status === "queued")
    return <InlineLoading description="Loading the model (first run downloads it)…" />;
  if (job?.status === "running" && job.progress) {
    const { step, steps, eta } = job.progress;
    return (
      <ProgressBar
        className="flex-1"
        label="Generating"
        value={step}
        max={steps}
        helperText={`Step ${step}/${steps} · ~${Math.ceil(eta)} s left`}
      />
    );
  }
  if (runner.state === "checking") return <InlineLoading description="Looking for the DotStories app…" />;
  if (runner.state === "missing")
    return (
      <span className="text-sm text-[var(--cds-text-secondary)]">
        Get the free DotStories app to run this on your computer — coming soon.
      </span>
    );

  const { hardware, estimate } = runner.info;
  return (
    <span className="text-sm text-[var(--cds-text-secondary)]">
      Ready on {hardware.name} · {estimate.label}
      {estimate.warning && <span className="block text-[var(--cds-support-warning)]">{estimate.warning}</span>}
      <span className="block">
        First run downloads {estimate.download_gb} GB (~{estimate.download_minutes} min).
      </span>
    </span>
  );
}
