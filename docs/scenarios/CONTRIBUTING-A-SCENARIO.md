# Contribute a scenario

A scenario is the highest-leverage contribution you can make to Dogfood.
No code. No TypeScript. No Python. Just a YAML file describing a way
you've found to break an AI agent.

This walkthrough takes about 10 minutes.

---

## 1. Fork + clone

```bash
gh repo fork avasis-ai/dogfood --clone
cd dogfood
```

## 2. Copy the template

```bash
cp docs/scenarios/_template.yaml docs/scenarios/my-awesome-break-001.yaml
```

Use a kebab-case slug with a short topic and a numeric suffix. Examples
from the seed set:

- `openclaw-tool-stress-001`
- `memory-span-001`
- `adversarial-jailbreak-001`

## 3. Describe the conversation

Open your new YAML file. Fill in:

- **`title`**: a sharp one-line name — "Agent confuses kg and pounds"
- **`summary`**: why this scenario exists; the failure it's hunting
- **`tags`**: 1–3 curated tags (`tool-calling`, `memory`, `adversarial`,
  `context-loss`, `tone`, `math`, `coding`, `multi-turn`)
- **`system`**: optional system prompt (leave empty to use the default)
- **`steps`**: 2–5 user turns with `expect` blocks

## 4. Write good expectations

Each step's `expect` is a list of assertions evaluated *after* the
agent's response. An expectation kind + the **failure mode** it belongs
to if it fails.

```yaml
expect:
  - kind: contains
    value: "kilograms"
    mode: hallucination      # if agent says "pounds" that's a hallucination

  - kind: tool_called
    name: unit_convert
    mode: tool_misuse        # if agent didn't call the tool: tool_misuse

  - kind: max_latency_ms
    value: 5000
    mode: latency            # if it took >5s: latency
```

### Expectation kinds

| kind | shape | what it does |
| - | - | - |
| `contains` | `{value, mode}` | response must contain substring |
| `not_contains` | `{value, mode}` | response must NOT contain substring |
| `regex` | `{pattern, mode}` | response must match regex |
| `tool_called` | `{name, mode}` | agent must invoke this tool |
| `tool_not_called` | `{name, mode}` | agent must NOT invoke this tool |
| `max_latency_ms` | `{value, mode}` | response under N ms |
| `judge` | `{rubric, mode}` | LLM-as-judge nuanced check |

### The 6 failure modes

Every expectation picks one to credit if it fails:

- `hallucination` — made-up facts, APIs, citations
- `refusal` — refuses a reasonable request
- `latency` — too slow
- `tool_misuse` — wrong tool, missing call, bad args
- `context_loss` — forgets earlier turns
- `tone_drift` — unprofessional / off-brand shift

## 5. Test it locally (optional but strong-signal)

Start Dogfood locally and run your scenario against any connector you
have credentials for:

```bash
pnpm install && pnpm build
pnpm api:dev                             # terminal 1
pnpm --filter @dogfood/web dev           # terminal 2

# In a third terminal — run your scenario via CLI
OPENAI_API_KEY=sk-...  pnpm tsx scripts/run-scenario.ts my-awesome-break-001
```

Tweak expectations until your scenario fails on at least one real agent
**and** passes on a hypothetical perfect agent.

## 6. Open a PR

```bash
git checkout -b scenario/my-awesome-break-001
git add docs/scenarios/my-awesome-break-001.yaml
git commit -m "scenario: my-awesome-break-001 — <one-line>"
git push origin scenario/my-awesome-break-001
gh pr create --template scenario
```

In the PR description, tell us:

- Which agent(s) you've seen this break on
- Why the failure mode is interesting
- Any links (papers, threads, screenshots) that inspired it

## 7. What happens next

A maintainer will:

1. Run your scenario against GPT-4o, Claude Sonnet, and OpenClaw on our
   side and paste the scores into the PR
2. If it reliably produces a failure on at least one modern agent, merge
3. Seed it into `apps/api/app/seeds/scenarios.py` so it appears on the
   public leaderboard
4. Credit you in the PR, the leaderboard, and the changelog

---

## Principles for great scenarios

- **One failure mode per scenario.** Don't test memory AND tools AND
  tone in the same file. Split them.
- **2–5 steps is the sweet spot.** Longer scenarios fail for boring
  reasons (context overflow) instead of interesting ones.
- **Reproducible, not flaky.** A scenario that fails 5% of the time is
  noise. Aim for ≥80% repro rate.
- **Hard for modern agents.** If GPT-4o and Claude Sonnet both pass on
  first try, it's probably too easy — raise the bar.
- **Real, not synthetic.** The best scenarios come from production bugs,
  papers (reversal curse, red-teaming), or your own pain. Pure-synthetic
  scenarios are often easy to game.

---

Questions? Open an [issue](../../issues/new?template=question.md) or
ping [@avasis-ai](https://github.com/avasis-ai) on the PR.
