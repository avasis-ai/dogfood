/**
 * OpenClaw connector — uses OpenAI-compatible HTTP endpoint.
 *
 * Posts to `/v1/chat/completions` (SSE streaming) on the OpenClaw gateway.
 * Gateway endpoint must be enabled: gateway.http.endpoints.chatCompletions.enabled=true
 *
 * Config:
 *   endpoint: "http://127.0.0.1:18789"  (or https:// in prod)
 *   headers.Authorization: "Bearer <gateway-token>"
 *   model: e.g. "zai/glm-5.1" (maps to OpenAI model field as "openclaw:<model>")
 */
import type { ConnectorConfig } from "@dogfood/shared";
import type {
  Connector,
  ConnectorEvent,
  ConnectorRunOptions,
  NormalizedMessage,
} from "./index";

interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export function openclawConnector(config: ConnectorConfig): Connector {
  const wsEndpoint = config.endpoint ?? "ws://127.0.0.1:18789";
  // Convert ws:// to http://, wss:// to https://
  const baseUrl = wsEndpoint.replace(/^ws/, "http").replace(/^wss/, "https");
  const token = config.headers?.Authorization ?? config.apiKey;
  // OpenAI chat.completions endpoint
  const apiUrl = `${baseUrl}/v1/chat/completions`;

  return {
    kind: "openclaw",

    async ping() {
      try {
        const res = await fetch(`${baseUrl}/health`, {
          method: "GET",
          headers: token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : {},
        });
        if (res.ok) {
          return { ok: true, detail: `connected to ${apiUrl}` };
        }
        return { ok: false, detail: `health check failed: ${res.status}` };
      } catch (err) {
        return { ok: false, detail: (err as Error).message };
      }
    },

    async *stream(
      messages: NormalizedMessage[],
      opts?: ConnectorRunOptions,
    ): AsyncIterable<ConnectorEvent> {
      const started = performance.now();
      const controller = new AbortController();
      opts?.signal?.addEventListener("abort", () => controller.abort());

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`;
        }
        // Agent ID header (optional, defaults to "main" on gateway)
        headers["x-openclaw-agent-id"] = "main";

        // Model field in OpenAI format maps to OpenClaw model via "openclaw:<model>" or just the model string
        const requestBody = {
          model: config.model,
          stream: true,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            tool_call_id: m.role === "tool" ? m.toolCallId : undefined,
          })),
        };

        const res = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorText = await res.text();
          yield {
            kind: "error",
            error: `HTTP ${res.status}: ${errorText}`,
          };
          return;
        }

        if (!res.body) {
          yield { kind: "error", error: "no response body" };
          return;
        }

        // Read SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE lines (data: <json>)
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            if (trimmed === "data: [DONE]") {
              yield {
                kind: "done",
                latencyMs: Math.round(performance.now() - started),
              };
              return;
            }

            const jsonStr = trimmed.slice(6); // Remove "data: " prefix
            try {
              const chunk = JSON.parse(jsonStr) as ChatCompletionChunk;
              if (!chunk.choices?.[0]) continue;

              const choice = chunk.choices[0];
              const delta = choice.delta;

              // Text delta
              if (delta.content) {
                yield { kind: "text", delta: delta.content };
              }

              // Tool call delta
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.type === "function") {
                    // Parse arguments (may come in chunks)
                    let args: Record<string, unknown> = {};
                    if (tc.function.arguments) {
                      try {
                        args = JSON.parse(tc.function.arguments);
                      } catch {
                        // Arguments may be partial, accumulate when needed
                        args = {};
                      }
                    }
                    yield {
                      kind: "tool_call",
                      call: {
                        id: tc.id,
                        name: tc.function.name,
                        arguments: args,
                      },
                    };
                  }
                }
              }

              // Stream finished
              if (choice.finish_reason) {
                yield {
                  kind: "done",
                  latencyMs: Math.round(performance.now() - started),
                };
                return;
              }
            } catch (err) {
              console.warn("Failed to parse SSE chunk:", err, jsonStr);
            }
          }
        }

        yield {
          kind: "error",
          error: "stream ended without done",
        };
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return; // Client aborted
        }
        yield {
          kind: "error",
          error: (err as Error).message,
        };
      }
    },
  };
}
