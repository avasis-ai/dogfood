/**
 * Judge post-pass — calls an LLM to evaluate agent responses against a
 * structured rubric for nuanced failure detection (hallucination, tone drift,
 * context loss) that deterministic expectations can't catch.
 *
 * Opt-in: only runs if OPENAI_API_KEY or ANTHROPIC_API_KEY is set.
 * Findings are marked with confidence < 0.9 to distinguish from deterministic ones.
 */
import type { FailureFinding, FailureMode } from "@dogfood/shared";
import type { StepObservation } from "./evaluate";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o-mini";
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_BASE =
  process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

const JUDGE_ENABLED = !!(OPENAI_KEY || ANTHROPIC_KEY);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface JudgeRubricResult {
  pass: boolean;
  mode: FailureMode;
  detail: string;
  confidence: number;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Run the LLM judge on a step observation.
 * Returns zero or more FailureFindings.
 *
 * This is a *post-pass*: it runs AFTER evaluateStep, and only on steps
 * that have judge expectations or where the caller wants a general audit.
 */
export async function judgeStep(
  agentResponse: string,
  rubric: string,
  stepIndex: number,
  opts?: { systemPrompt?: string; conversationHistory?: string },
): Promise<FailureFinding[]> {
  if (!JUDGE_ENABLED) return [];

  try {
    const result = await callJudgeLLM(agentResponse, rubric, opts);
    if (result.pass) return [];

    return [
      {
        mode: result.mode,
        stepIndex,
        detail: result.detail,
        confidence: Math.min(result.confidence, 0.89), // Always < 0.9 per spec
      },
    ];
  } catch (err) {
    // Judge failures are non-fatal — return empty rather than crashing the run.
    if (process.env.JUDGE_DEBUG) {
      console.error("[judge] LLM call failed:", err);
    }
    return [];
  }
}

/**
 * General audit: ask the judge to look at a step response for any failure
 * modes, even without a specific rubric. Used for post-hoc analysis.
 */
export async function judgeAudit(
  agentResponse: string,
  stepIndex: number,
  opts?: { systemPrompt?: string; conversationHistory?: string },
): Promise<FailureFinding[]> {
  if (!JUDGE_ENABLED) return [];

  const auditRubric = `Analyze this agent response for failure modes:
- Hallucination: Did the agent invent facts, APIs, or code that don't exist?
- Tone drift: Did the agent's tone shift unprofessionally (become sycophantic, robotic, or adversarial)?
- Context loss: Did the agent forget or contradict earlier conversation context?
- Refusal: Did the agent refuse a legitimate, safe request?
- Tool misuse: Did the agent call tools incorrectly or use wrong tools for the task?

Return JSON.`;

  try {
    const result = await callJudgeLLM(agentResponse, auditRubric, opts);
    if (result.pass) return [];

    return [
      {
        mode: result.mode,
        stepIndex,
        detail: `[audit] ${result.detail}`,
        confidence: Math.min(result.confidence, 0.85), // Audits are lower confidence
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Check if the judge is enabled (API keys present).
 */
export function isJudgeEnabled(): boolean {
  return JUDGE_ENABLED;
}

/* ------------------------------------------------------------------ */
/* LLM call                                                            */
/* ------------------------------------------------------------------ */

async function callJudgeLLM(
  agentResponse: string,
  rubric: string,
  opts?: { systemPrompt?: string; conversationHistory?: string },
): Promise<JudgeRubricResult> {
  const systemPrompt = `You are a Dogfood judge. You evaluate AI agent responses for failure modes.
You MUST respond with valid JSON only, no markdown, no explanation outside the JSON.

Valid failure modes: "hallucination", "refusal", "latency", "tool_misuse", "context_loss", "tone_drift"

Response format:
{"pass": true}  — if the response passes the rubric
{"pass": false, "mode": "<failure_mode>", "detail": "<one sentence>", "confidence": 0.0-1.0}  — if it fails

Be strict but fair. Only flag genuine failures, not stylistic preferences.`;

  const contextParts: string[] = [];
  if (opts?.systemPrompt) {
    contextParts.push(`Agent system prompt: ${opts.systemPrompt}`);
  }
  if (opts?.conversationHistory) {
    contextParts.push(
      `Prior conversation: ${opts.conversationHistory.slice(-2000)}`,
    );
  }

  const userPrompt = `${contextParts.join("\n\n")}${
    contextParts.length ? "\n\n" : ""
  }Evaluation rubric: ${rubric}

Agent response to evaluate:
"""
${agentResponse.slice(-4000)}
"""`;

  const body = {
    model: JUDGE_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 300,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let url: string;

  if (OPENAI_KEY) {
    headers["Authorization"] = `Bearer ${OPENAI_KEY}`;
    url = `${OPENAI_BASE}/chat/completions`;
  } else {
    // Anthropic via OpenAI-compatible proxy or direct
    headers["x-api-key"] = ANTHROPIC_KEY!;
    headers["anthropic-version"] = "2023-06-01";
    url = `${OPENAI_BASE}/chat/completions`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Judge API ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  return parseJudgeResponse(content);
}

/* ------------------------------------------------------------------ */
/* Response parser                                                     */
/* ------------------------------------------------------------------ */

function parseJudgeResponse(raw: string): JudgeRubricResult {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (parsed.pass === true) {
      return { pass: true, mode: "hallucination", detail: "", confidence: 0 };
    }

    const validModes = [
      "hallucination",
      "refusal",
      "latency",
      "tool_misuse",
      "context_loss",
      "tone_drift",
    ];

    const mode = validModes.includes(parsed.mode) ? parsed.mode : "hallucination";
    const detail =
      typeof parsed.detail === "string" && parsed.detail.trim()
        ? parsed.detail.trim()
        : "Judge flagged a failure but provided no detail.";
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7;

    return { pass: false, mode, detail, confidence };
  } catch {
    // If the LLM didn't return valid JSON, treat as pass to avoid false positives.
    return { pass: true, mode: "hallucination", detail: "", confidence: 0 };
  }
}
