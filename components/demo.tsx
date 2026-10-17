"use client";

import { PlayFilledAlt } from "@carbon/icons-react";
import { Button, InlineLoading, InlineNotification, NumberInput, ProgressBar, TextArea } from "@carbon/react";
import { useEffect, useState } from "react";
import { type ImageDot, type Inputs, latest, version as findVersion } from "@/lib/dot";
import type { DotState } from "@/lib/dot-state";
import { type Model, modelFor } from "@/lib/models";
import { useModelTerms } from "@/lib/use-model-terms";
import { isBusy } from "@/store/browser-run";
import { useBrowserRun } from "@/store/run-in-browser";
import ModelTerms from "./model-terms";

type Props = {
  dot: ImageDot;
  version: string;
  inputs: Inputs;
  onChange: (patch: DotState) => void;
  loggedIn?: boolean;
  acceptedTerms?: string[]; // logged in: model terms accepted before (D1)
};

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

export default function Demo({ dot, version, inputs, onChange, loggedIn = false, acceptedTerms }: Props) {
  const v = findVersion(dot, version) ?? latest(dot);
  const { prompt, seed } = inputs;
  const { phase, image, init, run } = useBrowserRun();
  const model = modelFor(dot);
  const title = v.postSteps[0]?.text.title ?? dot.name;

  useEffect(() => {
    init();
  }, [init]);

  // The first run on a model asks to accept its terms.
  const { onRun, dialog } = useTermsGate(model, () => run(inputs, v.postSteps), loggedIn, acceptedTerms);

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
          helperText={v.inputs.finalPrompt && !inputs.finalPrompt ? "Your own prompt is used as you wrote it (the author's prompt refine is not applied)." : undefined}
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
          <Button renderIcon={PlayFilledAlt} disabled={isBusy(phase) || phase.name === "unsupported" || !prompt.trim()} onClick={onRun}>
            Run
          </Button>
          <Status />
        </div>
        <Panel />
      </div>
      {dialog}

      <p className="text-sm text-[var(--cds-text-secondary)] md:hidden">
        Running a dot needs a desktop computer. You can browse dots here.
      </p>

      <figure className="flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- the result is made in this browser */}
        <img
          src={image ?? v.sample}
          alt={`${title}, ${image ? "your result" : "a dark fantasy thumbnail"}`}
          width={1280}
          height={720}
          className="w-full rounded"
        />
        <figcaption className="text-sm text-[var(--cds-text-secondary)]">
          {image ? "Your result, made on your graphics card." : `Made with one click using the ${dot.name} dot.`}{" "}
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

/** Next to Run: what happens now. */
function Status() {
  const { phase, gpu, folderName, cancel } = useBrowserRun();
  const muted = "text-sm text-[var(--cds-text-secondary)]";
  const stop = (
    <Button kind="ghost" size="sm" onClick={cancel}>
      Cancel
    </Button>
  );
  switch (phase.name) {
    case "checking":
      return <InlineLoading description="Checking your browser…" />;
    case "unsupported":
      return <span className="text-sm text-[var(--cds-support-warning)]">{phase.reason}</span>;
    case "downloading":
      return (
        <div className="flex flex-1 items-end gap-2">
          <ProgressBar className="flex-1" label={`Downloading ${phase.file}`} value={phase.done} max={phase.total} helperText={`${gb(phase.done)} of ${gb(phase.total)}`} />
          {stop}
        </div>
      );
    case "making":
      return (
        <div className="flex flex-1 items-end gap-2">
          <ProgressBar className="flex-1" label="Making the image on your graphics card" value={phase.progress.fraction} max={1} helperText={phase.progress.message} />
          {stop}
        </div>
      );
    case "shading":
      return <InlineLoading description="Adding title and effects in your browser…" />;
    case "done":
      return <span className={muted}>Done in {phase.seconds} s.</span>;
    default:
      return (
        <span className={muted}>
          Runs on {gpu ?? "your graphics card"}, nothing is uploaded.{" "}
          {folderName ? `Models folder: ${folderName}.` : "Run asks once for a models folder: your ComfyUI models folder, or any empty folder."}
        </span>
      );
  }
}

/** Under Run: missing models (with the Download button) and errors. */
function Panel() {
  const { phase, download } = useBrowserRun();
  if (phase.name === "error") return <InlineNotification kind="error" title="Run failed" subtitle={phase.message} lowContrast hideCloseButton />;
  if (phase.name !== "missing") return null;
  return (
    <section aria-label="Missing models" className="flex flex-col items-start gap-3 rounded border border-[var(--cds-border-subtle)] p-4">
      <p className="text-sm">
        Your models folder is missing {phase.missing.length === 1 ? "1 file" : `${phase.missing.length} files`} ({gb(phase.bytes)}). They download once
        from Hugging Face (Comfy-Org/Krea-2) into the folder, where ComfyUI can use them too.
      </p>
      <ul className="list-disc pl-5 text-sm text-[var(--cds-text-secondary)]">
        {phase.missing.map((d) => (
          <li key={d.name}>
            {d.folder}/{d.name} · {gb(d.size)}
          </li>
        ))}
      </ul>
      <Button size="sm" onClick={download}>
        Download {gb(phase.bytes)}
      </Button>
    </section>
  );
}
