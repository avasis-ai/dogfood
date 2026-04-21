"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { API_URL } from "@/lib/api";
import {
  ALL_MODES,
  FAILURE_MODE_COLORS,
  FAILURE_MODE_LABELS,
} from "@/lib/failure-modes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface RunEvent {
  seq: number;
  ts: string;
  kind: string;
  stepIndex?: number | null;
  payload: Record<string, unknown>;
}

interface RunScore {
  total: number;
  passed: number;
  totalExpectations: number;
  failureBreakdown: Record<string, number>;
}

interface RunState {
  status: string;
  publicId: string | null;
  scenarioSlug: string | null;
  connectorKind: string;
  model: string;
  events: RunEvent[];
  score: RunScore | null;
  findingsCount: number;
}

/* ------------------------------------------------------------------ */
/* Initial state                                                       */
/* ------------------------------------------------------------------ */

const INITIAL: RunState = {
  status: "idle",
  publicId: null,
  scenarioSlug: null,
  connectorKind: "openai",
  model: "gpt-4o",
  events: [],
  score: null,
  findingsCount: 0,
};

/* ------------------------------------------------------------------ */
/* Event log line                                                      */
/* ------------------------------------------------------------------ */

function EventLine({ event }: { event: RunEvent }) {
  const kindLabel: Record<string, string> = {
    "run.started": "▶ started",
    "step.started": "→ step",
    "agent.message": "💬",
    "agent.tool_call": "🔧 tool_call",
    "agent.tool_result": "↩ tool_result",
    "step.evaluated": "✓ evaluated",
    "run.finished": "■ finished",
  };

  const label = kindLabel[event.kind] ?? event.kind;
  const ts = event.ts.split("T")[1]?.split(".")[0] ?? event.ts;

  return (
    <div className="flex gap-2 border-b border-[var(--border)] py-1.5 text-xs">
      <span className="shrink-0 text-[var(--dim)]">{ts}</span>
      <span className="shrink-0 font-bold text-accent">{label}</span>
      {event.stepIndex != null && (
        <span className="shrink-0 text-[var(--dim)]">#{event.stepIndex}</span>
      )}
      <span className="truncate text-[var(--muted)]">
        {event.kind === "agent.message" &&
          typeof event.payload?.delta === "string" &&
          event.payload.delta}
        {event.kind === "agent.tool_call" &&
          ` ${(event.payload?.call as Record<string, string>)?.name ?? ""}`}
        {event.kind === "step.evaluated" &&
          ` ${event.payload?.passed}/${event.payload?.total}`}
        {event.kind === "run.finished" &&
          event.payload?.error != null &&
          ` ⚠ ${String(event.payload.error).slice(0, 80)}`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scorecard                                                           */
/* ------------------------------------------------------------------ */

function Scorecard({ state }: { state: RunState }) {
  if (!state.score) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
          Scorecard
        </h2>
        <div className="text-center text-xs text-[var(--dim)]">
          Waiting for run to complete…
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  const { total, passed, totalExpectations, failureBreakdown } = state.score;

  return (
    <div className="flex flex-col gap-4">
      {/* Score */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl font-bold text-accent">{total}</span>
        <span className="text-xs text-[var(--dim)]">
          {passed}/{totalExpectations} expectations passed
        </span>
      </div>

      <Separator className="bg-[var(--border)]" />

      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--dim)]">Status</span>
        <Badge className="border-[var(--border)] bg-[var(--surface)] text-xs">
          {state.status}
        </Badge>
      </div>

      {/* Findings */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--dim)]">Findings</span>
        <span className="text-xs font-bold">
          {state.findingsCount}
        </span>
      </div>

      <Separator className="bg-[var(--border)]" />

      {/* Failure mode bars */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
          Failure breakdown
        </span>
        {ALL_MODES.map((mode) => {
          const count = failureBreakdown[mode] ?? 0;
          const maxCount = Math.max(
            1,
            ...Object.values(failureBreakdown).map(Number),
          );
          const width = (count / maxCount) * 100;
          return (
            <div key={mode} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-[var(--muted)]">
                {FAILURE_MODE_LABELS[mode]}
              </span>
              <div className="h-2 flex-1 bg-[var(--surface)]">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${width}%`,
                    backgroundColor: FAILURE_MODE_COLORS[mode],
                    minWidth: count > 0 ? "4px" : "0",
                  }}
                />
              </div>
              <span className="w-4 text-right text-xs text-[var(--dim)]">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main runner                                                         */
/* ------------------------------------------------------------------ */

function RunConsole() {
  const searchParams = useSearchParams();
  const scenarioSlug = searchParams.get("scenario") ?? "";
  const connectorParam = searchParams.get("connector") ?? "openai";

  const [state, setState] = useState<RunState>({
    ...INITIAL,
    connectorKind: connectorParam,
  });
  const [slugInput, setSlugInput] = useState(scenarioSlug);
  const [connector, setConnector] = useState(connectorParam);
  const [model, setModel] = useState("gpt-4o");
  const [running, setRunning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll event log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.events]);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startRun = async () => {
    if (!slugInput.trim()) return;
    cleanup();
    setRunning(true);

    setState({
      status: "pending",
      publicId: null,
      scenarioSlug: slugInput.trim(),
      connectorKind: connector,
      model,
      events: [],
      score: null,
      findingsCount: 0,
    });

    try {
      // POST to create run
      const res = await fetch(`${API_URL}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioSlug: slugInput.trim(),
          connector: { kind: connector, label: "web", model },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        setState((s) => ({
          ...s,
          status: "errored",
          events: [
            ...s.events,
            {
              seq: -1,
              ts: new Date().toISOString(),
              kind: "run.finished",
              payload: { error: `API error: ${res.status} ${err}` },
            },
          ],
        }));
        setRunning(false);
        return;
      }

      const { publicId } = await res.json();
      setState((s) => ({ ...s, publicId: publicId as string }));

      // Open SSE stream
      const es = new EventSource(`${API_URL}/runs/${publicId}/events`);
      eventSourceRef.current = es;

      es.addEventListener("message", (e) => {
        try {
          const event: RunEvent = JSON.parse(e.data);
          setState((s) => ({
            ...s,
            status: "running",
            events: [...s.events, event],
          }));
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("done", () => {
        cleanup();
        // Fetch final state
        fetch(`${API_URL}/runs/${publicId}`)
          .then((r) => r.json())
          .then((data) => {
            setState((s) => ({
              ...s,
              status: data.status ?? "finished",
              score: data.score ?? null,
              findingsCount: data.findings?.length ?? 0,
            }));
          })
          .catch(() => {});
      });

      es.addEventListener("ping", () => {
        // keepalive, ignore
      });

      es.onerror = () => {
        cleanup();
        setState((s) => {
          if (s.status === "pending" || s.status === "running") {
            return { ...s, status: "errored" };
          }
          return s;
        });
      };
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "errored",
        events: [
          ...s.events,
          {
            seq: -1,
            ts: new Date().toISOString(),
            kind: "run.finished",
            payload: { error: String(err) },
          },
        ],
      }));
      setRunning(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-0">
      {/* Left pane — event log */}
      <div className="flex w-1/2 flex-col border-r border-[var(--border)]">
        {/* Controls */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
          <input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="Scenario slug"
            className="flex-1 border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--dim)] focus:border-[var(--accent)]"
          />
          <select
            value={connector}
            onChange={(e) => setConnector(e.target.value)}
            className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="openclaw">OpenClaw</option>
            <option value="openai_compatible">OpenAI-compat</option>
          </select>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model"
            className="w-28 border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--dim)]"
          />
          <Button
            onClick={startRun}
            disabled={running || !slugInput.trim()}
            className="bg-[var(--accent)] px-4 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-40"
          >
            {running ? "Running…" : "Run"}
          </Button>
        </div>

        {/* Event log */}
        <div ref={logRef} className="flex-1 overflow-y-auto p-3">
          {state.events.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-[var(--dim)]">
              {state.status === "idle"
                ? "Enter a scenario slug and hit Run"
                : "Waiting for events…"}
            </div>
          ) : (
            state.events.map((event, i) => (
              <EventLine key={i} event={event} />
            ))
          )}
        </div>
      </div>

      {/* Right pane — scorecard */}
      <div className="flex w-1/2 flex-col p-4">
        <Scorecard state={state} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page wrapper (Suspense boundary for useSearchParams)                 */
/* ------------------------------------------------------------------ */

export default function RunPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3rem)] items-center justify-center text-xs text-[var(--dim)]">
          Loading…
        </div>
      }
    >
      <RunConsole />
    </Suspense>
  );
}
