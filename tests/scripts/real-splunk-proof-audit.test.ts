import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-real-splunk-proof.mjs");

describe("real Splunk proof audit", () => {
  it("passes only when tracked live Splunk stress evidence is present", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-real-proof-audit-"));
    const outPath = join(outDir, "real-splunk-proof-audit.json");

    const { stdout } = await execFileAsync("node", [scriptPath, "--require-pass", "--out", outPath], {
      cwd: repoRoot
    });

    const report = JSON.parse(await readFile(outPath, "utf8"));
    const printed = JSON.parse(stdout);

    expect(report.status).toBe("PASS");
    expect(report.score).toBe(100);
    expect(report.failures).toEqual([]);
    expect(printed.status).toBe("PASS");
    expect(report.realSplunkAuthority.workflow).toContain("live saved-search proof");
    expect(report.realSplunkAuthority.officialSplunkMcpBoundary).toContain("compatibility bridge");
    expect(report.checks.map((check: { id: string }) => check.id)).toEqual([
      "real-splunk-enterprise-deployment",
      "operator-scoped-setup-not-default-judge-mutation",
      "security-stressors-present",
      "deployment-derived-readiness",
      "deterministic-fail-to-pass-receipts",
      "live-evidence-refs-survive-receipt",
      "mcp-bridge-session-backed-by-real-splunk",
      "official-mcp-boundary-not-overclaimed",
      "llm-layer-advisory-non-authoritative"
    ]);
  });
});
