import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildReadinessScoreCalibrationReport,
  writeReadinessScoreCalibration
} from "../../src/workflows/readiness-score-calibration.js";

describe("readiness score calibration", () => {
  it("proves deterministic scoring has intermediate states and verdict blockers", () => {
    const report = buildReadinessScoreCalibrationReport("2026-06-08T12:30:00.000Z");

    expect(report).toMatchObject({
      source: "splunkready-readiness-score-calibration",
      contractVersion: "readiness-score-calibration-v1",
      status: "PASS",
      passFailAuthority: "deterministic-rule-engine",
      mutation: false,
      summary: {
        scenarios: 3,
        provesNonBinaryScoring: true
      }
    });
    expect(report.summary.verdicts).toEqual(["READY", "NEEDS REVIEW", "NOT READY"]);
    expect(report.summary.intermediateScores).toEqual([88, 59]);
    expect(report.scenarios.map((scenario) => [scenario.id, scenario.verdict, scenario.score])).toEqual([
      ["ready-clean", "READY", 100],
      ["needs-review-high-blocker", "NEEDS REVIEW", 88],
      ["not-ready-critical-and-medium", "NOT READY", 59]
    ]);
    expect(report.scenarios[1]?.breakdown.blockers).toContain("Critical or High violations block a READY verdict.");
    expect(report.scenarios[2]?.breakdown.blockers).toContain("Critical violations force a NOT READY verdict.");
  });

  it("writes JSON and Markdown artifacts", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-score-calibration-"));
    const { report, artifacts } = await writeReadinessScoreCalibration(outDir, "2026-06-08T12:30:00.000Z");
    const markdown = await readFile(join(outDir, "readiness-score-calibration.md"), "utf8");
    const json = JSON.parse(await readFile(join(outDir, "readiness-score-calibration.json"), "utf8")) as unknown;

    expect(report.status).toBe("PASS");
    expect(artifacts).toEqual([
      join(outDir, "readiness-score-calibration.json"),
      join(outDir, "readiness-score-calibration.md")
    ]);
    expect(json).toMatchObject({ status: "PASS", summary: { intermediateScores: [88, 59] } });
    expect(markdown).toContain("Proves non-binary scoring: true");
    expect(markdown).toContain("| `needs-review-high-blocker` | NEEDS REVIEW | 88 | 12 | 1 |");
    expect(markdown).toContain("| `not-ready-critical-and-medium` | NOT READY | 59 | 41 | 2 |");
  });
});
