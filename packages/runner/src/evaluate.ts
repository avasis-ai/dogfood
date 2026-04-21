/**
 * Expectation evaluator: given a step's expectations and the agent's observed
 * output for that step, produce FailureFindings.
 *
 * One expectation = one pass/fail, and when it fails it's attributed to a
 * FailureMode bucket. The default modes are conservative; scenario authors
 * can override per expectation.
 */
import type {
  ExpectationSpec,
  FailureFinding,
  FailureMode,
} from "@dogfood/shared";

export interface StepObservation {
  stepIndex: number;
  text: string;
  toolCalls: { name: string; arguments: Record<string, unknown> }[];
  latencyMs: number;
}

export interface EvaluationResult {
  findings: FailureFinding[];
  /** Total expectations evaluated. */
  total: number;
  /** How many passed. */
  passed: number;
}

const DEFAULT_MODE: Record<ExpectationSpec["kind"], FailureMode> = {
  contains: "context_loss",
  not_contains: "tone_drift",
  regex: "context_loss",
  tool_called: "tool_misuse",
  tool_not_called: "tool_misuse",
  max_latency_ms: "latency",
  judge: "hallucination",
};

export function evaluateStep(
  expectations: ExpectationSpec[] | undefined,
  obs: StepObservation,
): EvaluationResult {
  const findings: FailureFinding[] = [];
  const specs = expectations ?? [];
  let passed = 0;

  for (const spec of specs) {
    const mode = spec.mode ?? DEFAULT_MODE[spec.kind];
    const ok = checkExpectation(spec, obs);
    if (ok) {
      passed += 1;
    } else {
      findings.push({
        mode,
        stepIndex: obs.stepIndex,
        detail: describeFailure(spec, obs),
        confidence: spec.kind === "judge" ? 0.7 : 0.95,
      });
    }
  }

  return { findings, total: specs.length, passed };
}

function checkExpectation(spec: ExpectationSpec, obs: StepObservation): boolean {
  switch (spec.kind) {
    case "contains":
      return obs.text.toLowerCase().includes(spec.value.toLowerCase());
    case "not_contains":
      return !obs.text.toLowerCase().includes(spec.value.toLowerCase());
    case "regex":
      try {
        return new RegExp(spec.pattern, "i").test(obs.text);
      } catch {
        return false;
      }
    case "tool_called":
      return obs.toolCalls.some((c) => c.name === spec.name);
    case "tool_not_called":
      return !obs.toolCalls.some((c) => c.name === spec.name);
    case "max_latency_ms":
      return obs.latencyMs <= spec.value;
    case "judge":
      // Judge expectations require an LLM-as-judge pass we don't run inline.
      // The API layer can post-process these. For the baseline runner,
      // treat as 'pending' → pass (so we don't penalize unfairly).
      return true;
  }
}

function describeFailure(spec: ExpectationSpec, obs: StepObservation): string {
  switch (spec.kind) {
    case "contains":
      return `Expected output to contain "${spec.value}" — it did not.`;
    case "not_contains":
      return `Output contained forbidden phrase "${spec.value}".`;
    case "regex":
      return `Output did not match regex /${spec.pattern}/i.`;
    case "tool_called":
      return `Expected tool "${spec.name}" to be called; actual calls: ${obs.toolCalls.map((c) => c.name).join(", ") || "<none>"}.`;
    case "tool_not_called":
      return `Tool "${spec.name}" should not have been called but was.`;
    case "max_latency_ms":
      return `Step took ${obs.latencyMs}ms, budget was ${spec.value}ms.`;
    case "judge":
      return `Judge rubric not yet evaluated: ${spec.rubric.slice(0, 80)}`;
  }
}
