import type { MusicDot } from "../dot";

// TODO(author): replace prompt + seed with the ones that made sample.flac.
export const darkFantasyMusic: MusicDot = {
  slug: "dark-fantasy-orchestral",
  name: "Dark Fantasy Orchestral",
  description: "Rich orchestral dark fantasy tracks that stay coherent with the album. For games and ambient channels.",
  kind: "music",
  engine: "stable-audio-3",
  cover: "/demo/weeping-gate.jpg",
  author: { name: "Dayonel", url: "https://github.com/Dayonel" },
  license: {
    name: "Stability AI Community License",
    url: "https://stability.ai/community-license-agreement",
    commercial: "Commercial use allowed under $1M yearly revenue",
  },
  forkable: true,
  source: "https://github.com/Dayonel/dotstories/tree/main/public/dots/dark-fantasy-music",
  versions: [
    {
      version: "1.0.0",
      date: "2026-10-13",
      changelog: "Sample track. Running music dots in the app comes with the Stable Audio 3 engine.",
      inputs: {
        prompt: "Dark fantasy orchestral piece, slow and mournful, low strings, distant choir, soft war drums, misty and ancient",
        seed: 0,
        seconds: 30,
        steps: 8,
      },
      sample: "/dots/dark-fantasy-music/sample.flac",
    },
  ],
};
