"use client";

import { PauseFilled, PlayFilledAlt } from "@carbon/icons-react";
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/time";


/** Player bar like the Stable Audio guide: play square · title · time, the bar fills as it plays. */
export default function AudioPlayer({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const started = playing || time > 0;

  // The browser may load the metadata before React is ready: read it on mount too.
  useEffect(() => {
    const a = ref.current;
    if (a && a.readyState >= 1 && Number.isFinite(a.duration)) setDuration(a.duration);
  }, []);

  const toggle = () => (playing ? ref.current?.pause() : ref.current?.play());
  const seekTo = (t: number) => {
    if (!ref.current || !duration) return;
    ref.current.currentTime = Math.min(duration, Math.max(0, t));
    setTime(ref.current.currentTime);
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - r.left) / r.width) * duration);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") seekTo(time + 5);
    if (e.key === "ArrowLeft") seekTo(time - 5);
  };

  return (
    <div className="audio-player" role="group" aria-label={`Audio player: ${title}`}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
      />
      <button type="button" className="audio-player__button" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
        {playing ? <PauseFilled size={20} /> : <PlayFilledAlt size={20} />}
      </button>
      <div
        className="audio-player__track"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(time)}
        aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
        onClick={onClick}
        onKeyDown={onKey}
      >
        <div className="audio-player__played" style={{ width: duration ? `${(time / duration) * 100}%` : 0 }} />
        <span className="audio-player__title">{title}</span>
        {started && (
          <span className="audio-player__time">
            {formatTime(time)} / {formatTime(duration)}
          </span>
        )}
      </div>
    </div>
  );
}
