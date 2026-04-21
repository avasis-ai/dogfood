import OpenAI from "openai";
import type { ConnectorConfig } from "@dogfood/shared";
import type {
  Connector,
  ConnectorEvent,
  ConnectorRunOptions,
  NormalizedMessage,
} from "./index";

export function openaiConnector(config: ConnectorConfig): Connector {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint, // openai_compatible uses this; vanilla openai ignores
    defaultHeaders: config.headers,
  });

  return {
    kind: config.kind,

    async ping() {
      try {
        const models = await client.models.list();
        return { ok: true, detail: `models: ${models.data.length}` };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },

    async *stream(
      messages: NormalizedMessage[],
      opts?: ConnectorRunOptions,
    ): AsyncIterable<ConnectorEvent> {
      const started = performance.now();
      try {
        const stream = await client.chat.completions.create(
          {
            model: config.model,
            stream: true,
            messages: messages.map(toOpenAI),
          },
          { signal: opts?.signal },
        );

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;
          const delta = choice.delta;

          if (delta?.content) {
            yield { kind: "text", delta: delta.content };
          }
          const toolCalls = delta?.tool_calls ?? [];
          for (const tc of toolCalls) {
            if (tc.function?.name && tc.id) {
              yield {
                kind: "tool_call",
                call: {
                  id: tc.id,
                  name: tc.function.name,
                  arguments: safeJson(tc.function.arguments ?? "{}"),
                },
              };
            }
          }
        }

        yield { kind: "done", latencyMs: Math.round(performance.now() - started) };
      } catch (err) {
        yield { kind: "error", error: (err as Error).message };
      }
    },
  };
}

function toOpenAI(m: NormalizedMessage) {
  if (m.role === "tool") {
    return {
      role: "tool" as const,
      tool_call_id: m.toolCallId,
      content: m.content,
    };
  }
  if (m.role === "assistant") {
    return {
      role: "assistant" as const,
      content: m.content,
      tool_calls: m.toolCalls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return { _raw: s };
  }
}
