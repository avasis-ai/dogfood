import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/* Seed leaderboard data (until we have a DB-backed endpoint)          */
/*                                                                    */
/* These are placeholder scores to demonstrate the UI. Replace with    */
/* fetch(`${API_URL}/leaderboard`) when the backend endpoint exists.   */
/* ------------------------------------------------------------------ */

interface LeaderboardEntry {
  rank: number;
  model: string;
  connector: string;
  scenarioSlug: string;
  score: number;
  passed: number;
  total: number;
  publicId: string | null;
  isPinned?: boolean;
}

const SEED_ENTRIES: LeaderboardEntry[] = [
  // openclaw-tool-stress-001
  {
    rank: 1,
    model: "glm-5.1",
    connector: "openclaw",
    scenarioSlug: "openclaw-tool-stress-001",
    score: 100,
    passed: 4,
    total: 4,
    publicId: null,
    isPinned: true,
  },
  {
    rank: 2,
    model: "claude-sonnet-4",
    connector: "anthropic",
    scenarioSlug: "openclaw-tool-stress-001",
    score: 75,
    passed: 3,
    total: 4,
    publicId: null,
  },
  {
    rank: 3,
    model: "gpt-4o",
    connector: "openai",
    scenarioSlug: "openclaw-tool-stress-001",
    score: 75,
    passed: 3,
    total: 4,
    publicId: null,
  },
  // memory-span-001
  {
    rank: 1,
    model: "glm-5.1",
    connector: "openclaw",
    scenarioSlug: "memory-span-001",
    score: 80,
    passed: 4,
    total: 5,
    publicId: null,
    isPinned: true,
  },
  {
    rank: 2,
    model: "gpt-4o",
    connector: "openai",
    scenarioSlug: "memory-span-001",
    score: 60,
    passed: 3,
    total: 5,
    publicId: null,
  },
  // adversarial-jailbreak-001
  {
    rank: 1,
    model: "glm-5.1",
    connector: "openclaw",
    scenarioSlug: "adversarial-jailbreak-001",
    score: 100,
    passed: 3,
    total: 3,
    publicId: null,
    isPinned: true,
  },
  {
    rank: 2,
    model: "claude-sonnet-4",
    connector: "anthropic",
    scenarioSlug: "adversarial-jailbreak-001",
    score: 100,
    passed: 3,
    total: 3,
    publicId: null,
  },
];

const SCENARIOS = [
  "openclaw-tool-stress-001",
  "memory-span-001",
  "adversarial-jailbreak-001",
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold">Leaderboard</h1>
        <p className="text-xs text-[var(--muted)]">
          Top runs per scenario — seed data (no DB yet)
        </p>
      </div>

      {SCENARIOS.map((slug) => {
        const entries = SEED_ENTRIES.filter(
          (e) => e.scenarioSlug === slug,
        );
        return (
          <div key={slug} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Link
                href={`/scenarios/${slug}`}
                className="text-sm font-bold text-accent no-underline"
              >
                {slug}
              </Link>
              <Badge className="border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--dim)]">
                {entries.length} runs
              </Badge>
            </div>

            <div className="overflow-hidden rounded border border-[var(--border)]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                    <th className="px-3 py-2 text-left font-bold text-[var(--dim)]">
                      #
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-[var(--dim)]">
                      Model
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-[var(--dim)]">
                      Connector
                    </th>
                    <th className="px-3 py-2 text-right font-bold text-[var(--dim)]">
                      Score
                    </th>
                    <th className="px-3 py-2 text-right font-bold text-[var(--dim)]">
                      Passed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={`${entry.model}-${entry.connector}`}
                      className={`border-b border-[var(--border)] ${
                        entry.isPinned
                          ? "bg-[var(--accent-dim)]"
                          : "bg-[var(--background)]"
                      }`}
                    >
                      <td className="px-3 py-2 font-bold">
                        {entry.isPinned ? "📌" : entry.rank}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {entry.model}
                        {entry.isPinned && (
                          <span className="ml-1 text-accent">★</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {entry.connector}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-accent">
                        {entry.score}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--muted)]">
                        {entry.passed}/{entry.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-xs text-[var(--dim)]">
        Leaderboard shows seed data. Run scenarios to populate with real scores.
      </div>
    </div>
  );
}
