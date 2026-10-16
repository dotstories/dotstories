# DotStories

What is possible today with AI. Pick a workflow ("dot"), press **Run**, get the exact result. Free, on your own computer.

See [PLAN.md](PLAN.md) for the plan.

## Run it locally

**You need:** [Node.js 24](https://nodejs.org) and [pnpm](https://pnpm.io/installation) (`corepack enable` installs the version in `package.json`).

```bash
git clone https://github.com/Dayonel/dotstories.git
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

## Deploy

Every push to `main` runs CI, then deploys to Cloudflare Workers.

One-time setup, in GitHub → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create → "Edit Cloudflare Workers" template |
| `ZEPTOMAIL_TOKEN` | ZeptoMail (zoho.eu) → Agents → your agent → SMTP/API → API → **Send Mail Token**. Sign-up codes and password resets. Prepaid credits, keep **Auto top-up off**: no surprise bills. |

## License

DotStories is licensed under the [GNU Affero General Public License v3.0](LICENSE).
