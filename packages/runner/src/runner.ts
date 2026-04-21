/**
 * Runner engine.
 *
 * Walks a scenario's steps, driving the connector and emitting a stream of
 * RunEvents. Collects StepObservations as it goes and evaluates expectations
 * after each step. At the end, computes a RunScore.
 *
 * This function is an async generator so the API layer can pipe events
 * directly to an SSE stream.
 */
import {
  FAILURE_MODES,
  type FailureFinding,
  type FailureMode,
  type RunEvent,
  type RunScore,
  type Scenario,
} from "@dogfood/shared";
import {
  buildConnector,
  type Connector,
  type ConnectorEvent,
  type NormalizedMessage,
} from "@dogfood/connectors";
import type { ConnectorConfig } from "@dogfood/shared";
import { evaluateStep, type StepObservation } from "./evaluate";
import { judgeStep, isJudgeEnabled } from "./judge";

export interface RunnerResult {
  score: RunScore;
  findings: FailureFinding[];
}

export async function* runScenario(
  scenario: Scenario,
  connectorConfig: ConnectorConfig,
  opts: { signal?: AbortSignal } = {},
): AsyncGenerator<RunEvent, RunnerResult, void> {
  let seq = 0;
  const emit = (ev: Omit<RunEvent, "seq" | "ts">): RunEvent => ({
    seq: seq++,
    ts: new Date().toISOString(),
    ...ev,
  });

  const connector: Connector = buildConnector(connectorConfig);
  const history: NormalizedMessage[] = [];
  if (scenario.system) {
    history.push({ role: "system", content: scenario.system });
  }

  yield emit({
    kind: "run.started",
    payload: {
      scenario: scenario.slug,
      connector: connectorConfig.kind,
      model: connectorConfig.model,
    },
  });

  const allFindings: FailureFinding[] = [];
  let totalExpectations = 0;
  let passedExpectations = 0;

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    if (!step) continue;

    // Only 'user' steps advance the conversation; 'system' becomes pre-system
    // if it appears mid-scenario, 'tool' rows are test fixtures (rare).
    if (step.role === "system") {
      history.push({ role: "system", content: step.content });
      continue;
    }
    if (step.role === "tool") {
      // Inject a synthetic tool result for the previous tool_call in history.
      const lastCall = findLastToolCallId(history);
      if (lastCall) {
        history.push({
          role: "tool",
          toolCallId: lastCall,
          content: step.content,
        });
      }
      continue;
    }

    history.push({ role: "user", content: step.content });
    yield emit({
      kind: "step.started",
      stepIndex: i,
      payload: { role: step.role, content: step.content },
    });

    let stepText = "";
    const toolCalls: StepObservation["toolCalls"] = [];
    let latencyMs = 0;
    let errored: string | null = null;

    for await (const ev of connector.stream(history, { signal: opts.signal })) {
      const projected = projectConnectorEvent(ev, i);
      if (projected) yield emit(projected);

      if (ev.kind === "text") stepText += ev.delta;
      if (ev.kind === "tool_call") {
        toolCalls.push({ name: ev.call.name, arguments: ev.call.arguments });
      }
      if (ev.kind === "done") latencyMs = ev.latencyMs;
      if (ev.kind === "error") errored = ev.error;
    }

    history.push({ role: "assistant", content: stepText });

    const budget = step.latencyBudgetMs ?? scenario.latencyBudgetMs;
    const obs: StepObservation = {
      stepIndex: i,
      text: stepText,
      toolCalls,
      latencyMs,
    };
    const expectations = step.expect ?? [];
    // If a global latency budget exists and the step has no explicit one,
    // synthesize a latency expectation so every step is timed.
    const fullExpectations =
      budget && !expectations.some((e) => e.kind === "max_latency_ms")
        ? [
            ...expectations,
            { kind: "max_latency_ms" as const, value: budget },
          ]
        : expectations;

    const evalResult = evaluateStep(fullExpectations, obs);
    totalExpectations += evalResult.total;
    passedExpectations += evalResult.passed;
    allFindings.push(...evalResult.findings);

    // Judge post-pass: run LLM-as-judge on any judge expectations.
    if (isJudgeEnabled()) {
      const judgeExps = fullExpectations.filter((e) => e.kind === "judge");
      for (const jExp of judgeExps) {
        const rubric = (jExp as { kind: "judge"; rubric: string }).rubric;
        const judgeFindings = await judgeStep(stepText, rubric, i, {
          systemPrompt: scenario.system,
          conversationHistory: history.map((m) => m.content).join("\n"),
        });
        if (judgeFindings.length > 0) {
          allFindings.push(...judgeFindings);
          // Judge findings don't change the passed/total count — they're advisory.
        }
      }
    }

    // If the connector errored, surface it as a tool_misuse/latency finding.
    if (errored) {
      allFindings.push({
        mode: "latency",
        stepIndex: i,
        detail: `Connector error: ${errored}`,
        confidence: 1,
      });
    }

    yield emit({
      kind: "step.evaluated",
      stepIndex: i,
      payload: {
        latencyMs,
        passed: evalResult.passed,
        total: evalResult.total,
        findings: evalResult.findings,
      },
    });
  }

  const score = buildScore(totalExpectations, passedExpectations, allFindings);
  yield emit({
    kind: "run.finished",
    payload: { score, findingCount: allFindings.length },
  });

  return { score, findings: allFindings };
}

function projectConnectorEvent(
  ev: ConnectorEvent,
  stepIndex: number,
): Omit<RunEvent, "seq" | "ts"> | null {
  switch (ev.kind) {
    case "text":
      return {
        kind: "agent.message",
        stepIndex,
        payload: { delta: ev.delta },
      };
    case "tool_call":
      return {
        kind: "agent.tool_call",
        stepIndex,
        payload: { call: ev.call },
      };
    case "tool_result":
      return {
        kind: "agent.tool_result",
        stepIndex,
        payload: { toolCallId: ev.toolCallId, result: ev.result },
      };
    case "done":
    case "error":
      return null;
  }
}

function findLastToolCallId(history: NormalizedMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m?.role === "assistant" && m.toolCalls?.length) {
      return m.toolCalls[m.toolCalls.length - 1]?.id ?? null;
    }
  }
  return null;
}

function buildScore(
  total: number,
  passed: number,
  findings: FailureFinding[],
): RunScore {
  const breakdown = Object.fromEntries(
    FAILURE_MODES.map((m) => [m, 0]),
  ) as Record<FailureMode, number>;
  for (const f of findings) breakdown[f.mode] += 1;
  const ratio = total === 0 ? 1 : passed / total;
  return {
    total: Math.round(ratio * 100),
    passed,
    totalExpectations: total,
    failureBreakdown: breakdown,
  };
}
