import { fireEvent, render, screen } from "@testing-library/react";
import AudioPlayer from "../components/audio-player";
import { formatTime } from "../lib/time";

beforeAll(() => {
  // jsdom has no media playback
  window.HTMLMediaElement.prototype.play = function () {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function () {
    this.dispatchEvent(new Event("pause"));
  };
});

const audio = () => document.querySelector("audio") as HTMLAudioElement;

/** jsdom doesn't load media: give the element a length and a settable position. */
const loaded = (seconds: number) => {
  Object.defineProperty(audio(), "duration", { value: seconds, configurable: true });
  Object.defineProperty(audio(), "currentTime", { value: 0, writable: true, configurable: true });
  fireEvent(audio(), new Event("loadedmetadata"));
};

describe("formatTime", () => {
  it("formats like 0:07 / 1:11", () => {
    expect(formatTime(7)).toBe("0:07");
    expect(formatTime(71)).toBe("1:11");
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
  });
});

describe("AudioPlayer", () => {
  it("shows the title and a play button", () => {
    render(<AudioPlayer src="/a.flac" title="The Weeping Gate" />);
    expect(screen.getByText("The Weeping Gate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("toggles play and pause", () => {
    render(<AudioPlayer src="/a.flac" title="t" />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("shows time once playing, like 0:07 / 1:11", () => {
    render(<AudioPlayer src="/a.flac" title="t" />);
    loaded(71);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    audio().currentTime = 7;
    fireEvent(audio(), new Event("timeupdate"));
    expect(screen.getByText("0:07 / 1:11")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "7");
  });

  it("seeks with the arrow keys", () => {
    render(<AudioPlayer src="/a.flac" title="t" />);
    loaded(71);
    fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), { key: "ArrowRight" });
    expect(audio().currentTime).toBe(5);
  });

  it("knows the length even if the browser loaded it before React started", () => {
    const proto = window.HTMLMediaElement.prototype;
    const ready = Object.getOwnPropertyDescriptor(proto, "readyState");
    const length = Object.getOwnPropertyDescriptor(proto, "duration");
    Object.defineProperty(proto, "readyState", { get: () => 1, configurable: true });
    Object.defineProperty(proto, "duration", { get: () => 30, configurable: true });
    try {
      render(<AudioPlayer src="/a.flac" title="t" />);
      expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuemax", "30");
    } finally {
      if (ready) Object.defineProperty(proto, "readyState", ready);
      if (length) Object.defineProperty(proto, "duration", length);
    }
  });
});
