#!/usr/bin/env node
/**
 * run-scenario.mjs — CLI bridge between the FastAPI backend and the TS runner.
 *
 * Usage:
 *   node scripts/run-scenario.mjs '<json-run-config>'
 *
 * The single argument is a JSON string with:
 *   {
 *     "scenario": { ... Scenario object ... },
 *     "connector": { ... ConnectorConfig object ... }
 *   }
 *
 * Emits one JSON-line per RunEvent to stdout.
 * The final line is a JSON object with { "done": true, "score": {...}, "findings": [...] }.
 *
 * Exit 0 on success, 1 on error (error message on stderr).
 */

import { runScenario } from "@dogfood/runner";

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Usage: run-scenario.mjs '<json-config>'");
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    console.error(`Invalid JSON config: ${e.message}`);
    process.exit(1);
  }

  const { scenario, connector } = config;
  if (!scenario || !connector) {
    console.error('Config must contain "scenario" and "connector" keys.');
    process.exit(1);
  }

  try {
    const generator = runScenario(scenario, connector);

    let result;
    while (true) {
      result = await generator.next();
      if (result.done) break;

      // Yield each RunEvent as a JSON line.
      console.log(JSON.stringify(result.value));
    }

    // Final line: the runner result (score + findings).
    if (result.value) {
      console.log(
        JSON.stringify({
          done: true,
          score: result.value.score,
          findings: result.value.findings,
        }),
      );
    }
  } catch (e) {
    console.error(`Runner error: ${e.message}`);
    // Emit an error event on stdout so the API layer can capture it.
    console.log(
      JSON.stringify({
        kind: "run.error",
        error: e.message,
        ts: new Date().toISOString(),
      }),
    );
    process.exit(1);
  }
}

main();
