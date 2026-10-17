# DotStories

**What is possible today with AI.** Share AI workflows ("dots"), and run them with one click on your own computer.

A prompt alone is rarely enough. A dot is the whole workflow: the model, the prompt, the seed, the settings and the steps
after it (like adding a title and effects to an image). Anyone can run a dot and get the same result, for free, on their own
hardware. Think CodePen, but for AI workflows.

[Website](https://dotstories.com) · [Blog](https://blog.dotstories.com) · [Discord](https://discord.gg/TJWKQkkuHN) · [X](https://x.com/dotstoriescom)

## Features

- **One-click runs**: the DotStories app installs Python, the libraries and the model, then runs the dot on your GPU (or CPU).
- **Uses what you already have**: models already downloaded by ComfyUI or Hugging Face are found and reused.
- **Versions**: authors fix and improve their dots; you pick the latest version or an older one.
- **Share and fork**: every dot has a link to share; public dots can be forked.
- **Community**: likes, views and comments.
- **Model terms first**: before the first run of a model, you read and accept its license and key points.

## Models

| Model | Maker | License |
|---|---|---|
| Krea 2 Turbo (images) | Krea.ai | [Krea 2 Community License](https://www.krea.ai/krea-2-licensing) |
| Stable Audio 3 (music, runs in the app soon) | Stability AI | [Stability AI Community License](https://stability.ai/community-license-agreement) · Powered by Stability AI |

Models are downloaded from their official sources; DotStories doesn't host model weights. Key points of each model:
[dotstories.com/terms](https://dotstories.com/terms).

## Run it locally

**You need:** [Node.js 24](https://nodejs.org) and [pnpm](https://pnpm.io/installation) (`corepack enable` installs the version in `package.json`).

```bash
git clone https://github.com/dotstories/dotstories.git
cd dotstories
pnpm install
pnpm db:migrate:local   # local secrets + local database (run again after pulling new migrations)
pnpm dev                # http://localhost:3000
```

`pnpm db:migrate:local` does two things:

- **Secrets:** creates `.env.local` (for `pnpm dev`) and `.dev.vars` (for `pnpm preview`) with a random `AUTH_SECRET`. Both are gitignored. It only adds missing values and never overwrites yours.
- **Database:** applies `migrations/` to a local D1 database in `.wrangler/` (SQLite on your disk, nothing in the cloud).

Locally, emails (sign-up codes, password resets) are printed in the terminal instead of sent, and uploads go to a local R2 bucket.

**Optional: Google / GitHub login.** Add your own OAuth app keys to `.env.local`: `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET`. Without them, those buttons are hidden and email login works.

**Running a dot** needs the DotStories app on your computer: see [runner/app](runner/app/README.md) and [runner/engine](runner/engine/README.md).

### Troubleshooting

| Error | Fix |
|---|---|
| `MissingSecret: Please define a secret` | Run `pnpm db:migrate:local`, then restart `pnpm dev`. |
| `Failed query: select … from "dot_stats"` (or another table) | The local database is missing tables: `pnpm db:migrate:local`. |
| `GET http://127.0.0.1:47761/info net::ERR_CONNECTION_REFUSED` in the console | Normal: the DotStories app isn't running. |
| Strange build errors after `pnpm install` | Stop `pnpm dev`, delete `.next`, start again. |

## Develop

```bash
pnpm dev          # http://localhost:3000
pnpm test         # unit tests (Jest + React Testing Library)
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm lint:react   # react-doctor audit (runs in CI)
pnpm build:worker # build for Cloudflare Workers
pnpm test:e2e     # Playwright e2e on the Cloudflare runtime (needs `pnpm build:worker` first)
pnpm preview      # run in the Cloudflare Workers runtime locally (http://localhost:8787)
```

## Project layout

| Folder | What |
|---|---|
| `app/`, `components/`, `lib/`, `store/` | The website (Next.js on Cloudflare Workers) |
| `runner/app/` | The desktop app that runs dots ([README](runner/app/README.md)) |
| `runner/engine/` | The Python engine inside the app ([README](runner/engine/README.md)) |
| `workers/` | Extra Cloudflare Workers |
| `blog/` | blog.dotstories.com |
| `migrations/` | Database (Cloudflare D1) migrations |
| `__tests__/`, `e2e/` | Unit tests (Jest) and end-to-end tests (Playwright) |

## Deploy

Every push to `main` runs CI, then deploys to Cloudflare Workers. To deploy your own copy, add these in GitHub → Settings →
Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create → "Edit Cloudflare Workers" template |
| `ZEPTOMAIL_TOKEN` | ZeptoMail → Agents → your agent → SMTP/API → API → Send Mail Token (sign-up codes, password resets) |

## Contributing

Contributions are welcome: code, docs, bug reports and dots. Start with [CONTRIBUTING.md](CONTRIBUTING.md).
Everyone in the community follows the [Code of Conduct](CODE_OF_CONDUCT.md).

Found a security issue? Please don't open a public issue: see [SECURITY.md](SECURITY.md).

## License

DotStories is licensed under the [GNU Affero General Public License v3.0](LICENSE). Contributions are covered by our
[Contributor License Agreement](https://github.com/dotstories/cla/blob/main/dotstories_icla.md).
