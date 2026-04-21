"""Self-scenarios — scenarios that test Dogfood's own infrastructure.

These scenarios exercise the runner/connector pipeline itself, not a specific
agent capability. They exist to catch regressions in:
  - Scenario lookup by ID/slug
  - Event streaming lifecycle (started → finished)
  - The subprocess bridge between FastAPI and the TS runner
"""

from datetime import datetime, timezone

from app.models.dogfood import (
    ContainsExpectation,
    FailureMode,
    Scenario,
    ScenarioStep,
)

_NOW = datetime.now(timezone.utc)

SELF_SCENARIOS: list[Scenario] = [
    Scenario(
        id="self-001",
        slug="runner-scenario-lookup-001",
        title="Runner scenario lookup smoke test",
        summary="Single-step scenario that verifies the runner can look up a scenario, "
        "start the run, and emit at least a run.started event (not a scenario-not-found error). "
        "Used to catch ID/slug lookup regressions.",
        tags=["self-test", "infrastructure"],
        authorId=None,
        isPublic=True,
        system="You are a test assistant. Respond briefly.",
        latencyBudgetMs=10_000,
        steps=[
            ScenarioStep(
                role="user",
                content="Say exactly: LOOKUP_OK",
                expect=[
                    ContainsExpectation(
                        kind="contains",
                        value="LOOKUP_OK",
                        mode=FailureMode.hallucination,
                    ),
                ],
            ),
        ],
        createdAt=_NOW,
        updatedAt=_NOW,
    ),
]
