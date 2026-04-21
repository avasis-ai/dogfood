"""Dogfood Pydantic models — 1:1 mirror of packages/shared/src/types.ts.

Names are kept identical to the TypeScript definitions:
  Scenario, ScenarioStep, ExpectationSpec, Run, RunEvent, RunScore,
  FailureFinding, ConnectorConfig, RunStatus, ConnectorKind, FailureMode.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Failure modes (mirrors failure-modes.ts)
# ---------------------------------------------------------------------------

class FailureMode(str, Enum):
    hallucination = "hallucination"
    refusal = "refusal"
    latency = "latency"
    tool_misuse = "tool_misuse"
    context_loss = "context_loss"
    tone_drift = "tone_drift"


FAILURE_MODES: list[FailureMode] = list(FailureMode)


# ---------------------------------------------------------------------------
# Connector kinds & config
# ---------------------------------------------------------------------------

class ConnectorKind(str, Enum):
    openai = "openai"
    anthropic = "anthropic"
    openai_compatible = "openai_compatible"
    openclaw = "openclaw"


class ConnectorConfig(BaseModel):
    kind: ConnectorKind
    label: str = Field(min_length=1, max_length=60)
    endpoint: Optional[str] = None
    api_key: Optional[str] = Field(default=None, alias="apiKey", exclude=True)
    model: str = Field(min_length=1)
    headers: Optional[dict[str, str]] = None

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Expectations
# ---------------------------------------------------------------------------

class ContainsExpectation(BaseModel):
    kind: Literal["contains"]
    value: str = Field(min_length=1)
    mode: Optional[FailureMode] = None


class NotContainsExpectation(BaseModel):
    kind: Literal["not_contains"]
    value: str = Field(min_length=1)
    mode: Optional[FailureMode] = None


class RegexExpectation(BaseModel):
    kind: Literal["regex"]
    pattern: str = Field(min_length=1)
    mode: Optional[FailureMode] = None


class ToolCalledExpectation(BaseModel):
    kind: Literal["tool_called"]
    name: str = Field(min_length=1)
    mode: Optional[FailureMode] = None


class ToolNotCalledExpectation(BaseModel):
    kind: Literal["tool_not_called"]
    name: str = Field(min_length=1)
    mode: Optional[FailureMode] = None


class MaxLatencyMsExpectation(BaseModel):
    kind: Literal["max_latency_ms"]
    value: int = Field(gt=0)
    mode: Optional[FailureMode] = None


class JudgeExpectation(BaseModel):
    kind: Literal["judge"]
    rubric: str = Field(min_length=10)
    mode: Optional[FailureMode] = None


ExpectationSpec = (
    ContainsExpectation
    | NotContainsExpectation
    | RegexExpectation
    | ToolCalledExpectation
    | ToolNotCalledExpectation
    | MaxLatencyMsExpectation
    | JudgeExpectation
)


# ---------------------------------------------------------------------------
# Scenario
# ---------------------------------------------------------------------------

class ScenarioStep(BaseModel):
    role: Literal["user", "system", "tool"]
    content: str
    expect: Optional[list[ExpectationSpec]] = None
    latency_budget_ms: Optional[int] = Field(default=None, alias="latencyBudgetMs")

    model_config = {"populate_by_name": True}


class Scenario(BaseModel):
    id: str
    slug: str
    title: str
    summary: str
    tags: list[str]
    author_id: Optional[str] = Field(default=None, alias="authorId")
    is_public: bool = Field(default=True, alias="isPublic")
    system: Optional[str] = None
    latency_budget_ms: Optional[int] = Field(default=None, alias="latencyBudgetMs")
    steps: list[ScenarioStep]
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

class RunStatus(str, Enum):
    pending = "pending"
    running = "running"
    passed = "passed"
    failed = "failed"
    errored = "errored"
    cancelled = "cancelled"


class FailureFinding(BaseModel):
    mode: FailureMode
    step_index: int = Field(alias="stepIndex")
    detail: str
    confidence: float = Field(ge=0, le=1)

    model_config = {"populate_by_name": True}


class RunScore(BaseModel):
    total: int = Field(ge=0, le=100)
    passed: int = Field(ge=0)
    total_expectations: int = Field(alias="totalExpectations", ge=0)
    failure_breakdown: dict[FailureMode, int] = Field(alias="failureBreakdown")

    model_config = {"populate_by_name": True}


class RunEvent(BaseModel):
    seq: int = Field(ge=0)
    ts: str
    kind: Literal[
        "run.started",
        "step.started",
        "agent.message",
        "agent.tool_call",
        "agent.tool_result",
        "step.evaluated",
        "run.finished",
    ]
    step_index: Optional[int] = Field(default=None, alias="stepIndex")
    payload: dict

    model_config = {"populate_by_name": True}


class Run(BaseModel):
    id: str
    scenario_id: str = Field(alias="scenarioId")
    connector_kind: ConnectorKind = Field(alias="connectorKind")
    connector_label: str = Field(alias="connectorLabel")
    model: str
    status: RunStatus
    public_id: str = Field(alias="publicId")
    score: Optional[RunScore] = None
    findings: list[FailureFinding] = Field(default_factory=list)
    events: list[RunEvent] = Field(default_factory=list)
    started_at: datetime = Field(alias="startedAt")
    finished_at: Optional[datetime] = Field(default=None, alias="finishedAt")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# API request models (mirrors schemas.ts)
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    scenario_slug: str = Field(alias="scenarioSlug")
    connector: ConnectorConfig
    scenario_override: Optional[dict] = Field(
        default=None,
        alias="scenarioOverride",
        description="Inline scenario data to use instead of looking up by slug. Must be a complete Scenario dict.",
    )

    model_config = {"populate_by_name": True}
