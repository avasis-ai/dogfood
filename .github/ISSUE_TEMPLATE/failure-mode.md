---
name: 🧨 Failure mode we're not catching
about: Describe agent behavior Dogfood's classifier should catch but doesn't
labels: ["failure-mode", "classifier"]
---

## Agent behavior you observed

<!-- What did the agent do? Paste transcript if you have one. -->

## Why it's a failure

<!-- Why does this matter in production? Who gets hurt? -->

## Which of the 6 modes fits best?

- [ ] hallucination
- [ ] refusal
- [ ] latency
- [ ] tool_misuse
- [ ] context_loss
- [ ] tone_drift
- [ ] None of the above — proposing a **new mode** called ______

## If proposing a new failure mode

- **Name**: `<snake_case>`
- **Label**: "Human-readable label"
- **Color**: `#RRGGBB`
- **Definition**: one sentence
- **Example**: a concrete case
