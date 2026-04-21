"""Dogfood — FastAPI backend for stress-testing AI agents."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, scenarios, runs

app = FastAPI(
    title="Dogfood API",
    version="0.1.0",
    description="Stress-test any AI agent against real dogfooding scenarios.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])
app.include_router(runs.router, prefix="/runs", tags=["runs"])
