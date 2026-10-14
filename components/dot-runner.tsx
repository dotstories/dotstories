"use client";

import { Select, SelectItem, TextArea } from "@carbon/react";
import { type Dot, latest, type MusicDot, RUNNABLE_ENGINES, sortedVersions, version as findVersion } from "@/lib/dot";
import { type DotState, inputsFor } from "@/lib/dot-state";
import { useDotState } from "@/lib/use-dot-state";
import type { DotStats } from "@/lib/stats";
import ActionBar from "./action-bar";
import AudioPlayer from "./audio-player";
import Demo from "./demo";

/** Pick a version (latest by default), change inputs, run. Everything is kept in the URL. */
export default function DotRunner({
  dot,
  initial = {},
  showVersions = true,
  stats,
}: {
  dot: Dot;
  initial?: DotState;
  showVersions?: boolean;
  stats?: DotStats; // set: show comments, share, likes and views
}) {
  const [state, update] = useDotState(dot, initial);
  const newest = latest(dot).version;
  const v = (state.v && findVersion(dot, state.v)) || latest(dot);

  return (
    <div className="flex flex-col gap-6">
      {stats && <ActionBar dot={dot} state={state} stats={stats} />}
      {showVersions && (
        <div className="flex flex-col gap-2 md:max-w-xs">
          <Select
            id="version"
            labelText="Version"
            value={v.version}
            // A new version starts from its own prompt and seed.
            onChange={(e) => update({ v: e.target.value, prompt: undefined, seed: undefined })}
          >
            {sortedVersions(dot).map((x) => (
              <SelectItem key={x.version} value={x.version} text={x.version === newest ? `${x.version} (latest)` : x.version} />
            ))}
          </Select>
          <p className="text-sm text-[var(--cds-text-secondary)]">
            {v.date} · <span>{v.changelog}</span>
          </p>
        </div>
      )}
      {dot.kind === "image" ? (
        <Demo dot={dot} version={v.version} inputs={inputsFor(dot, state)} onChange={update} />
      ) : (
        <MusicPreview dot={dot} version={v.version} />
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
