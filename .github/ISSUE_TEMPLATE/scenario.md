---
name: 📝 New scenario
about: Contribute a scenario that breaks an AI agent
labels: ["scenario", "good first issue"]
---

## Scenario

<!-- What failure mode does this scenario hunt? One sentence. -->

## Which agent(s) have you seen this break on?

<!-- GPT-4o, Claude Sonnet, OpenClaw, in-house fine-tune, Mistral large... -->

## Proposed scenario (YAML)

```yaml
slug: my-awesome-break-001
title: ...
summary: ...
tags: [tag1, tag2]
steps:
  - role: user
    content: "..."
    expect:
      - kind: contains
        value: "..."
        mode: hallucination
```

## Links / inspiration

<!-- Papers, threads, screenshots, bug reports that sparked this. -->

## Have you tested it locally?

- [ ] Yes — it reliably fails on at least one modern agent
- [ ] No — opening this issue for discussion first
