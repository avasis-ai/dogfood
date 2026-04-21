import Anthropic from "@anthropic-ai/sdk";
import type { ConnectorConfig } from "@dogfood/shared";
import type {
  Connector,
  ConnectorEvent,
  ConnectorRunOptions,
  NormalizedMessage,
} from "./index";

export function anthropicConnector(config: ConnectorConfig): Connector {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
    defaultHeaders: config.headers,
  });

  return {
    kind: config.kind,

    async ping() {
      try {
        // Anthropic doesn't expose a cheap list models endpoint for all tiers;
        // do a 1-token probe instead.
        await client.messages.create({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        });
        return { ok: true, detail: "probe ok" };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },

    async *stream(
      messages: NormalizedMessage[],
      opts?: ConnectorRunOptions,
    ): AsyncIterable<ConnectorEvent> {
      const started = performance.now();
      const system = messages.find((m) => m.role === "system");
      const nonSystem = messages.filter((m) => m.role !== "system");

      try {
        const stream = client.messages.stream(
          {
            model: config.model,
            max_tokens: 4096,
            system: system?.content,
            messages: nonSystem
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.role === "assistant" ? m.content : m.content,
              })),
          },
          { signal: opts?.signal },
        );

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            yield { kind: "text", delta: event.delta.text };
          }
          if (
            event.type === "content_block_start" &&
            event.content_block.type === "tool_use"
          ) {
            yield {
              kind: "tool_call",
              call: {
                id: event.content_block.id,
                name: event.content_block.name,
                arguments: (event.content_block.input ?? {}) as Record<
                  string,
                  unknown
                >,
              },
            };
          }
        }

        yield { kind: "done", latencyMs: Math.round(performance.now() - started) };
      } catch (err) {
        yield { kind: "error", error: (err as Error).message };
      }
    },
  };
}
