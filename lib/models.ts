import type { Dot } from "./dot";

/**
 * The AI models dots run on, with the terms people accept before their first run (one model can
 * serve many dots). Bump `termsVersion` when the model's terms change: everyone is asked again.
 */
export type Model = {
  engine: Dot["engine"];
  name: string;
  maker: string;
  termsVersion: string;
  license: { name: string; url: string };
  card: string; // the model card: capabilities, limits, safety
  aup?: string; // acceptable use policy
  points: { title: string; text: string }[];
  repo: string; // Hugging Face
  gated: boolean; // Hugging Face asks people to accept the terms there too, with their own account
  report: string;
};

export const MODELS: Partial<Record<Dot["engine"], Model>> = {
  "krea2-turbo": {
    engine: "krea2-turbo",
    name: "Krea 2 Turbo",
    maker: "Krea.ai",
    termsVersion: "1.0", // model card v1.0, June 22, 2026
    license: { name: "Krea 2 Community License", url: "https://www.krea.ai/krea-2-licensing" },
    card: "https://huggingface.co/krea/Krea-2-Turbo",
    points: [
      {
        title: "Intended use",
        text: "Making images from text: creative, commercial, developer and research work.",
      },
      {
        title: "Not allowed",
        text: "Anything unlawful or harmful, including sexual content involving minors (CSAM), non-consensual intimate images, harassment, defamation, infringing other people's rights, or fully automated decisions that affect people's legal rights.",
      },
      {
        title: "Commercial use",
        text: "Allowed under the Krea 2 Community License (free under $1M yearly revenue). Read the license for the details.",
      },
      {
        title: "Your images",
        text: "Krea claims no rights over what you make. You are responsible for your images and how you use them, including third-party rights your prompts may touch.",
      },
      {
        title: "Limits",
        text: "Outputs can't be predicted and may be inaccurate, objectionable or not match your prompt. It is not a source of facts.",
      },
    ],
    repo: "krea/Krea-2-Turbo",
    gated: true,
    report: "safety@krea.ai",
  },
};

export const modelFor = (dot: Pick<Dot, "engine">) => MODELS[dot.engine];

/** What an acceptance is stored under: model + terms version. */
export const termsKey = (m: Model) => `${m.engine}@${m.termsVersion}`;
