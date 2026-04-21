# Add a connector

A **connector** wraps any AI-agent endpoint into Dogfood's normalized
event stream. Mistral, Groq, Cohere, Fireworks, Together, local Ollama,
your own in-house proxy — all fit the same shape.

Connectors live in `packages/connectors/src/`. Each one is ~150 lines.

---

## 1. Copy an existing connector as your starting point

| Starting point | When to copy it |
| - | - |
| `openai.ts` | Any OpenAI-compatible `/v1/chat/completions` endpoint (most) |
| `anthropic.ts` | Anthropic Messages API shape or derivatives |
| `openclaw.ts` | Gateway-fronted agents (OpenClaw-style) |

```bash
cp packages/connectors/src/openai.ts packages/connectors/src/mistral.ts
```

## 2. Implement the `Connector` interface

Every connector exports a factory that returns a
`Connector` implementing:

```ts
interface Connector {
  readonly kind: ConnectorKind;
  readonly label: string;
  readonly model: string;
  run(messages: ConnectorMessage[]): AsyncIterable<ConnectorEvent>;
}
```

The `run()` function `yield`s events as they arrive from the provider:

```ts
type ConnectorEvent =
  | { kind: "text"; text: string }
  | { kind: "tool_call"; id: string; name: string; args: unknown }
  | { kind: "tool_result"; id: string; content: unknown }
  | { kind: "done"; stopReason: "end" | "tool_use" | "length" | "error" }
  | { kind: "error"; error: string };
```

The runner doesn't care *how* you get those events — HTTP streaming,
SSE, WebSocket, polling. It only cares that you emit them in order.

## 3. Register your connector kind

Add to `packages/shared/src/types.ts`:

```ts
export type ConnectorKind =
  | "openai"
  | "anthropic"
  | "openai_compatible"
  | "openclaw"
  | "mistral";   //  ← yours
```

And to `packages/connectors/src/index.ts`:

```ts
import { createMistralConnector } from "./mistral";

export function buildConnector(config: ConnectorConfig): Connector {
  switch (config.kind) {
    case "openai": return createOpenAIConnector(config);
    case "anthropic": return createAnthropicConnector(config);
    case "openai_compatible": return createOpenAIConnector(config);
    case "openclaw": return createOpenClawConnector(config);
    case "mistral": return createMistralConnector(config);
  }
}
```

## 4. Typecheck

```bash
pnpm --filter @dogfood/connectors typecheck
```

Fix any `noImplicitAny` or strict-mode issues before moving on.

## 5. Round-trip smoke test

Ideally you have API credentials. Write a quick standalone script or add
a scenario under `docs/scenarios/` that hits your provider:

```bash
MISTRAL_API_KEY=... pnpm tsx scripts/run-scenario.ts openclaw-tool-stress-001
# or whatever slug maps to a generic prompt
```

If you don't have credentials, open the PR as `Draft`, explain what you
couldn't test, and a maintainer will smoke-test on their side.

## 6. Update the README status table + connector docs

Add your connector to the connectors list in:

- `README.md` — bulleted list under *What is this?*
- `CONTRIBUTING.md` — "Add a new connector" section

## 7. Open a PR

```bash
git checkout -b connector/mistral
git add packages/connectors/src/mistral.ts packages/shared/src/types.ts packages/connectors/src/index.ts README.md
git commit -m "connector: add Mistral"
gh pr create --template connector
```

---

## Design principles

- **Normalize, don't expose.** If Mistral returns `function_call` and
  Anthropic returns `tool_use`, both become `tool_call` in the event
  stream. The runner should never see provider shape.
- **Stream if the provider supports it.** Dogfood's UX promise is *live*
  event feeds. Don't buffer the whole response if SSE is available.
- **Fail loudly.** On auth errors, rate limits, malformed JSON — emit
  `{kind: "error", error: <actionable message>}` and stop. Don't swallow.
- **Zero secrets in the repo.** Config carries `apiKey`; the key comes
  from env. Never hardcode.
