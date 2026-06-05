import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runFirewallCheckWorkflow, runPolicyBackedRerunWorkflow } from "../../src/workflows/policy-actions.js";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-policy-actions-test-"));

describe("policy action workflows", () => {
  it("runs policy-backed rerun without CLI ownership", async () => {
    const outDir = await tempRoot();
    const result = await runPolicyBackedRerunWorkflow({ outDir });

    expect(result).toMatchObject({
      status: "PASS",
      outDir,
      mutation: false,
      messages: ["Before trace was graded without the firewall; policy-backed rerun used the compiled firewall."]
    });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([
        join(outDir, "receipt-before-001.json"),
        join(outDir, "receipt-after-001.json"),
        join(outDir, "proof-audit.json"),
        join(outDir, "proof-manifest.json")
      ])
    );
  });

  it("runs firewall check as a workflow-owned pre-execution gate", async () => {
    const outDir = await tempRoot();
    const result = await runFirewallCheckWorkflow({ outDir });

    expect(result).toMatchObject({
      status: "PASS",
      outDir,
      mutation: false,
      messages: ["Compiled policy firewall rejected unsafe SPL before Splunk execution."]
    });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([
        join(outDir, "environment-contract.json"),
        join(outDir, "firewall-block-before.json"),
        join(outDir, "proof-audit.json")
      ])
    );
  });

  it("keeps policy action source independent from the CLI module", async () => {
    const source = await readFile(new URL("../../src/workflows/policy-actions.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../cli.js");
    expect(source).toContain("runPolicyBackedRerunWorkflow");
    expect(source).toContain("runFirewallCheckWorkflow");
  });
});
