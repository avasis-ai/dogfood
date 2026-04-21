"""Background runner — spawns node scripts/run-scenario.mjs and pipes events.

Reads JSON-lines from the child process stdout, parses each as a RunEvent,
and pushes it into the run store's event queue so SSE can stream it to
clients in real time.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone

from app.models.dogfood import FailureFinding, RunEvent, RunScore, RunStatus
from app.seeds.scenarios import SEED_SCENARIOS
from app.seeds.self_scenarios import SELF_SCENARIOS
from app.services.run_store import run_store

# All in-memory scenarios (seed + self-test).
_ALL_SCENARIOS = list(SEED_SCENARIOS) + list(SELF_SCENARIOS)

# Resolve paths relative to the repo root.
# __file__ = <repo>/apps/api/app/services/runner.py
_SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))  # apps/api/app/services
_API_DIR = os.path.dirname(os.path.dirname(_SERVICES_DIR))  # apps/api
_REPO_ROOT = os.path.dirname(os.path.dirname(_API_DIR))  # dogfood
_SCRIPT_PATH = os.path.join(_REPO_ROOT, "scripts", "run-scenario.ts")


def _find_scenario(scenario_slug: str) -> dict | None:
    """Look up a scenario by slug from seed + self-test data. Returns dict or None."""
    for s in _ALL_SCENARIOS:
        if s.slug == scenario_slug:
            return s.model_dump(by_alias=True, mode="json")
    return None


async def execute_run(
    public_id: str,
    scenario_slug: str,
    connector_config: dict,
    scenario_override: dict | None = None,
) -> None:
    """Spawn the runner script, stream events, update run state on completion."""
    # Use inline override if provided, otherwise look up by slug.
    if scenario_override is not None:
        scenario = scenario_override
    else:
        scenario = _find_scenario(scenario_slug)
        if scenario is None:
            run_store.update_run(public_id, status=RunStatus.errored)
            await _enqueue_error(public_id, f"Scenario {scenario_slug!r} not found")
            return

    # Mark as running.
    run_store.update_run(public_id, status=RunStatus.running)
    await _enqueue_status(public_id, "run.started", {
        "scenario": scenario.get("slug"),
        "connector": connector_config.get("kind"),
        "model": connector_config.get("model"),
    })

    config_json = json.dumps({"scenario": scenario, "connector": connector_config})

    # Use pnpm exec tsx for workspace-aware module resolution.
    cmd = ["pnpm", "--dir", _REPO_ROOT, "exec", "tsx", _SCRIPT_PATH, config_json]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        score: RunScore | None = None
        findings: list[FailureFinding] = []
        events: list[RunEvent] = []

        # Read stdout line by line.
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            line = line.decode().strip()
            if not line:
                continue

            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            if obj.get("done"):
                # Terminal line with score + findings.
                score = obj.get("score")
                findings = obj.get("findings", [])
                continue

            if obj.get("kind") == "run.error":
                # Mark the run as errored before enqueuing the error event.
                run_store.update_run(
                    public_id,
                    status=RunStatus.errored,
                    events=events,
                    finished_at=datetime.now(timezone.utc),
                )
                await _enqueue_error(public_id, obj.get("error", "Unknown runner error"))
                # Drain remaining output to avoid broken pipe.
                await proc.wait()
                return

            # Regular RunEvent.
            try:
                event = RunEvent.model_validate(obj)
            except Exception:
                # Best-effort: wrap unknown shapes.
                event = RunEvent(
                    seq=obj.get("seq", 0),
                    ts=obj.get("ts", datetime.now(timezone.utc).isoformat()),
                    kind=obj.get("kind", "run.started"),
                    stepIndex=obj.get("stepIndex"),
                    payload=obj.get("payload", {}),
                )
            events.append(event)
            await run_store.enqueue_event(public_id, event)

        await proc.wait()
        stderr_output = (await proc.stderr.read()).decode().strip() if proc.stderr else ""

        if proc.returncode != 0 and not score:
            run_store.update_run(
                public_id,
                status=RunStatus.errored,
                events=events,
            )
            await _enqueue_error(public_id, f"Runner exited {proc.returncode}: {stderr_output[:200]}")
        else:
            status = RunStatus.passed if (score and score.get("total", 0) >= 80) else RunStatus.failed
            run_store.update_run(
                public_id,
                status=status,
                score=score,
                findings=findings,
                events=events,
                finished_at=datetime.now(timezone.utc),
            )
            await _enqueue_status(public_id, "run.finished", {
                "score": score,
                "findingCount": len(findings),
            })

    except Exception as e:
        run_store.update_run(public_id, status=RunStatus.errored)
        await _enqueue_error(public_id, str(e))

    finally:
        q = run_store.get_event_queue(public_id)
        if q:
            await run_store.finish_run(public_id, q)


async def _enqueue_status(public_id: str, kind: str, payload: dict) -> None:
    event = RunEvent(
        seq=0,  # The runner assigns proper seq; this is synthetic.
        ts=datetime.now(timezone.utc).isoformat(),
        kind=kind,
        payload=payload,
    )
    await run_store.enqueue_event(public_id, event)


async def _enqueue_error(public_id: str, detail: str) -> None:
    event = RunEvent(
        seq=0,
        ts=datetime.now(timezone.utc).isoformat(),
        kind="run.finished",
        payload={"error": detail},
    )
    await run_store.enqueue_event(public_id, event)
    q = run_store.get_event_queue(public_id)
    if q:
        await run_store.finish_run(public_id, q)
