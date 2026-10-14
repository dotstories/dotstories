# DotStories

What is possible today with AI. Pick a workflow ("dot"), press **Run**, get the exact result. Free, on your own computer.

See [PLAN.md](PLAN.md) for the plan.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit tests (Jest + React Testing Library)
pnpm lint:react   # react-doctor audit (runs in CI)
pnpm test:e2e     # e2e on the Cloudflare runtime (needs `pnpm build:worker` first)
pnpm preview      # run in the Cloudflare Workers runtime locally
```

## Deploy

Every push to `main` runs CI, then deploys to Cloudflare Workers.

One-time setup, in GitHub → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create → "Edit Cloudflare Workers" template |

## Budget stop & reset

Cloudflare has no spending cap: budget alerts only send an email. So `workers/budget-guard` checks every hour:

1. It asks the Analytics API for this month's usage (R2 storage + operations; Workers too if `WORKERS_PAID=true`).
2. It estimates the bill in USD (`src/cost.ts`, with prices from the Cloudflare docs).
3. **From 80%** it logs a warning. **At 100%** (`BUDGET_USD`, 19 ≈ €20 incl. VAT) it stops:
   - it writes a row to `budget_stop` in D1, so the app answers **503 on uploads and `/files`**;
   - it turns off the bucket's public domains that were on (custom domain, r2.dev).
4. If the Analytics API is down, it **never** stops. Data lags, so expect up to ~€1–2 over.

Stored files still cost storage while stopped. The invoice is the source of truth; this is a safety net.

**Setup, once:**

| Step | Where |
|---|---|
| Budget alert email | Cloudflare → Billing → Billable Usage → Create budget alert |
| API token for the guard: **Account Analytics Read** + **Workers R2 Storage Edit** | Cloudflare → My Profile → API Tokens |
| Save it as the GitHub secret `BUDGET_GUARD_API_TOKEN` | the deploy copies it to the guard |

**Reset** (manual only): GitHub → Actions → **Budget reset** → Run workflow. It turns back on what the stop turned off and removes the stop. Raise `BUDGET_USD` in `workers/budget-guard/wrangler.jsonc` first if the month is still over budget, or it stops again within the hour.

**Try it locally:**

```bash
echo 'CF_API_TOKEN=<token>' > workers/budget-guard/.dev.vars
pnpm exec wrangler d1 migrations apply DB --local -c workers/budget-guard/wrangler.jsonc
pnpm exec wrangler dev --test-scheduled -c workers/budget-guard/wrangler.jsonc --var ACCOUNT_ID:<id> --var BUDGET_USD:0
curl "http://localhost:8787/__scheduled"   # BUDGET_USD 0 → stops; a high budget → nothing
```

## License

DotStories is licensed under the [GNU Affero General Public License v3.0](LICENSE).
