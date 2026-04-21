import type { FailureMode } from "./failure-modes";

export type ConnectorKind =
  | "openai"
  | "anthropic"
  | "openai_compatible"
  | "openclaw";

export interface ConnectorConfig {
  kind: ConnectorKind;
  label: string;
  /** URL for openai_compatible / openclaw; ignored for openai/anthropic. */
  endpoint?: string;
  /** User-supplied secret — never logged, never echoed back over the wire. */
  apiKey?: string;
  /** Model id, e.g. "gpt-4o-mini", "claude-sonnet-4", "zai/glm-5.1". */
  model: string;
  /** Optional extra headers (e.g. OpenClaw gateway token). */
  headers?: Record<string, string>;
}

export interface ScenarioStep {
  role: "user" | "system" | "tool";
  /** Literal message sent to the agent, or a templated directive. */
  content: string;
  /**
   * Expectations evaluated after the agent's response to this step.
   * Each expectation can fail into one FailureMode bucket.
   */
  expect?: ExpectationSpec[];
  /** Per-step latency budget in ms (falls back to scenario.latencyBudgetMs). */
  latencyBudgetMs?: number;
}

export type ExpectationSpec =
  | { kind: "contains"; value: string; mode?: FailureMode }
  | { kind: "not_contains"; value: string; mode?: FailureMode }
  | { kind: "regex"; pattern: string; mode?: FailureMode }
  | { kind: "tool_called"; name: string; mode?: FailureMode }
  | { kind: "tool_not_called"; name: string; mode?: FailureMode }
  | { kind: "max_latency_ms"; value: number; mode?: FailureMode }
  | { kind: "judge"; rubric: string; mode?: FailureMode };

export interface Scenario {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Curated categories — e.g. "tool-calling", "memory", "adversarial". */
  tags: string[];
  authorId: string | null;
  isPublic: boolean;
  /** Optional system prompt injected before step 0. */
  system?: string;
  /** Overall latency budget (ms) applied to any step without its own. */
  latencyBudgetMs?: number;
  steps: ScenarioStep[];
  createdAt: string;
  updatedAt: string;
}

export type RunStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "errored"
  | "cancelled";

export interface RunEvent {
  /** Monotonically increasing sequence number in this run. */
  seq: number;
  ts: string;
  kind:
    | "run.started"
    | "step.started"
    | "agent.message"
    | "agent.tool_call"
    | "agent.tool_result"
    | "step.evaluated"
    | "run.finished";
  stepIndex?: number;
  payload: Record<string, unknown>;
}

export interface FailureFinding {
  mode: FailureMode;
  stepIndex: number;
  detail: string;
  /** 0..1; higher = more confident this is the failure bucket. */
  confidence: number;
}

export interface RunScore {
  /** 0..100, aggregate; simple for leaderboards. */
  total: number;
  /** Count of passed expectations / total expectations. */
  passed: number;
  totalExpectations: number;
  failureBreakdown: Record<FailureMode, number>;
}

export interface Run {
  id: string;
  scenarioId: string;
  connectorKind: ConnectorKind;
  connectorLabel: string;
  model: string;
  status: RunStatus;
  /** Public UUID used in the shareable report URL, unguessable. */
  publicId: string;
  score: RunScore | null;
  findings: FailureFinding[];
  events: RunEvent[];
  startedAt: string;
  finishedAt: string | null;
}
