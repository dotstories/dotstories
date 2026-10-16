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
  /** Credit the license asks us to show. */
  attribution?: string;
  points: { title: string; text: string }[];
  /** Key points of the model card, shown in the Terms. */
  summary: {
    use: string;
    outOfScope: string;
    training: string;
    safety: string;
    risks: string;
    outputs: string;
    support?: string; // general questions
  };
  repo: string; // Hugging Face
  gated: boolean; // Hugging Face asks people to accept the terms there too, with their own account
  report?: string; // where to report harmful results; without it, people report to us
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
    summary: {
      use: "Krea 2 makes images from text descriptions. It is meant for creative, commercial, developer and research work: image generation, concepts, design exploration, visual production and use inside apps and creative tools.",
      outOfScope: "Anything that breaks the law, infringes other people's rights, or makes or helps make unlawful or harmful content, including child sexual abuse material (CSAM), non-consensual intimate images, harassment and defamation. Also not for fully automated decisions that harm people's legal rights. Krea's Acceptable Use Policy and the Krea 2 Community License apply and win if anything here differs.",
      training: "Trained on a mix of public data, data licensed from third parties and synthetic data, images with their captions. Before training, Krea filtered out certain harmful, low-quality and duplicate data.",
      safety: "Krea fine-tuned the model to resist harmful prompts and tested it internally and externally, including for sexual content, non-consensual intimate images and child safety. Because the weights are open, Krea can't control how it is used: anyone who deploys it must filter content or review it to stop unlawful or policy-violating results. Krea may update the weights or revoke access when it sees misuse.",
      risks: "It is new technology. Results can't be predicted, may be inaccurate, objectionable or not match your prompt, and the testing can't cover every case. It is not a source of facts.",
      outputs: "Krea claims no rights over what you make. You alone are responsible for your images and how you use them, including any third-party rights a prompt may touch. Commercial use follows the Krea 2 Community License.",
      support: "support@krea.ai",
    },
    repo: "krea/Krea-2-Turbo",
    gated: true,
    report: "safety@krea.ai",
  },
  "stable-audio-3": {
    engine: "stable-audio-3",
    name: "Stable Audio 3",
    maker: "Stability AI",
    termsVersion: "1.0", // model card May 2026, Acceptable Use Policy July 31, 2025, license July 5, 2024
    license: { name: "Stability AI Community License", url: "https://stability.ai/community-license-agreement" },
    card: "https://huggingface.co/stabilityai/stable-audio-3-medium",
    aup: "https://stability.ai/use-policy",
    attribution: "Powered by Stability AI",
    points: [
      {
        title: "Intended use",
        text: "Making music and sound effects from text, and editing or continuing audio.",
      },
      {
        title: "Age",
        text: "You must be 18 or older, or the legal age where you live if that is higher (Stability AI's policy).",
      },
      {
        title: "Not allowed",
        text: "Anything unlawful or harmful, including breaking copyright or privacy, sexual content, anything that sexualizes minors, hate, harassment, impersonation and misinformation.",
      },
      {
        title: "Commercial use",
        text: "Allowed under the Stability AI Community License (free under $1M yearly revenue; commercial users register with Stability AI).",
      },
      {
        title: "Your audio",
        text: "You own what you make, as far as the law allows. You are responsible for it and how you use it.",
      },
      {
        title: "Limits",
        text: "Results can't be predicted and may not match your prompt. Prompts are in English.",
      },
    ],
    summary: {
      use: "Stable Audio 3 makes music and sound effects from text, and can edit or continue a piece of audio. Its open models (Small SFX, Small and Medium) run on your own computer; Medium makes the most musical and longest tracks, up to about six minutes.",
      outOfScope: "Anything Stability AI's Acceptable Use Policy forbids, including breaking the law or other people's rights (such as copyright and privacy), any sexual content involving minors, non-consensual intimate content, content showing sexual acts, hate, harassment, encouraging self-harm, impersonation, misinformation, and getting around safety measures. You must be 18 or older, or the legal age where you live if that is higher. Outputs may not be used to train other foundation AI models. Stability AI's policy and license win if anything here differs.",
      training: "Trained on about 1.3 million recordings: audio licensed from AudioSparx, and Creative Commons recordings from Freesound (CC0, CC BY and CC Sampling+). Before training, Stability AI checked the music in the data and removed copyrighted content it found. The Freesound recordings are credited on Stability AI's attributions page, linked from the model card.",
      safety: "Stability AI says the models are trained responsibly on licensed data; the model card lists no further safety tests. Its Acceptable Use Policy also applies when you run the model yourself, and Stability AI may end access for people who break it. Because the weights are open, what you make with them is your responsibility.",
      risks: "It is new technology. Results can't be predicted and may not match your prompt or sound the way you expect. Prompts are in English. The largest model (Large) is not open and doesn't run in DotStories.",
      outputs: "You own the audio you make, as far as the law allows, and may use it commercially. The license is free for people and organizations under US$1M yearly revenue; above that, you need a license from Stability AI, and commercial users must register with Stability AI. The model's text encoder (T5Gemma) is also under Google's Gemma Terms of Use.",
    },
    repo: "stabilityai/stable-audio-3-medium",
    gated: true,
  },
};

export const modelFor = (dot: Pick<Dot, "engine">) => MODELS[dot.engine];

/** What an acceptance is stored under: model + terms version. */
export const termsKey = (m: Model) => `${m.engine}@${m.termsVersion}`;
