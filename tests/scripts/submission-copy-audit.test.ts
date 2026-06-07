import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-submission-copy.mjs");
const hostedMcpProofUrl = "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof";
const hostedJudgeProofUrl =
  "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-submission-copy-test-"));

const writeFixture = async (path: string, value: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
};

const baseReadme = `# SplunkReady

[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)

Certify AI agents before they touch production Splunk.
Agent Readiness Compiler
Readiness Receipt
Fixture mode is the default path. It requires no Splunk credentials
SplunkReady never auto-mutates Splunk
deterministic grader rules decide pass/fail
Not a Splunk chatbot.
Not a SOC copilot.
Not MCP telemetry.
Not a detection-health dashboard.
Not a generic eval harness.
Not an LLM judging another LLM.
npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json
${hostedMcpProofUrl}
${hostedJudgeProofUrl}
`;

const baseDevpost = `# Devpost Submission Draft

SplunkReady
[![npm version](https://badge.fury.io/js/splunkready.svg)](https://www.npmjs.com/package/splunkready)
Certify AI agents before they touch production Splunk.
Platform & Developer Experience
Agent Readiness Compiler
Readiness Receipt
security investigation readiness
requires no live Splunk credentials
does not mutate Splunk
npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json
${hostedMcpProofUrl}
${hostedJudgeProofUrl}
`;

const baseDemo = `# Demo

not another LLM judging vibes
does not mutate Splunk
splunkready-shell.html#rerun-receipts
`;

const baseLiveAdapter = `# Live

Live mode is disabled by default
Normal fixture tests must not require Splunk credentials
fixed inventory-only allowlist
never writes or mutates Splunk configuration
`;

const baseClaimLedger = `# Submission Claim Ledger

| Claim | Status | Evidence | Verification |
| --- | --- | --- | --- |
| The package is published on npm and judge-runnable from a clean folder. | Supported | https://www.npmjs.com/package/splunkready | npx -y splunkready@0.1.0 judge-proof --out ./judge-proof --json |
| The hosted public demo exposes the credential-free judge proof and LLM evidence boundary. | Supported | submission-evidence/screenshots/public-judge-proof-proof-browser.png | ${hostedJudgeProofUrl} |
| The MCP proof includes the raw JSON-RPC client session behind the SplunkReady MCP proof. | Supported | submission-evidence/mcp-proof/mcp-client-session.jsonl, resources/templates/list, splunkready://receipts/{receiptId} | npm run mcp-proof |
`;

const writeSubmissionTree = async (root: string, claimLedger = baseClaimLedger): Promise<void> => {
  await writeFixture(join(root, "README.md"), baseReadme);
  await writeFixture(join(root, "docs/devpost-submission.md"), baseDevpost);
  await writeFixture(join(root, "docs/demo-script.md"), baseDemo);
  await writeFixture(join(root, "docs/live-adapter.md"), baseLiveAdapter);
  await writeFixture(join(root, "submission-evidence/claim-ledger.md"), claimLedger);
};

describe("submission copy audit", () => {
  it("passes when public npm package claims are present in README, Devpost, and claim ledger", async () => {
    const root = await tempRoot();
    await writeSubmissionTree(root);

    const result = await execFileAsync(process.execPath, [scriptPath, root]);

    expect(result.stdout).toContain("PASS submission copy audited");
  });

  it("fails when the claim ledger omits the published npm package claim", async () => {
    const root = await tempRoot();
    await writeSubmissionTree(root, "# Submission Claim Ledger\n");

    await expect(execFileAsync(process.execPath, [scriptPath, root])).rejects.toMatchObject({
      code: 1
    });
  });

  it("fails when Devpost omits the hosted public demo URL", async () => {
    const root = await tempRoot();
    await writeSubmissionTree(root);
    await writeFixture(join(root, "docs/devpost-submission.md"), baseDevpost.replace(hostedMcpProofUrl, ""));

    await expect(execFileAsync(process.execPath, [scriptPath, root])).rejects.toMatchObject({
      code: 1
    });
  });
});
