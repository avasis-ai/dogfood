import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Separator } from "@/components/ui/separator";
import {
  ALL_MODES,
  FAILURE_MODE_COLORS,
  FAILURE_MODE_LABELS,
} from "@/lib/failure-modes";
import { FindingsList } from "./findings-list";
import { ShareActions } from "./share-actions";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface FailureFinding {
  mode: string;
  stepIndex: number;
  detail: string;
  confidence: number;
}

interface RunScore {
  total: number;
  passed: number;
  totalExpectations: number;
  failureBreakdown: Record<string, number>;
}

interface Run {
  id: string;
  scenarioId: string;
  connectorKind: string;
  connectorLabel: string;
  model: string;
  status: string;
  publicId: string;
  score: RunScore | null;
  findings: FailureFinding[];
  startedAt: string;
  finishedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Data fetching                                                       */
/* ------------------------------------------------------------------ */

async function getRun(publicId: string): Promise<Run | null> {
  const res = await fetch(`${API_URL}/runs/${publicId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

interface ScenarioStep {
  role: string;
  content: string;
}

interface ScenarioData {
  system: string | null;
  steps: ScenarioStep[];
}

async function getScenario(slug: string): Promise<ScenarioData | null> {
  const res = await fetch(`${API_URL}/scenarios/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return { system: data.system ?? null, steps: data.steps ?? [] };
}

/* ------------------------------------------------------------------ */
/* Metadata (OG-image ready)                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: { publicId: string };
}): Promise<Metadata> {
  const run = await getRun(params.publicId);
  if (!run) return { title: "Run not found — Dogfood" };

  const score = run.score?.total ?? "—";
  return {
    title: `Run ${score}/100 — ${run.model} — Dogfood`,
    description: `Dogfood run report: ${run.connectorKind}/${run.model} scored ${score}/100 on scenario ${run.scenarioId}.`,
    openGraph: {
      title: `Dogfood Run — ${score}/100`,
      description: `${run.model} · ${run.connectorKind} · ${run.findings.length} findings`,
      type: "article",
      images: [
        {
          url: `/r/${params.publicId}/og`,
          width: 1200,
          height: 630,
          alt: `Dogfood Run — ${score}/100`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Dogfood Run — ${score}/100`,
      description: `${run.model} · ${run.connectorKind} · ${run.findings.length} findings`,
      images: [`/r/${params.publicId}/og`],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function RunReportPage({
  params,
}: {
  params: { publicId: string };
}) {
  const run = await getRun(params.publicId);
  if (!run) notFound();

  const scenario = await getScenario(run.scenarioId);
  const stepContents: Record<number, { role: string; content: string }> = {};
  if (scenario) {
    scenario.steps.forEach((step, idx) => {
      stepContents[idx] = { role: step.role, content: step.content };
    });
  }

  const isTerminal = ["passed", "failed", "errored", "cancelled"].includes(
    run.status,
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">
            Run Report
          </h1>
          <p className="text-xs text-[var(--muted)]">
            {run.publicId.slice(0, 8)}…
          </p>
        </div>
        {run.score && (
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-accent">
              {run.score.total}
            </span>
            <span className="text-xs text-[var(--dim)]">score</span>
          </div>
        )}
      </div>

      {/* Share actions */}
      <ShareActions run={run} />

      <Separator className="bg-[var(--border)]" />

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaItem label="Status" value={run.status} />
        <MetaItem label="Model" value={run.model} />
        <MetaItem
          label="Connector"
          value={`${run.connectorKind} (${run.connectorLabel})`}
        />
        <MetaItem
          label="Scenario"
          value={run.scenarioId}
        />
        <MetaItem
          label="Started"
          value={formatTime(run.startedAt)}
        />
        <MetaItem
          label="Finished"
          value={run.finishedAt ? formatTime(run.finishedAt) : "—"}
        />
        {run.score && (
          <>
            <MetaItem
              label="Passed"
              value={`${run.score.passed}/${run.score.totalExpectations}`}
            />
            <MetaItem
              label="Findings"
              value={`${run.findings.length}`}
            />
          </>
        )}
      </div>

      {/* Score + breakdown */}
      {run.score && (
        <>
          <Separator className="bg-[var(--border)]" />
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
              Failure breakdown
            </span>
            {ALL_MODES.map((mode) => {
              const count = run.score!.failureBreakdown[mode] ?? 0;
              const maxCount = Math.max(
                1,
                ...Object.values(run.score!.failureBreakdown).map(Number),
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
        </>
      )}

      {/* Findings detail */}
      {run.findings.length > 0 && (
        <>
          <Separator className="bg-[var(--border)]" />
          <FindingsList
            findings={run.findings}
            scenarioSlug={run.scenarioId}
            connectorKind={run.connectorKind}
            systemPrompt={scenario?.system ?? null}
            stepContents={stepContents}
          />
        </>
      )}

      {/* Not yet terminal */}
      {!isTerminal && (
        <div className="rounded border border-[var(--accent)] bg-[var(--accent-dim)] p-3 text-center text-xs text-accent">
          This run is still <strong>{run.status}</strong>. Refresh to check for updates.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[var(--dim)]">{label}</span>
      <span className="truncate text-xs font-medium text-[var(--foreground)]">
        {value}
      </span>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
