"use client";

import { PlayFilledAlt } from "@carbon/icons-react";
import { Button, InlineLoading, InlineNotification, NumberInput, ProgressBar, TextArea } from "@carbon/react";
import Link from "next/link";
import { useEffect } from "react";
import { type ImageDot, type Inputs, latest, version as findVersion } from "@/lib/dot";
import type { DotState } from "@/lib/dot-state";
import { isRunning, useRunStore } from "@/store/run";

type Props = { dot: ImageDot; version: string; inputs: Inputs; onChange: (patch: DotState) => void };

export default function Demo({ dot, version, inputs, onChange }: Props) {
  const v = findVersion(dot, version) ?? latest(dot);
  const { prompt, seed } = inputs;
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
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={4}
          maxCount={4000}
          enableCounter
        />
        <div className="flex items-end gap-4">
          <NumberInput
            id="seed"
            label="Seed"
            className="!w-40 shrink-0"
            min={0}
            max={2 ** 32 - 1}
            value={seed}
            allowEmpty={false}
            hideSteppers
            onChange={(_, { value }) => {
              const n = Number(value);
              if (Number.isInteger(n) && n >= 0 && n <= 2 ** 32 - 1) onChange({ seed: n });
            }}
          />
          <Button
            renderIcon={PlayFilledAlt}
            disabled={runner.state !== "ready" || running || !prompt.trim()}
            onClick={() => run(inputs, v.postSteps)}
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
        <Link className="cds--link" href="/download">
          Get the free DotStories app
        </Link>{" "}
        to run this on your computer.
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
