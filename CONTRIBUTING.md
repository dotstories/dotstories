# Contributing to DotStories

Thanks for helping! DotStories is its community: every fix, idea and dot makes it better.

## Ways to help

- **Report a bug**: open an issue with the steps, what you expected and what happened (browser, OS, GPU help too).
- **Suggest a feature**: open an issue first, so we can agree on the idea before you build it.
- **Fix something**: pick an open issue and say you are on it; `good first issue` ones are a good start.
- **Improve the docs**: typos and unclear steps count.

Security issues: please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Set up

Follow [Run it locally](README.md#run-it-locally). For the desktop app and the Python engine, see
[runner/app](runner/app/README.md) and [runner/engine](runner/engine/README.md).

## How we work

1. **Small PRs**: one problem per PR. Easier to review, faster to merge.
2. **Tests first**: write the failing test, then the code.
   - Website: Jest + React Testing Library (`__tests__/`), Playwright for features (`e2e/`).
   - Engine: `uv run pytest` in `runner/engine`.
3. **Keep it simple**: clean, minimal code and UI. Fix the cause, not the symptom.
4. **CI must be green**: lint, react-doctor, types, unit tests, build, bundle size and e2e.

Before you open a PR:

```bash
pnpm lint && pnpm lint:react && pnpm typecheck && pnpm test
pnpm build:worker && pnpm test:e2e
```

## Commits and PRs

- Use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`.
- PR description: **Summary** (why), **Changes** (what), **Testing** (how you checked).
- Link the issue it closes (`Closes #123`).

## License and CLA

DotStories is licensed under the [AGPL-3.0](LICENSE). Before we merge your first pull request, you sign our
[Contributor License Agreement](https://github.com/dotstories/cla/blob/main/dotstories_icla.md) once, with a comment on
the pull request. A bot tells you how.

## Code of Conduct

Be kind. Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).
