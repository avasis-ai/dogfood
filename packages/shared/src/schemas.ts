/**
 * Runtime validators. Mirror the types in ./types.ts. These are the only
 * thing API routes trust — never accept raw JSON without parsing.
 */
import { z } from "zod";
import { FAILURE_MODES } from "./failure-modes";

export const zFailureMode = z.enum(FAILURE_MODES);

export const zExpectation = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("contains"),
    value: z.string().min(1),
    mode: zFailureMode.optional(),
  }),
  z.object({
    kind: z.literal("not_contains"),
    value: z.string().min(1),
    mode: zFailureMode.optional(),
  }),
  z.object({
    kind: z.literal("regex"),
    pattern: z.string().min(1),
    mode: zFailureMode.optional(),
  }),
  z.object({
    kind: z.literal("tool_called"),
    name: z.string().min(1),
    mode: zFailureMode.optional(),
  }),
  z.object({
    kind: z.literal("tool_not_called"),
    name: z.string().min(1),
    mode: zFailureMode.optional(),
  }),
  z.object({
    kind: z.literal("max_latency_ms"),
    value: z.number().int().positive(),
    mode: zFailureMode.optional(),
  }),
  z.object({
    kind: z.literal("judge"),
    rubric: z.string().min(10),
    mode: zFailureMode.optional(),
  }),
]);

export const zScenarioStep = z.object({
  role: z.enum(["user", "system", "tool"]),
  content: z.string(),
  expect: z.array(zExpectation).optional(),
  latencyBudgetMs: z.number().int().positive().optional(),
});

export const zScenarioInput = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().max(500),
  tags: z.array(z.string()).max(12),
  system: z.string().optional(),
  latencyBudgetMs: z.number().int().positive().optional(),
  steps: z.array(zScenarioStep).min(1).max(50),
  isPublic: z.boolean().default(true),
});
export type ScenarioInput = z.infer<typeof zScenarioInput>;

export const zConnectorConfig = z.object({
  kind: z.enum(["openai", "anthropic", "openai_compatible", "openclaw"]),
  label: z.string().min(1).max(60),
  endpoint: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  headers: z.record(z.string()).optional(),
});

export const zRunRequest = z.object({
  scenarioId: z.string().uuid(),
  connector: zConnectorConfig,
});
export type RunRequest = z.infer<typeof zRunRequest>;
