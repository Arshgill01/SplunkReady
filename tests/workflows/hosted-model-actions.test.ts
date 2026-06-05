import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runHostedModelDiagnosticWorkflow, runHostedModelProofWorkflow } from "../../src/workflows/hosted-model-actions.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-hosted-model-workflow-test-"));

describe("hosted model workflows", () => {
  it("writes fixture hosted-model proof without a CLI import", async () => {
    const outDir = await tempRoot();
    const result = await runHostedModelProofWorkflow({ outDir, mode: "fixture" });
    const proof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      deterministicContext: { passFailAuthority: string };
      toolCalls: string[];
    };

    expect(result).toMatchObject({ status: "PASS", outDir, mutation: false });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "environment-contract.json"), join(outDir, "hosted-model-proof.json")])
    );
    expect(proof).toMatchObject({
      status: "PASS",
      mutation: false,
      deterministicContext: { passFailAuthority: "deterministic-rule-engine" },
      toolCalls: ["saia_explain_spl", "saia_optimize_spl"]
    });
  });

  it("writes fixture hosted-model diagnostics with advisory-only authority", async () => {
    const outDir = await tempRoot();
    const result = await runHostedModelDiagnosticWorkflow({ outDir, mode: "fixture", requirePass: true });
    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      deterministicAuthority: string;
      permission: { status: string };
    };

    expect(result).toMatchObject({ status: "PASS", outDir, mutation: false });
    expect(result.artifacts).toEqual(expect.arrayContaining([join(outDir, "hosted-model-diagnostic.json")]));
    expect(diagnostic).toMatchObject({
      status: "PASS",
      mutation: false,
      deterministicAuthority: "deterministic-rule-engine",
      permission: { status: "OK" }
    });
  });
});
