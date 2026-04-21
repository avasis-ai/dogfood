import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center gap-8 text-center">
      {/* Hero */}
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          EAT YOUR OWN
          <span className="text-accent"> FOOD</span>
        </h1>
        <p className="max-w-md text-sm text-[var(--muted)]">
          Stress-test any AI agent against real dogfooding scenarios before
          you ship. Don&apos;t just claim your agent works — prove it.
        </p>
      </div>

      {/* Primary CTA */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/run?connector=openclaw"
          className="inline-flex h-10 items-center justify-center border-none bg-[var(--accent)] px-6 text-xs font-bold uppercase tracking-widest text-white no-underline transition-opacity hover:opacity-90"
        >
          Try with OpenClaw
        </Link>

        <div className="flex items-center gap-4 text-xs text-[var(--dim)]">
          <Link
            href="/scenarios"
            className="no-underline text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Browse scenarios
          </Link>
          <span>·</span>
          <Link
            href="/leaderboard"
            className="no-underline text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mt-12 grid grid-cols-3 gap-8 text-center">
        <div>
          <div className="text-xl font-bold text-accent">3</div>
          <div className="text-xs text-[var(--dim)]">Seed scenarios</div>
        </div>
        <div>
          <div className="text-xl font-bold text-accent">6</div>
          <div className="text-xs text-[var(--dim)]">Failure modes</div>
        </div>
        <div>
          <div className="text-xl font-bold text-accent">4</div>
          <div className="text-xs text-[var(--dim)]">Connectors</div>
        </div>
      </div>
    </div>
  );
}
