import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Expectation {
  kind: string;
  value?: string;
  name?: string;
  pattern?: string;
  mode?: string;
}

interface ScenarioStep {
  role: string;
  content: string;
  expect?: Expectation[];
}

interface Scenario {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  isPublic: boolean;
  system?: string;
  latencyBudgetMs?: number;
  steps: ScenarioStep[];
}

async function getScenario(slug: string): Promise<Scenario | null> {
  const res = await fetch(`${API_URL}/scenarios/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function ScenarioDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const scenario = await getScenario(params.slug);
  if (!scenario) notFound();

  const totalExpectations = scenario.steps.reduce(
    (acc, s) => acc + (s.expect?.length ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold">{scenario.title}</h1>
          <p className="text-xs text-[var(--muted)]">{scenario.summary}</p>
        </div>
        <Link href={`/run?scenario=${scenario.slug}`}>
          <Button className="bg-[var(--accent)] text-xs font-bold uppercase tracking-widest text-white hover:opacity-90">
            Run this scenario
          </Button>
        </Link>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)]">
          {scenario.steps.length} step{scenario.steps.length !== 1 ? "s" : ""}
        </Badge>
        <Badge className="border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)]">
          {totalExpectations} expectation{totalExpectations !== 1 ? "s" : ""}
        </Badge>
        {scenario.latencyBudgetMs && (
          <Badge className="border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)]">
            {scenario.latencyBudgetMs / 1000}s budget
          </Badge>
        )}
        {scenario.tags.map((tag) => (
          <Badge
            key={tag}
            className="border-[var(--border)] bg-[var(--background)] text-xs text-[var(--dim)]"
          >
            {tag}
          </Badge>
        ))}
      </div>

      {/* System prompt */}
      {scenario.system && (
        <>
          <Separator className="bg-[var(--border)]" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
              System prompt
            </span>
            <pre className="whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
              {scenario.system}
            </pre>
          </div>
        </>
      )}

      {/* Steps */}
      <Separator className="bg-[var(--border)]" />
      <div className="flex flex-col gap-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">
          Steps
        </span>
        {scenario.steps.map((step, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-accent">
                Step {i + 1}
              </span>
              <Badge className="border-[var(--border)] bg-[var(--background)] text-xs text-[var(--dim)]">
                {step.role}
              </Badge>
            </div>
            <p className="text-xs text-[var(--foreground)]">{step.content}</p>
            {step.expect && step.expect.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {step.expect.map((e, j) => (
                  <Badge
                    key={j}
                    className="border-[var(--border)] bg-[var(--background)] text-xs text-[var(--dim)]"
                  >
                    {e.kind}
                    {e.name ? `: ${e.name}` : ""}
                    {e.value ? `="${e.value}"` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
