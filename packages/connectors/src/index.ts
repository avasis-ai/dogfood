/**
 * Connector = the standardized harness we wrap around any agent so the
 * runner can drive it the same way regardless of vendor.
 *
 * A connector exposes `stream()` which accepts a message history and emits
 * normalized events (`text`, `tool_call`, `tool_result`, `done`, `error`).
 * The runner, not the connector, owns expectations and scoring.
 */
import type { ConnectorConfig } from "@dogfood/shared";
import { openaiConnector } from "./openai";
import { anthropicConnector } from "./anthropic";
import { openclawConnector } from "./openclaw";

export type NormalizedMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: NormalizedToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type ConnectorEvent =
  | { kind: "text"; delta: string }
  | { kind: "tool_call"; call: NormalizedToolCall }
  | { kind: "tool_result"; toolCallId: string; result: string }
  | { kind: "done"; latencyMs: number; rawTokenUsage?: TokenUsage }
  | { kind: "error"; error: string };

export interface TokenUsage {
  prompt?: number;
  completion?: number;
  total?: number;
}

export interface ConnectorRunOptions {
  signal?: AbortSignal;
  /** Deadline in ms after which the connector should abort and emit error. */
  timeoutMs?: number;
}

export interface Connector {
  kind: ConnectorConfig["kind"];
  /** Simple sanity check that the connector is reachable with these creds. */
  ping(): Promise<{ ok: boolean; detail?: string }>;
  /**
   * Send the current message history and stream events back.
   * Implementations MUST emit a terminal `done` OR `error` event.
   */
  stream(
    messages: NormalizedMessage[],
    opts?: ConnectorRunOptions,
  ): AsyncIterable<ConnectorEvent>;
}

export function buildConnector(config: ConnectorConfig): Connector {
  switch (config.kind) {
    case "openai":
      return openaiConnector(config);
    case "anthropic":
      return anthropicConnector(config);
    case "openai_compatible":
      return openaiConnector(config);
    case "openclaw":
      return openclawConnector(config);
    default: {
      const _exhaustive: never = config.kind;
      throw new Error(`Unknown connector kind: ${_exhaustive as string}`);
    }
  }
}
