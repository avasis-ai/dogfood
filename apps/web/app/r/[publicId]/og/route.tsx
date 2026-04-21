import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { publicId: string } },
) {
  const { publicId } = params;

  // Fetch run data
  const res = await fetch(`${API_URL}/runs/${publicId}`, { cache: "no-store" });
  if (!res.ok) {
    return new Response("Run not found", { status: 404 });
  }
  const run = await res.json();

  const score = run.score?.total ?? "—";
  const model = run.model ?? "unknown";
  const connector = run.connectorKind ?? "unknown";
  const status = run.status ?? "unknown";
  const scenario = run.scenarioId ?? "unknown";
  const findings = run.findings?.length ?? 0;

  const scoreColor =
    typeof score === "number"
      ? score >= 80
        ? "#22c55e"
        : score >= 50
          ? "#f59e0b"
          : "#ef4444"
      : "#999";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          backgroundColor: "#0a0a0a",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          fontFamily: "monospace",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 48px",
            borderBottom: "1px solid #1a1a1a",
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: "bold",
              letterSpacing: "0.15em",
              color: "#ff5c1f",
            }}
          >
            DOGFOOD.
          </span>
          <span style={{ fontSize: 14, color: "#666" }}>Run Report</span>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 64,
            padding: "0 48px",
          }}
        >
          {/* Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 120,
                fontWeight: "bold",
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {score}
            </span>
            <span style={{ fontSize: 16, color: "#666" }}>/ 100</span>
          </div>

          {/* Meta */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              minWidth: 400,
            }}
          >
            <MetaRow label="MODEL" value={model} />
            <MetaRow label="CONNECTOR" value={connector} />
            <MetaRow label="SCENARIO" value={scenario} />
            <MetaRow label="STATUS" value={status} />
            <MetaRow label="FINDINGS" value={`${findings}`} />
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 48px",
            borderTop: "1px solid #1a1a1a",
          }}
        >
          <span style={{ fontSize: 12, color: "#444" }}>
            Eat your own food — dogfood.dev
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
      <span
        style={{
          fontSize: 11,
          color: "#555",
          letterSpacing: "0.1em",
          minWidth: 100,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, color: "#ccc" }}>{value}</span>
    </div>
  );
}
