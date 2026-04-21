<!--
Thanks for contributing! Pick the section that matches your PR and delete the others.
-->

## 📝 Scenario PR

**Slug**: `...`
**Failure mode targeted**: hallucination / refusal / latency / tool_misuse / context_loss / tone_drift

**Which agents have you observed this break on?**
- [ ] GPT-4o / GPT-4o-mini
- [ ] Claude Sonnet 4 / Claude Opus
- [ ] OpenClaw (GLM)
- [ ] Other: ___

**Repro rate you observed**: ~__%

**Inspiration / link(s)**:

---

## 🔌 Connector PR

**Provider**: ___
**API shape**: OpenAI-compatible / Anthropic-shaped / custom

**Tested against real provider?**
- [ ] Yes — successful round-trip
- [ ] Partial — attached logs
- [ ] No — no credentials, draft PR for maintainer smoke-test

---

## 🛠️ Core / fix / other

**What does this change?**

**Linked issue**: Closes #

**Trade-offs / alternatives considered**:

---

## Checklist (all PR types)

- [ ] `pnpm build && pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `apps/api` Python checks: `uv run ruff check . && uv run mypy app`
- [ ] Docs updated if behavior changed
- [ ] No secrets, `.env`, or unrelated file changes
