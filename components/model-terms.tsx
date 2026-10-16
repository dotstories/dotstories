"use client";

import { Checkbox, Modal } from "@carbon/react";
import Link from "next/link";
import { useState } from "react";
import type { Model } from "@/lib/models";

type Props = { model: Model; open: boolean; onAccept: () => void; onClose: () => void };

/** Before the first run on a model: its terms, and a checkbox. Run waits until it's ticked. */
export default function ModelTerms({ model, open, onAccept, onClose }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <Modal
      open={open}
      modalHeading={`${model.name} · terms of use`}
      primaryButtonText="Accept and run"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!agreed}
      onRequestSubmit={() => agreed && onAccept()}
      onRequestClose={onClose}
      size="md"
    >
      <div className="flex flex-col gap-4 text-sm">
        <p>
          This dot runs <strong>{model.name}</strong> by {model.maker} on your computer. Before the first run, please read the main points
          of its license. The full texts always apply.
        </p>
        <ul className="flex flex-col gap-2">
          {model.points.map((p) => (
            <li key={p.title}>
              <strong>{p.title}.</strong> {p.text}
            </li>
          ))}
        </ul>
        <p>
          Read the full{" "}
          <a className="cds--link" href={model.license.url} target="_blank" rel="noreferrer">
            {model.license.name}
          </a>{" "}
          and the{" "}
          <a className="cds--link" href={model.card} target="_blank" rel="noreferrer">
            model card
          </a>
          . On DotStories, sexual, unlawful or policy-violating content is never allowed (
          <Link className="cds--link" href="/terms">
            Terms
          </Link>
          ). Report harmful outputs to {model.report ?? "us"}. See{" "}
          <Link className="cds--link" href={`/models/${model.engine}`} target="_blank">
            all key points
          </Link>
          .
        </p>
        {model.gated && (
          <p className="text-[var(--cds-text-secondary)]">
            {model.maker} also asks you to accept these terms once on Hugging Face, where the model is downloaded from.
            We&apos;ll show you how after this step.
          </p>
        )}
        <Checkbox
          id={`terms-${model.engine}`}
          labelText={`I have read and agree to the ${model.license.name} and will use ${model.name} only as it allows.`}
          checked={agreed}
          onChange={(_, { checked }) => setAgreed(checked)}
        />
      </div>
    </Modal>
  );
}
