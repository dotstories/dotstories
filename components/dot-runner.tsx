"use client";

import { Select, SelectItem, TextArea } from "@carbon/react";
import { useState } from "react";
import { type Dot, latest, type MusicDot, RUNNABLE_ENGINES, sortedVersions, version as findVersion } from "@/lib/dot";
import AudioPlayer from "./audio-player";
import Demo from "./demo";

/** Dot page: pick a version (latest by default), then run it. */
export default function DotRunner({ dot }: { dot: Dot }) {
  const newest = latest(dot).version;
  const [selected, setSelected] = useState(newest);
  const v = findVersion(dot, selected) ?? latest(dot);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 md:max-w-xs">
        <Select id="version" labelText="Version" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {sortedVersions(dot).map((x) => (
            <SelectItem key={x.version} value={x.version} text={x.version === newest ? `${x.version} (latest)` : x.version} />
          ))}
        </Select>
        <p className="text-sm text-[var(--cds-text-secondary)]">
          {v.date} · <span>{v.changelog}</span>
        </p>
      </div>
      {/* key: a new version starts with its own prompt */}
      {dot.kind === "image" ? (
        <Demo key={selected} dot={dot} version={selected} />
      ) : (
        <MusicPreview key={selected} dot={dot} version={selected} />
      )}
    </div>
  );
}

function MusicPreview({ dot, version }: { dot: MusicDot; version: string }) {
  const v = findVersion(dot, version) ?? latest(dot);
  const runnable = RUNNABLE_ENGINES.includes(dot.engine);
  return (
    <section aria-label="Listen to a dot" className="flex flex-col gap-4">
      <TextArea id="prompt" labelText={`Prompt · ${dot.name}`} value={v.inputs.prompt} readOnly rows={3} />
      <AudioPlayer src={v.sample} title={`${dot.name} · sample`} />
      <p className="text-sm text-[var(--cds-text-secondary)]">
        {runnable ? "" : "Running music dots in the DotStories app is coming soon (Stable Audio 3). "}
        {dot.license.name}: {dot.license.commercial}.
      </p>
    </section>
  );
}
