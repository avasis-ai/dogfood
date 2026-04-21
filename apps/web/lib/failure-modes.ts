export const FAILURE_MODE_COLORS: Record<string, string> = {
  hallucination: "#ef4444",
  refusal: "#f59e0b",
  latency: "#8b5cf6",
  tool_misuse: "#06b6d4",
  context_loss: "#10b981",
  tone_drift: "#ec4899",
};

export const FAILURE_MODE_LABELS: Record<string, string> = {
  hallucination: "Hallucination",
  refusal: "Refusal",
  latency: "Latency",
  tool_misuse: "Tool misuse",
  context_loss: "Context loss",
  tone_drift: "Tone drift",
};

export const ALL_MODES = [
  "hallucination",
  "refusal",
  "latency",
  "tool_misuse",
  "context_loss",
  "tone_drift",
] as const;
