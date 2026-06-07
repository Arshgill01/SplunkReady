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
npx -y splunkready@0.1.2 judge-proof --out ./judge-proof --json
npm run audit:public-package-currentness
splunkready_certify_mcp_transcript_content
splunkready_check_hosted_model_access
splunkready_review_mcp_composition
splunkready://workflows/hosted-model-diagnostic
splunkready_hosted_model_diagnostic
splunkready://client-config/claude-desktop
splunkready://client-config/cursor
splunkready://client-config/antigravity
splunkready://client-config/zed
~/.gemini/antigravity/mcp_config.json
~/.config/zed/settings.json
context_servers
mcp-remote
SPLUNKREADY_SPLUNK_MCP_URL
SPLUNKREADY_SPLUNK_MCP_TOKEN
SAIA_MCP_URL
SPLUNK_AI_ASSISTANT_MCP_URL
SPLUNKREADY_SAIA_REALM
SPLUNKREADY_SAIA_TENANT
splunkready mcp
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
npx -y splunkready@0.1.2 judge-proof --out ./judge-proof --json
submission-evidence/public-package-currentness/
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
| The package is published on npm and the current published no-clone judge proof is smoke-tested. | Supported | https://www.npmjs.com/package/splunkready | npx -y splunkready@0.1.2 judge-proof --out ./judge-proof --json |
| The public registry currentness proof verifies the current published judge-proof and MCP entrypoint paths. | Supported | submission-evidence/public-package-currentness/public-package-currentness.json | npm run audit:public-package-currentness |
| The hosted public demo is source-current against the latest public-demo input commit. | Supported | submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json | npm run audit:hosted-demo-currentness |
| The hosted public demo exposes the credential-free judge proof and LLM evidence boundary. | Supported | submission-evidence/screenshots/public-judge-proof-proof-browser.png | ${hostedJudgeProofUrl} |
| The MCP proof includes the raw JSON-RPC client session behind the SplunkReady MCP proof. | Supported | submission-evidence/mcp-proof/mcp-client-session.jsonl, resources/templates/list, splunkready://receipts/{receiptId}, splunkready_certify_mcp_transcript_content, splunkready_check_hosted_model_access, splunkready_review_mcp_composition, splunkready://workflows/hosted-model-diagnostic, splunkready_hosted_model_diagnostic, splunkready://client-config/claude-desktop, splunkready://client-config/cursor, splunkready://client-config/antigravity, splunkready://client-config/zed, ~/.gemini/antigravity/mcp_config.json, context_servers, splunkready mcp | npm run mcp-proof |
| The MCP proof exposes deterministic composition review as a first-class MCP tool. | Supported | mcpCompositionReview, splunkready_review_mcp_composition, composition-review-tool, splunk_get_knowledge_objects, splunk_run_saved_search, evt-102, evt-118, evt-141, deterministicAuthority, mutation: false | npm run mcp-proof |
| The self-hostable mock Splunk MCP path produces a credential-free live-mode proof without Splunk credentials. | Supported | submission-evidence/live-mock/live-proof-summary.json, proofLoop: "fail-to-pass", derivedMission.strategy: "saved-search-with-evidence" | npm run live-mock-proof |
| The MCP proof distinguishes credential-free fixture hosted-model PASS from the current operator-live SAIA blocker. | Supported | operatorLiveHostedModelStatus, SAIA_REST_HANDLERS_NOT_REGISTERED, restHandlerProbeStatus | npm run mcp-proof |
| The MCP client config resources expose dedicated SAIA cloud routing placeholders without committing credentials. | Supported | SPLUNKREADY_SAIA_ENDPOINT, SPLUNKREADY_SAIA_TOKEN, SAIA_MCP_URL, SPLUNK_AI_ASSISTANT_MCP_URL, SPLUNKREADY_SAIA_REALM, SPLUNKREADY_SAIA_TENANT, hostedModelDiagnosticTool | npm run mcp-proof |
| The MCP client config resources use Splunk's \`mcp-remote\` client shape for the existing Splunk MCP Server side. | Supported | mcp-remote, SPLUNKREADY_SPLUNK_MCP_URL, Authorization: Bearer \${SPLUNKREADY_SPLUNK_MCP_TOKEN} | npm run mcp-proof |
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
