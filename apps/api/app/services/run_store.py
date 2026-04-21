"""In-memory run store and background run orchestrator.

For local-dev: stores runs in memory. When Supabase is wired in,
this becomes the write-through cache.

The background execution spawns `node scripts/run-scenario.mjs` (T1.7)
and pipes JSON-line events into a per-run queue.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from app.models.dogfood import (
    FailureFinding,
    Run,
    RunEvent,
    RunRequest,
    RunScore,
    RunStatus,
)


class RunStore:
    """Simple dict-backed store for runs and their event queues."""

    def __init__(self) -> None:
        self._runs: dict[str, Run] = {}  # publicId -> Run
        self._event_queues: dict[str, asyncio.Queue[RunEvent | None]] = {}

    def create_run(self, request: RunRequest) -> Run:
        public_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        run = Run(
            id=str(uuid.uuid4()),
            scenarioId=request.scenario_slug,
            connectorKind=request.connector.kind,
            connectorLabel=request.connector.label,
            model=request.connector.model,
            status=RunStatus.pending,
            publicId=public_id,
            score=None,
            findings=[],
            events=[],
            startedAt=now,
            finishedAt=None,
        )
        self._runs[public_id] = run
        self._event_queues[public_id] = asyncio.Queue()
        return run

    def get_run(self, public_id: str) -> Run | None:
        return self._runs.get(public_id)

    def update_run(self, public_id: str, **kwargs: Any) -> Run | None:
        run = self._runs.get(public_id)
        if run is None:
            return None
        for k, v in kwargs.items():
            setattr(run, k, v)
        return run

    def get_event_queue(self, public_id: str) -> asyncio.Queue[RunEvent | None] | None:
        return self._event_queues.get(public_id)

    async def enqueue_event(self, public_id: str, event: RunEvent) -> None:
        q = self._event_queues.get(public_id)
        if q is not None:
            await q.put(event)

    async def finish_run(self, public_id: str, event_queue: asyncio.Queue[RunEvent | None]) -> None:
        """Signal end of event stream by putting None sentinel."""
        await event_queue.put(None)


# Singleton for the app
run_store = RunStore()
