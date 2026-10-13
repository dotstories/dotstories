import type { Dot } from "../dot";

export const darkFantasy: Dot = {
  slug: "dark-fantasy-thumbnail",
  name: "Dark Fantasy Thumbnail",
  description: "A cinematic dark fantasy YouTube thumbnail with title, region, subtitle and quote.",
  kind: "image",
  engine: "krea2-turbo",
  author: { name: "Dayonel", url: "https://github.com/Dayonel" },
  license: {
    name: "Krea 2 Community License",
    url: "https://www.krea.ai/krea-2-licensing",
    commercial: "Commercial use allowed under $1M yearly revenue",
  },
  forkable: true,
  versions: [
    {
      version: "1.0.0",
      date: "2026-10-13",
      changelog: "First version.",
      inputs: {
        prompt:
          "A giant pale stone hand standing perfectly vertical in the center of a dark cave, wrist at the bottom, open palm facing the viewer, all fingers extended straight up toward the ceiling. A single thin beam of violet energy rises straight upward from the fingertips into the darkness. Heavy fog fills the cave floor around the wrist. Simple composition, symmetrical, centered, single focal point, empty dark space around it.",
        style:
          "Lineage 2 inspired Korean MMORPG fantasy art, high fantasy medieval world, ornate elven and human stone architecture with tall slender spires and graceful flowing arches, ancient mystical ruins, dark overcast dusk, thick rolling fog, cold blue-grey and deep violet palette with a few faint golden lights, Unreal Engine cinematic, atmospheric depth, soft volumetric light, painterly realism, subtle film grain",
        seed: 54460995,
        width: 1920,
        height: 1088,
        steps: 8,
      },
      postSteps: [
        {
          type: "shader",
          preset: "Twilight Clear",
          text: {
            title: "The Weeping Gate",
            region: "Hollow Kingdom · Old Royal Road",
            subtitle: "Ashes of the First Kingdom",
            quote: "Mist gathers over the old graves, patient as the dead beneath them.",
          },
        },
      ],
      sample: "/demo/weeping-gate.jpg",
    },
  ],
};
