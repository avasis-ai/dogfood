"""GET /scenarios — list available scenarios."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.dogfood import Scenario
from app.seeds.scenarios import SEED_SCENARIOS
from app.seeds.self_scenarios import SELF_SCENARIOS

router = APIRouter()

# All in-memory scenarios combined.
_ALL_SCENARIOS: list[Scenario] = list(SEED_SCENARIOS) + list(SELF_SCENARIOS)


@router.get("")
async def list_scenarios() -> JSONResponse:
    """Return seed + self-test scenarios (+ any DB-backed ones).

    Currently returns in-memory scenarios only.
    When Supabase is wired in, DB scenarios will be appended.
    """
    payload = [s.model_dump(by_alias=True, mode="json") for s in _ALL_SCENARIOS]
    return JSONResponse(content=payload)


@router.get("/{slug}")
async def get_scenario(slug: str) -> JSONResponse:
    """Return a single scenario by slug."""
    for s in _ALL_SCENARIOS:
        if s.slug == slug:
            return JSONResponse(content=s.model_dump(by_alias=True, mode="json"))
    return JSONResponse(content={"detail": "Scenario not found"}, status_code=404)
