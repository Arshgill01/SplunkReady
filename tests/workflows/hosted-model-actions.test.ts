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

  it("writes a blocked live hosted-model diagnostic when live config is not exported", async () => {
    const outDir = await tempRoot();
    const result = await runHostedModelDiagnosticWorkflow(
      { outDir, mode: "live", requirePass: false },
      {
        SPLUNKREADY_LIVE_ENABLED: "",
        SPLUNKREADY_SPLUNK_MCP_URL: "",
        SPLUNKREADY_SPLUNK_MCP_TOKEN: "",
        SPLUNKREADY_SAIA_ENABLED: ""
      }
    );
    const proof = JSON.parse(await readFile(join(outDir, "hosted-model-proof.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      setup: {
        configured: boolean;
        requiredEnvironment: Array<{ name: string; status: string }>;
        optionalEnvironment: Array<{ name: string; status: string }>;
        secretHandling: string;
      };
      assistance: null;
      error: string;
    };
    const diagnostic = JSON.parse(await readFile(join(outDir, "hosted-model-diagnostic.json"), "utf8")) as {
      status: string;
      mutation: boolean;
      contract: { id: string; mode: string };
      missingTools: string[];
      permission: { status: string; message: string; requiredActions: string[] };
      setup: {
        configured: boolean;
        requiredEnvironment: Array<{ name: string; status: string }>;
        optionalEnvironment: Array<{ name: string; status: string }>;
      };
    };

    expect(result).toMatchObject({ status: "BLOCKED", outDir, mutation: false });
    expect(result.artifacts).toEqual(
      expect.arrayContaining([join(outDir, "hosted-model-proof.json"), join(outDir, "hosted-model-diagnostic.json")])
    );
    expect(proof).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      setup: {
        configured: false,
        requiredEnvironment: [
          { name: "SPLUNKREADY_LIVE_ENABLED", status: "missing" },
          { name: "SPLUNKREADY_SPLUNK_MCP_URL", status: "missing" },
          { name: "SPLUNKREADY_SPLUNK_MCP_TOKEN", status: "missing" }
        ],
        optionalEnvironment: [{ name: "SPLUNKREADY_SAIA_ENABLED", status: "missing" }]
      },
      assistance: null
    });
    expect(proof.error).toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN:missing");
    expect(proof.setup.secretHandling).toContain("Secret values are never written.");
    expect(JSON.stringify(proof)).not.toContain("test-token");
    expect(diagnostic).toMatchObject({
      status: "BLOCKED",
      mutation: false,
      contract: { id: "live-hosted-model-unconfigured", mode: "live" },
      missingTools: ["saia_explain_spl", "saia_optimize_spl"],
      permission: {
        status: "BLOCKED",
        message:
          "Live hosted-model diagnostic could not compile a Splunk contract because required live configuration is not available in this process."
      },
      setup: {
        configured: false,
        requiredEnvironment: [
          { name: "SPLUNKREADY_LIVE_ENABLED", status: "missing" },
          { name: "SPLUNKREADY_SPLUNK_MCP_URL", status: "missing" },
          { name: "SPLUNKREADY_SPLUNK_MCP_TOKEN", status: "missing" }
        ]
      }
    });
    expect(diagnostic.permission.requiredActions).toEqual(
      expect.arrayContaining([
        "Export SPLUNKREADY_LIVE_ENABLED=true in the shell that runs the proof.",
        "Export SPLUNKREADY_SPLUNK_MCP_TOKEN without committing or printing it."
      ])
    );
  });
});
