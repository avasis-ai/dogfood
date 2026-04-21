import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Scenario {
  id: string;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  steps: { role: string; content: string }[];
}

async function getScenarios(): Promise<Scenario[]> {
  const res = await fetch(`${API_URL}/scenarios`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function ScenariosPage() {
  const scenarios = await getScenarios();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Scenarios</h1>
          <p className="text-xs text-[var(--muted)]">
            Curated test scenarios to stress-test AI agents
          </p>
        </div>
        <Link
          href="/run"
          className="border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--foreground)] no-underline transition-colors hover:border-[var(--accent)]"
        >
          + New run
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div className="py-20 text-center text-sm text-[var(--dim)]">
          No scenarios found. Is the API running?
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {scenarios.map((s) => (
            <Link
              key={s.slug}
              href={`/scenarios/${s.slug}`}
              className="no-underline"
            >
              <Card className="flex flex-col gap-2 border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-sm font-bold text-[var(--foreground)]">
                    {s.title}
                  </h2>
                  <span className="shrink-0 text-xs text-[var(--dim)]">
                    {s.steps.length} step{s.steps.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  {s.summary}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.map((tag) => (
                    <Badge
                      key={tag}
                      className="border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
