# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities to **security@avasis.ai**.
Do **not** open a public GitHub issue for security reports.

We will:

1. Acknowledge your report within **48 hours**
2. Investigate and provide an initial assessment within **7 days**
3. Work with you on a coordinated disclosure timeline
4. Credit you in the release notes if you'd like (opt-in)

## Scope

In scope:

- Dogfood web (Next.js) app
- Dogfood API (FastAPI)
- `packages/connectors` — credential handling, SSRF surface, prompt-injection escape hatches
- Dependency vulnerabilities (supply-chain)

Out of scope:

- Social engineering
- Denial-of-service via raw traffic volume
- Anything requiring physical access to a developer's machine

## Safe harbor

We consider good-faith security research conducted in accordance with
this policy to be authorized. We will not pursue legal action against
researchers who act in good faith, avoid privacy violations, and give us
reasonable time to fix issues before public disclosure.
