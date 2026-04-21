"""Dogfood API — Pydantic models (1:1 with packages/shared TS types)."""

from app.models.dogfood import (
    ConnectorConfig,
    ConnectorKind,
    ContainsExpectation,
    ExpectationSpec,
    FailureFinding,
    FailureMode,
    JudgeExpectation,
    MaxLatencyMsExpectation,
    NotContainsExpectation,
    RegexExpectation,
    Run,
    RunEvent,
    RunRequest,
    RunScore,
    RunStatus,
    Scenario,
    ScenarioStep,
    ToolCalledExpectation,
    ToolNotCalledExpectation,
)

FAILURE_MODES = list(FailureMode)

__all__ = [
    "ConnectorConfig",
    "ConnectorKind",
    "ContainsExpectation",
    "ExpectationSpec",
    "FailureFinding",
    "FailureMode",
    "JudgeExpectation",
    "MaxLatencyMsExpectation",
    "NotContainsExpectation",
    "RegexExpectation",
    "Run",
    "RunEvent",
    "RunRequest",
    "RunScore",
    "RunStatus",
    "Scenario",
    "ScenarioStep",
    "ToolCalledExpectation",
    "ToolNotCalledExpectation",
    "FAILURE_MODES",
]
