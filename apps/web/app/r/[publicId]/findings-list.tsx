"use client";

import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FAILURE_MODE_COLORS,
  FAILURE_MODE_LABELS,
} from "@/lib/failure-modes";
import { API_URL } from "@/lib/api";

interface FailureFinding {
  mode: string;
  stepIndex: number;
  detail: string;
  confidence: number;
}

interface ScenarioStep {
  role: string;
  content: string;
  expect?: unknown[];
  latencyBudgetMs?: number;
}

interface FindingsListProps {
  findings: FailureFinding[];
  scenarioSlug: string;
  connectorKind: string;
  systemPrompt: string | null;
  stepContents: Record<number, ScenarioStep>;
}

export function FindingsList({
  findings,
  scenarioSlug,
  connectorKind,
  systemPrompt,
  stepContents,
}: FindingsListProps) {
  const [openDialog, setOpenDialog] = useState<number | null>(null);
  const [editedStep, setEditedStep] = useState<string>("");
  const [editedSystem, setEditedSystem] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const initializedRef = useRef(false);

  const activeFinding = openDialog !== null ? findings[openDialog] : null;
  const activeStep =
    activeFinding != null
      ? stepContents[activeFinding.stepIndex] ?? null
      : null;

  function handleOpen(index: number) {
    initializedRef.current = false;
    setOpenDialog(index);
  }

  // Initialize edit state on first render after opening
  if (openDialog !== null && !initializedRef.current) {
    initializedRef.current = true;
    const f = findings[openDialog];
    const step = stepContents[f?.stepIndex ?? 0];
    setEditedStep(step?.content ?? "");
    setEditedSystem(systemPrompt ?? "");
  }

  async function handleRerun() {
    if (!activeFinding) return;
    setSubmitting(true);

    try {
      // Build scenario override with the edited step content
      const overrideSteps: ScenarioStep[] = [];
      const maxStep = Math.max(
        ...Object.keys(stepContents).map(Number),
        activeFinding.stepIndex,
      );
      for (let i = 0; i <= maxStep; i++) {
        const orig = stepContents[i];
        if (i === activeFinding.stepIndex) {
          overrideSteps.push({
            ...orig,
            role: orig?.role ?? "user",
            content: editedStep,
          });
        } else if (orig) {
          overrideSteps.push(orig);
        }
      }

      const scenarioOverride = {
        id: `tweaked-${Date.now()}`,
        slug: scenarioSlug,
        title: `Tweaked: ${scenarioSlug}`,
        summary: "Modified scenario from tweak & re-run",
        tags: ["tweaked"],
        isPublic: false,
        system: editedSystem || undefined,
        steps: overrideSteps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(`${API_URL}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioSlug,
          connector: {
            kind: connectorKind,
            label: "tweak-rerun",
            model: "gpt-4o",
          },
          scenarioOverride,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        alert(`Failed to start run: ${res.status} ${err}`);
        setSubmitting(false);
        return;
      }

      const { publicId } = await res.json();
      // Redirect to the live run page
      window.location.href = `/r/${publicId}`;
    } catch (err) {
      alert(`Error: ${err}`);
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
          Findings
        </span>
        {findings.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <span
              className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: FAILURE_MODE_COLORS[f.mode] ?? "#666",
              }}
            />
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--foreground)]">
                  {FAILURE_MODE_LABELS[f.mode] ?? f.mode}
                </span>
                <Badge className="border-[var(--border)] bg-[var(--background)] text-xs text-[var(--dim)]">
                  Step {f.stepIndex}
                </Badge>
                <Badge className="border-[var(--border)] bg-[var(--background)] text-xs text-[var(--dim)]">
                  {(f.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
              <p className="text-xs text-[var(--muted)]">{f.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => handleOpen(i)}
              className="inline-flex shrink-0 cursor-pointer items-center border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              title="Tweak and re-run from this step"
            >
              ↻ Tweak &amp; re-run
            </button>
          </div>
        ))}
      </div>

      {/* Edit + Rerun Dialog */}
      <Dialog open={openDialog !== null} onOpenChange={(isOpen) => { if (!isOpen) setOpenDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {activeFinding
                ? `${FAILURE_MODE_LABELS[activeFinding.mode] ?? activeFinding.mode} — Step ${activeFinding.stepIndex}`
                : "Finding"}
            </DialogTitle>
            <DialogDescription>
              Edit the step content or system prompt, then re-run the scenario.
            </DialogDescription>
          </DialogHeader>

          {/* Editable step content */}
          {activeStep ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
                Step content ({activeStep.role})
              </span>
              <textarea
                value={editedStep}
                onChange={(e) => setEditedStep(e.target.value)}
                className="min-h-32 w-full resize-y border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs text-[var(--muted)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          ) : (
            <div className="text-xs text-[var(--dim)]">
              Step content not available.
            </div>
          )}

          {/* Editable system prompt */}
          {systemPrompt && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
                System prompt
              </span>
              <textarea
                value={editedSystem}
                onChange={(e) => setEditedSystem(e.target.value)}
                className="min-h-24 w-full resize-y border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs text-[var(--muted)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={handleRerun}
              disabled={submitting}
              className="inline-flex items-center border border-[var(--accent)] bg-[var(--accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? "Starting…" : "↻ Re-run scenario"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
