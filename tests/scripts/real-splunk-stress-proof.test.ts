import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/run-real-splunk-stress-proof.mjs");

describe("real Splunk stress proof runner", () => {
  it("prints help without requiring operator opt-in", async () => {
    const { stdout } = await execFileAsync("node", [scriptPath, "--help"], { cwd: repoRoot });

    expect(stdout).toContain("SPLUNKREADY_ALLOW_REAL_SPLUNK_SETUP=1");
    expect(stdout).toContain("--container-name");
    expect(stdout).toContain("--keep-container");
  });

  it("refuses setup writes without explicit operator opt-in", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-real-stress-guard-"));

    await expect(
      execFileAsync("node", [scriptPath, "--out", outDir], {
        cwd: repoRoot,
        env: { ...process.env, SPLUNKREADY_ALLOW_REAL_SPLUNK_SETUP: "" }
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Refusing to run real Splunk setup writes")
    });
  });

  it("fails fast without Gemini credentials before starting real Splunk setup", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "splunkready-real-stress-gemini-"));

    await expect(
      execFileAsync("node", [scriptPath, "--out", outDir], {
        cwd: repoRoot,
        env: { ...process.env, SPLUNKREADY_ALLOW_REAL_SPLUNK_SETUP: "1", GEMINI_API_KEY: "" }
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("requires GEMINI_API_KEY")
    });
  });
});
