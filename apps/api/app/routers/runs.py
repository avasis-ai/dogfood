"""POST /runs, GET /runs/{publicId}, GET /runs/{publicId}/events (SSE)."""

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from app.models.dogfood import RunRequest
from app.services.runner import execute_run
from app.services.run_store import run_store

router = APIRouter()


@router.post("")
async def create_run(body: RunRequest) -> JSONResponse:
    """Start a background run, return {publicId, status} immediately.

    The run is created in 'pending' state. A background asyncio task
    spawns `node scripts/run-scenario.mjs` to drive execution.
    """
    run = run_store.create_run(body)

    # Fire-and-forget background execution.
    connector_dict = body.connector.model_dump(by_alias=True, mode="json")
    scenario_override = (
        body.scenario_override if body.scenario_override is not None else None
    )
    asyncio.create_task(
        execute_run(
            run.public_id,
            body.scenario_slug,
            connector_dict,
            scenario_override=scenario_override,
        )
    )

    return JSONResponse(
        status_code=201,
        content={"publicId": run.public_id, "status": run.status.value},
    )


@router.get("/{publicId}")
async def get_run(publicId: str) -> JSONResponse:
    """Return the terminal snapshot (score, findings) for a completed run."""
    run = run_store.get_run(publicId)
    if run is None:
        return JSONResponse(content={"detail": "Run not found"}, status_code=404)
    return JSONResponse(content=run.model_dump(by_alias=True, mode="json"))


@router.get("/{publicId}/events")
async def stream_run_events(publicId: str, request: Request) -> EventSourceResponse:
    """Stream RunEvents as SSE for a live run.

    Drains the run's event queue, yielding each event as an SSE `data:` frame.
    The stream ends when the background runner pushes a None sentinel
    (meaning the run has finished/errored) or when the client disconnects.
    """

    async def event_generator():
        q = run_store.get_event_queue(publicId)
        if q is None:
            # Run doesn't exist — send a single error event and close.
            yield {"event": "error", "data": json.dumps({"detail": "Run not found"})}
            return

        while True:
            # Check if client disconnected.
            if await request.is_disconnected():
                break

            try:
                # Wait for the next event, with a keepalive timeout.
                item = await asyncio.wait_for(q.get(), timeout=15.0)
            except asyncio.TimeoutError:
                # Send a keepalive comment so proxies don't kill the connection.
                yield {"event": "ping", "data": ""}
                continue

            if item is None:
                # Sentinel — run finished. Send a final `done` event.
                yield {"event": "done", "data": json.dumps({"publicId": publicId})}
                break

            yield {
                "event": "message",
                "data": json.dumps(item.model_dump(by_alias=True, mode="json")),
            }

    # Check run exists before starting the stream.
    run = run_store.get_run(publicId)
    if run is None:
        return JSONResponse(content={"detail": "Run not found"}, status_code=404)

    return EventSourceResponse(event_generator())
