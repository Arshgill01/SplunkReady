import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FixtureCertificationWorkflowError,
  runFixtureCertification,
  runFixtureCertificationWorkflow,
  type FixtureCertificationProgress,
  type FixtureCertificationWorkflowSteps
} from "../../src/workflows/fixture-certification.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-workflow-test-"));

const writeJson = async (filePath: string, value: unknown): Promise<string> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
};

const fakeSteps = (outDir: string): FixtureCertificationWorkflowSteps => ({
  compile: async () => [await writeJson(join(outDir, "environment-contract.json"), { mode: "fixture" })],
  evaluate: async () => [await writeJson(join(outDir, "trace-before.json"), [])],
  receiptBefore: async () => [
    await writeJson(join(outDir, "receipt-before-001.json"), { verdict: "NOT READY", score: 0 })
  ],
  rerun: async () => [
    await writeJson(join(outDir, "trace-after.json"), []),
    await writeJson(join(outDir, "receipt-after-001.json"), { verdict: "READY", score: 100 })
  ],
  receiptAfter: async () => [join(outDir, "receipt-after-001.json")],
  writeUiShell: async () => {
    await writeFile(join(outDir, "splunkready-shell.html"), "<!doctype html>\n", "utf8");
    return join(outDir, "splunkready-shell.html");
  },
  proofAudit: async () => [
    await writeJson(join(outDir, "proof-audit.json"), { failToPass: true, mutation: false }),
    await writeJson(join(outDir, "proof-manifest.json"), { source: "splunkready-proof-manifest" })
  ]
});

describe("fixture certification workflow", () => {
  it("runs stable phases and returns structured certification metadata", async () => {
    const outDir = await tempRoot();
    const progress: FixtureCertificationProgress[] = [];
    const result = await runFixtureCertification(
      {
        outDir,
        runId: "run-workflow-001",
        includeProofAudit: true,
        onProgress: (event) => {
          progress.push(event);
        }
      },
      fakeSteps(outDir)
    );

    expect(progress.map((event) => `${event.phase}:${event.status}`)).toEqual([
      "compile:started",
      "compile:completed",
      "evaluate:started",
      "evaluate:completed",
      "receipt-before:started",
      "receipt-before:completed",
      "rerun:started",
      "rerun:completed",
      "receipt-after:started",
      "receipt-after:completed",
      "ui-shell:started",
      "ui-shell:completed",
      "demo-rehearsal:started",
      "demo-rehearsal:completed",
      "proof-audit:started",
      "proof-audit:completed"
    ]);
    expect(result).toMatchObject({
      status: "PASS",
      runId: "run-workflow-001",
      outDir,
      beforeVerdict: "NOT READY",
      afterVerdict: "READY",
      failToPass: true,
      mutation: false,
      errors: []
    });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([
        join(outDir, "demo-rehearsal.json"),
        join(outDir, "demo-rehearsal.md"),
        join(outDir, "proof-audit.json"),
        join(outDir, "proof-manifest.json")
      ])
    );
  });

  it("raises structured redacted phase errors", async () => {
    const outDir = await tempRoot();
    const progress: FixtureCertificationProgress[] = [];
    const steps = {
      ...fakeSteps(outDir),
      evaluate: async () => {
        throw new Error("TOKEN=super-secret-token failed");
      }
    };

    await expect(
      runFixtureCertification(
        {
          outDir,
          onProgress: (event) => {
            progress.push(event);
          }
        },
        steps
      )
    ).rejects.toMatchObject({
      name: "FixtureCertificationWorkflowError",
      code: "FIXTURE_CERTIFICATION_WORKFLOW_FAILED",
      phase: "evaluate",
      message: "TOKEN=[REDACTED] failed"
    } satisfies Partial<FixtureCertificationWorkflowError>);
    expect(progress.map((event) => `${event.phase}:${event.status}`)).toEqual([
      "compile:started",
      "compile:completed",
      "evaluate:started",
      "evaluate:failed"
    ]);
  });

  it("runs the backend-facing fixture workflow entrypoint without importing the CLI directly", async () => {
    const outDir = await tempRoot();
    const progress: FixtureCertificationProgress[] = [];
    const result = await runFixtureCertificationWorkflow({
      outDir,
      onProgress: (event) => {
        progress.push(event);
      }
    });

    expect(result).toMatchObject({
      status: "PASS",
      outDir,
      beforeVerdict: "NOT READY",
      afterVerdict: "READY",
      failToPass: true,
      mutation: false
    });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "proof-audit.json"), join(outDir, "proof-manifest.json")])
    );
    expect(progress.map((event) => event.phase)).toContain("proof-audit");
  });

  it("keeps the backend workflow source independent from the CLI module", async () => {
    const source = await readFile(new URL("../../src/workflows/fixture-certification.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../cli.js");
    expect(source).toContain("fixtureCertificationSteps");
  });
});
