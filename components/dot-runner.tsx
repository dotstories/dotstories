"use client";

import { Select, SelectItem } from "@carbon/react";
import { useState } from "react";
import { type Dot, latest, sortedVersions, version as findVersion } from "@/lib/dot";
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
      <Demo key={selected} dot={dot} version={selected} />
    </div>
  );
}
