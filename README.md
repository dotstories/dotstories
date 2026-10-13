# DotStories

What is possible today with AI. Pick a workflow ("dot"), press **Run**, get the exact result. Free, on your own computer.

See [PLAN.md](PLAN.md) for the plan.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit tests (Jest + React Testing Library)
pnpm test:e2e     # e2e tests (Playwright, needs `pnpm build` first)
pnpm preview      # run in the Cloudflare Workers runtime locally
```

## Deploy

Every push to `main` runs CI, then deploys to Cloudflare Workers.

One-time setup, in GitHub → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID (right sidebar) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create → "Edit Cloudflare Workers" template |

## License

DotStories is licensed under the [GNU Affero General Public License v3.0](LICENSE).
