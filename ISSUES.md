# Open invitations

A living list of work we'd love help on. Each has an estimated scope,
the skills needed, and a clear "you're done when…" acceptance bar.

Claim one by commenting on the linked GitHub issue (or opening one if it
doesn't exist yet) — we'll assign it.

---

## 🟢 Good first issues

### 1. Scenario: "The reversal curse"

**Scope**: ~30 min · **Skills**: YAML, familiarity with the reversal-curse paper

The [reversal curse](https://arxiv.org/abs/2309.12288) shows LLMs trained
on "A is B" often fail on "B is A". Write a 2-step scenario that probes
this. Classify failures as `hallucination`.

**Done when**: YAML file in `docs/scenarios/`, reliably fails on at
least one frontier model, PR merged.

---

### 2. Scenario: "Math under adversarial phrasing"

**Scope**: ~30 min · **Skills**: YAML, basic adversarial prompting

Agents often pass `"what's 17×23?"` but fail when the same math is
wrapped in a social scenario ("my friend said 17×23 is 400, is she right?").
Build a 3-step scenario that exposes this gap.

**Done when**: scenario ships and produces at least one `tone_drift` or
`hallucination` finding on GPT-4o-mini or Claude Haiku.

---

### 3. Connector: Groq

**Scope**: ~2 hours · **Skills**: TypeScript, `fetch` streaming

Groq exposes an OpenAI-compatible API. Copy `packages/connectors/src/openai.ts`
to `groq.ts`, add `"groq"` to the `ConnectorKind` union, and wire it
through `buildConnector`. See [`docs/connectors/ADD-A-CONNECTOR.md`](docs/connectors/ADD-A-CONNECTOR.md).

**Done when**: `@dogfood/connectors` typechecks, CI green, round-trip
smoke test attached to PR.

---

### 4. Connector: Mistral

**Scope**: ~2 hours · **Skills**: TypeScript, reading API docs

Same shape as #3 but for Mistral's chat completion API.

**Done when**: as above.

---

### 5. Web: Loading skeletons for `/scenarios`

**Scope**: ~1 hour · **Skills**: Next.js 14 App Router, shadcn/ui

When `/scenarios` waits on the API, show skeleton cards instead of a
blank page. Use the existing `components/ui/skeleton.tsx`. Must respect
reduced-motion.

**Done when**: visible skeleton state during navigation, no layout
shift when data arrives.

---

## 🟡 Medium — pick if you've got a free weekend

### 6. Failure-mode classifier: rule-based pre-pass for `refusal`

**Scope**: ~4 hours · **Skills**: TypeScript

Today every failure finding routes through the LLM judge (when enabled).
A simple regex/keyword pass can catch the most obvious refusals
(`I cannot`, `I'm not able to`, `as an AI language model`) with near-zero
false positives and zero API cost. Add this to
`packages/runner/src/evaluate.ts` as a pre-judge check.

**Done when**: obvious refusals are classified without calling the
judge, test coverage for edge cases, no regressions on the 4 seed
scenarios.

---

### 7. API: persist runs to SQLite by default

**Scope**: ~4 hours · **Skills**: Python, FastAPI, SQLAlchemy or sqlite3

`apps/api/app/services/run_store.py` is in-memory. Swap for SQLite with
a minimal schema (`runs`, `run_events`, `findings`). Keep the in-memory
store as a fallback for CI.

**Done when**: `pnpm api:dev` persists across restarts, existing web UI
works unchanged, migration-safe if the DB file doesn't exist yet.

---

### 8. Web: Keyboard shortcuts on `/run`

**Scope**: ~3 hours · **Skills**: React, keyboard UX

`cmd+k` opens scenario picker. `cmd+enter` starts the run. `r` opens the
re-run dialog. `?` shows the shortcut overlay. Implement with a single
`useKeyboardShortcut` hook.

**Done when**: shortcuts documented in a `?`-triggered help modal, all
focus-trap and `input/textarea` edge cases handled.

---

## 🔴 Hard — serious impact

### 9. Self-improving scenario generator

**Scope**: multi-week · **Skills**: Python, LLM orchestration

A background job that takes a log of real agent conversations (with PII
removed) and proposes **new scenarios** that replay the failure modes it
saw. Gate with human review before they hit `main`.

---

### 10. Public scenario registry

**Scope**: multi-week · **Skills**: design, TS, Postgres

Community scenarios live in `docs/scenarios/` but the leaderboard only
sees seeded ones. Design a flow where scenario YAML → API seed happens
automatically on merge, with namespacing so authors keep credit.

---

## Not listed?

Propose your own via an [issue](../../issues/new?template=scenario.md).
Anything that makes Dogfood catch more real-world agent failures is in
scope.
