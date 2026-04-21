# Contributing to Dogfood

Welcome. Dogfood is a playground for **breaking AI agents** — so the most
valuable contribution you can make is a **new way to break them**.

## The four kinds of contribution, ranked by leverage

### 1. 🥇 Contribute a scenario (easiest · highest impact · your name on the leaderboard)

A scenario is a multi-step conversation designed to surface a specific
failure mode in any AI agent. Every scenario in this repo becomes a public
test that every agent in the leaderboard has to face, forever.

**You don't need to know TypeScript, Python, or anything about the runner.**
You just need to know how to break an LLM.

👉 See **[`docs/scenarios/CONTRIBUTING-A-SCENARIO.md`](docs/scenarios/CONTRIBUTING-A-SCENARIO.md)**
for the 10-minute walkthrough. Template at
[`docs/scenarios/_template.yaml`](docs/scenarios/_template.yaml).

The best scenarios are:

- **Reproducible** — you can run them with `pnpm scenario <slug>` and get
  the same failure on the same agent most of the time
- **Specific** — target one failure mode (hallucination, tool_misuse, etc.)
- **Short** — 2–5 steps is the sweet spot
- **Real** — based on a failure you actually saw in production, a paper,
  a thread, or your own hair-pulling

### 2. 🥈 Add a connector

Right now Dogfood speaks OpenAI, Anthropic, any OpenAI-compatible endpoint,
and OpenClaw. Mistral, Groq, Cohere, Together, Fireworks, local Ollama — all
would be welcome. Connectors are ~150 lines in
[`packages/connectors/src/`](packages/connectors/src/) and have a
`ConnectorKind`-typed interface.

👉 See [`docs/connectors/ADD-A-CONNECTOR.md`](docs/connectors/ADD-A-CONNECTOR.md).

### 3. 🥉 Report a failure mode

If you find an agent behavior we're not currently classifying — a new flavor
of hallucination, a confidence-calibration bug, a tone regression after
long context, a tool-description-poisoning trick — open a
[failure-mode issue](../../issues/new?template=failure-mode.md). Even if
you don't have code, the classification itself is valuable.

### 4. 🔧 Pick up a good-first-issue

See [`ISSUES.md`](ISSUES.md) or the [`good first issue`](../../labels/good%20first%20issue)
label. Core plumbing, UI polish, DX improvements.

---

## Setup for code contributions

```bash
git clone https://github.com/avasis-ai/dogfood
cd dogfood
pnpm install
pnpm build        # internal packages must build before typecheck
pnpm typecheck
pnpm lint
```

For the Python API:

```bash
cd apps/api
uv sync
uv run pytest -q
```

Pre-push checklist (CI will enforce this):

```bash
pnpm build && pnpm typecheck && pnpm lint
cd apps/api && uv run ruff check . && uv run mypy app
```

---

## How we review PRs

- **Scenario PRs**: one of the maintainers will run your scenario against
  GPT-4o, Claude Sonnet, and OpenClaw, and paste the scores into the PR.
  If it reliably produces a failure on at least one, it merges.
- **Connector PRs**: must pass `pnpm --filter @dogfood/connectors typecheck`
  and have at least one round-trip test against the real provider (we'll
  help you if you don't have an API key).
- **Core code PRs**: CI must be green + one review. Keep PRs small and
  scoped to one concern.

Maintainers are listed in [`CODEOWNERS`](.github/CODEOWNERS). Expect a first
response within 48 hours.

---

## Code of Conduct

See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Be kind, especially to
first-time contributors.

---

## License

By contributing, you agree your contributions will be licensed under the
repo's [MIT License](LICENSE).
