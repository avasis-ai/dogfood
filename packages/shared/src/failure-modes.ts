/**
 * The six canonical failure categories Dogfood detects in every run.
 * Keep these stable — downstream reports, leaderboards, and GitHub-issue
 * templates all depend on the string identifiers.
 */
export const FAILURE_MODES = [
  "hallucination",
  "refusal",
  "latency",
  "tool_misuse",
  "context_loss",
  "tone_drift",
] as const;

export type FailureMode = (typeof FAILURE_MODES)[number];

export const FAILURE_MODE_META: Record<
  FailureMode,
  { label: string; description: string; color: string }
> = {
  hallucination: {
    label: "Hallucination",
    description:
      "The agent invented facts, function names, or API fields not present in the input or tools.",
    color: "#ef4444",
  },
  refusal: {
    label: "Refusal",
    description:
      "The agent declined a legitimate user request or hedged instead of completing the task.",
    color: "#f59e0b",
  },
  latency: {
    label: "Latency",
    description:
      "Response exceeded the scenario's latency budget (p95) or a tool call stalled.",
    color: "#8b5cf6",
  },
  tool_misuse: {
    label: "Tool misuse",
    description:
      "The agent called a tool with malformed arguments, wrong tool for the task, or looped.",
    color: "#06b6d4",
  },
  context_loss: {
    label: "Context loss",
    description:
      "The agent forgot an earlier fact or constraint from the conversation.",
    color: "#10b981",
  },
  tone_drift: {
    label: "Tone drift",
    description:
      "Voice, formality, or persona drifted from the configured system prompt.",
    color: "#ec4899",
  },
};
