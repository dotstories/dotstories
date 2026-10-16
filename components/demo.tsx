"use client";

import { PlayFilledAlt } from "@carbon/icons-react";
import { Button, InlineLoading, InlineNotification, NumberInput, ProgressBar, TextArea } from "@carbon/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type ImageDot, type Inputs, latest, version as findVersion } from "@/lib/dot";
import { downloadInstaller, installerFor } from "@/lib/download";
import type { DotState } from "@/lib/dot-state";
import { type Model, modelFor } from "@/lib/models";
import { useModelTerms } from "@/lib/use-model-terms";
import { isRunning, useRunStore } from "@/store/run";
import InstallApp from "./install-app";
import ModelAccess from "./model-access";
import ModelTerms from "./model-terms";
import SetupLog from "./setup-log";

type Props = {
  dot: ImageDot;
  version: string;
  inputs: Inputs;
  onChange: (patch: DotState) => void;
  loggedIn?: boolean;
  acceptedTerms?: string[]; // logged in: model terms accepted before (D1)
};

export default function Demo({ dot, version, inputs, onChange, loggedIn = false, acceptedTerms }: Props) {
  const v = findVersion(dot, version) ?? latest(dot);
  const { prompt, seed } = inputs;
  const { runner, job, image, shading, init, start } = useRunStore();
  const model = modelFor(dot);
  const running = isRunning(job, shading);
  const title = v.postSteps[0]?.text.title ?? dot.name;

  useEffect(() => {
    init();
  }, [init]);

  // Run: runs now, or finds the app (the browser may ask to allow it), or installs it first.
  const run = () =>
    start(inputs, v.postSteps, () => {
      installerFor(navigator.userAgent).then((os) => os && downloadInstaller(os));
    });
  // The first run on a model asks to accept its terms.
  const { onRun, dialog } = useTermsGate(model, run, loggedIn, acceptedTerms);

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
            disabled={running || !prompt.trim() || runner.state === "checking" || runner.state === "blocked"}
            onClick={onRun}
          >
            Run
          </Button>
          <Status />
        </div>
        <Panels model={model} />
      </div>
      {dialog}

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

/** The first run on a model opens its terms; Run continues once they're accepted. */
function useTermsGate(model: Model | undefined, run: () => void, loggedIn: boolean, fromServer?: string[]) {
  const [accepted, accept] = useModelTerms(model, loggedIn, fromServer);
  const [asking, setAsking] = useState(false);
  const onRun = () => (accepted ? run() : setAsking(true));
  const dialog =
    model && asking ? (
      <ModelTerms
        model={model}
        open
        onClose={() => setAsking(false)}
        onAccept={() => {
          accept();
          setAsking(false);
          run();
        }}
      />
    ) : null;
  return { onRun, dialog };
}

/** Under the Run button: errors, model access steps, installing the app, its setup log. */
function Panels({ model }: { model: Model | undefined }) {
  const { runner, error, installing, logs, access } = useRunStore();
  return (
    <>
      {error && <InlineNotification kind="error" title="Run failed" subtitle={error} lowContrast hideCloseButton />}
      {model && access && <ModelAccess model={model} access={access} />}
      {installing && <InstallApp />}
      {!installing && runner.state === "setup" && (
        <SetupLog lines={logs} title="DotStories app · setup" status={runner.setup.message} />
      )}
    </>
  );
}

function Status() {
  const { runner, job, shading, installing } = useRunStore();

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
  if (installing && runner.state === "missing") return <InlineLoading description="Waiting for the DotStories app to start…" />;
  if (runner.state === "setup") return <InlineLoading description={runner.setup.message} />;
  if (runner.state === "blocked")
    return (
      <span className="text-sm text-[var(--cds-support-warning)]">
        Your browser blocks the connection to the DotStories app. Click the icon left of the address → Site settings →
        allow “Apps on device” (or “Local network access”), then reload.
      </span>
    );
  if (runner.state === "idle" || runner.state === "missing")
    return (
      <span className="text-sm text-[var(--cds-text-secondary)]">
        {runner.state === "idle"
          ? "Press Run: your browser asks to connect to the DotStories app on this computer, click Allow. No app? Run installs it, or "
          : "No DotStories app found. Press Run to install it, or "}
        <Link className="cds--link" href="/download">
          get the free DotStories app
        </Link>
        .
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
