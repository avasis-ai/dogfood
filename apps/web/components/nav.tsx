"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/scenarios", label: "Scenarios" },
  { href: "/run", label: "Run" },
  { href: "/leaderboard", label: "Leaderboard" },
  {
    href: "https://github.com/openclaw/dogfood",
    label: "GitHub",
    external: true,
  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 flex h-12 items-center border-b border-[var(--border)] bg-[var(--background)] px-4">
      {/* Logo */}
      <Link
        href="/"
        className="mr-8 text-base font-bold tracking-tight text-[var(--foreground)] no-underline"
      >
        DOGFOOD<span className="text-accent">.</span>
      </Link>

      {/* Links */}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const isActive =
            !link.external && pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={`px-3 py-1.5 text-xs font-medium no-underline transition-colors ${
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Tagline */}
      <span className="text-xs text-[var(--dim)]">
        eat your own food
      </span>
    </nav>
  );
}
