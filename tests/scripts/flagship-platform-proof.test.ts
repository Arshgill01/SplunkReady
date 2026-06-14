import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/run-flagship-platform-proof.mjs");

const writeJson = async (root: string, path: string, value: unknown): Promise<void> => {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("flagship platform proof", () => {
  it("combines real Splunk audit, platform proof, and release currentness into one PASS artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "splunkready-flagship-proof-"));
    await writeJson(root, "submission-evidence/real-splunk-proof-audit/real-splunk-proof-audit.json", {
      status: "PASS",
      score: 100,
      realSplunkAuthority: {
        workflow: "setup -> app install -> data ingest -> live saved-search proof -> deterministic receipts",
        defaultJudgePathMutatesSplunk: false
      }
    });
    await writeJson(root, "artifacts/platform-devex-proof/platform-devex-proof.json", {
      status: "PASS",
      mutation: false,
      receipts: { fixtureBefore: "NOT READY", fixtureAfter: "READY", transcript: "READY" }
    });
    await writeJson(root, "submission-evidence/public-package-currentness/public-package-currentness.json", {
      status: "CURRENT",
      publishedJudgeProof: { packageSpec: "splunkready@0.1.13" }
    });
    await writeJson(root, "submission-evidence/release-alignment/release-alignment.json", {
      status: "CURRENT"
    });

    const out = join(root, "flagship.json");
    const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--skip-commands", "--out", out], {
      cwd: root
    });

    const report = JSON.parse(await readFile(out, "utf8"));
    const printed = JSON.parse(stdout);
    expect(report.status).toBe("PASS");
    expect(report.mutation).toBe(false);
    expect(report.credentialFree).toBe(true);
    expect(report.publicPackage.packageSpec).toBe("splunkready@0.1.13");
    expect(report.checks.every((check: { status: string }) => check.status === "PASS")).toBe(true);
    expect(printed.boundary).toContain("compatibility bridge");
    await expect(readFile(out.replace(/\.json$/, ".md"), "utf8")).resolves.toContain(
      "SplunkReady Flagship Platform Proof"
    );
  });
});
