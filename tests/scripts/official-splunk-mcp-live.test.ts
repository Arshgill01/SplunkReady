import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-official-splunk-mcp-live.mjs");

describe("official Splunk MCP live audit", () => {
  it("passes only with redacted official Splunk MCP Server runtime call evidence", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-official-mcp-live-audit-"));
    const outPath = join(outDir, "official-splunk-mcp-live-audit.json");

    const { stdout } = await execFileAsync("node", [scriptPath, "--require-pass", "--out", outPath], {
      cwd: repoRoot
    });

    const report = JSON.parse(await readFile(outPath, "utf8")) as {
      status: string;
      failures: unknown[];
      checks: Array<{ id: string; status: string }>;
    };
    const printed = JSON.parse(stdout) as typeof report;

    expect(report.status).toBe("PASS");
    expect(report.failures).toEqual([]);
    expect(printed.status).toBe("PASS");
    expect(report.checks.map((check) => check.id)).toEqual([
      "official-splunk-mcp-server",
      "official-splunk-mcp-tools-listed",
      "official-splunk-mcp-saia-tools-advertised",
      "official-splunk-mcp-runtime-tool-calls",
      "official-splunk-mcp-saved-search-executed",
      "official-splunk-mcp-public-redaction",
      "official-splunk-mcp-no-mutation"
    ]);
    expect(report.checks.every((check) => check.status === "PASS")).toBe(true);
  });
});
