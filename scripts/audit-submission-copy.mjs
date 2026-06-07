import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.argv[2] ?? ".";
const hostedMcpProofUrl = "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fmcp-proof#mcp-proof";
const hostedJudgeProofUrl =
  "https://arshgill01.github.io/SplunkReady/?artifacts=artifacts%2Fjudge-proof#proof-browser";

const files = {
  readme: readFileSync(join(rootDir, "README.md"), "utf8"),
  devpost: readFileSync(join(rootDir, "docs/devpost-submission.md"), "utf8"),
  demo: readFileSync(join(rootDir, "docs/demo-script.md"), "utf8"),
  liveAdapter: readFileSync(join(rootDir, "docs/live-adapter.md"), "utf8"),
  claimLedger: readFileSync(join(rootDir, "submission-evidence/claim-ledger.md"), "utf8")
};

const checks = [
  ["README product name", files.readme, "SplunkReady"],
  ["README tagline", files.readme, "Certify AI agents before they touch production Splunk."],
  ["README engine", files.readme, "Agent Readiness Compiler"],
  ["README primary artifact", files.readme, "Readiness Receipt"],
  ["README fixture no credentials", files.readme, "Fixture mode is the default path. It requires no Splunk credentials"],
  ["README no auto mutation", files.readme, "SplunkReady never auto-mutates Splunk"],
  ["README deterministic pass/fail", files.readme, "deterministic grader rules decide pass/fail"],
  ["README not chatbot", files.readme, "Not a Splunk chatbot."],
  ["README not copilot", files.readme, "Not a SOC copilot."],
  ["README not telemetry", files.readme, "Not MCP telemetry."],
  ["README not detection dashboard", files.readme, "Not a detection-health dashboard."],
  ["README not generic eval", files.readme, "Not a generic eval harness."],
  ["README not LLM judge", files.readme, "Not an LLM judging another LLM."],
  ["Devpost product name", files.devpost, "SplunkReady"],
  ["Devpost tagline", files.devpost, "Certify AI agents before they touch production Splunk."],
  ["Devpost track", files.devpost, "Platform & Developer Experience"],
  ["Devpost engine", files.devpost, "Agent Readiness Compiler"],
  ["Devpost primary artifact", files.devpost, "Readiness Receipt"],
  ["Devpost flagship story", files.devpost, "security investigation readiness"],
  ["Devpost no credentials", files.devpost, "requires no live Splunk credentials"],
  ["Devpost no mutation", files.devpost, "does not mutate Splunk"],
  ["README npm package link", files.readme, "https://www.npmjs.com/package/splunkready"],
  ["README clean npx judge proof", files.readme, "npx -y splunkready@0.1.1 judge-proof --out ./judge-proof --json"],
  ["README public package currentness audit", files.readme, "npm run audit:public-package-currentness"],
  ["Devpost clean npx judge proof", files.devpost, "npx -y splunkready@0.1.1 judge-proof --out ./judge-proof --json"],
  ["Devpost public package currentness evidence", files.devpost, "submission-evidence/public-package-currentness/"],
  [
    "Claim ledger published npm package",
    files.claimLedger,
    "The package is published on npm and the current published no-clone judge proof is smoke-tested."
  ],
  ["Claim ledger npm package page", files.claimLedger, "https://www.npmjs.com/package/splunkready"],
  ["Claim ledger published package smoke", files.claimLedger, "npx -y splunkready@0.1.1 judge-proof --out ./judge-proof --json"],
  [
    "Claim ledger public package currentness",
    files.claimLedger,
    "The public registry currentness proof verifies the current published judge-proof and MCP entrypoint paths."
  ],
  ["Claim ledger public package currentness artifact", files.claimLedger, "submission-evidence/public-package-currentness/public-package-currentness.json"],
  [
    "Claim ledger hosted demo currentness",
    files.claimLedger,
    "The hosted public demo is source-current against the latest public-demo input commit."
  ],
  ["Claim ledger hosted demo currentness artifact", files.claimLedger, "submission-evidence/hosted-demo-currentness/hosted-demo-currentness.json"],
  ["Claim ledger hosted demo currentness command", files.claimLedger, "npm run audit:hosted-demo-currentness"],
  ["README hosted MCP proof URL", files.readme, hostedMcpProofUrl],
  ["README hosted judge proof URL", files.readme, hostedJudgeProofUrl],
  ["Devpost hosted MCP proof URL", files.devpost, hostedMcpProofUrl],
  ["Devpost hosted judge proof URL", files.devpost, hostedJudgeProofUrl],
  ["Claim ledger hosted judge proof URL", files.claimLedger, hostedJudgeProofUrl],
  [
    "Claim ledger raw MCP client session",
    files.claimLedger,
    "The MCP proof includes the raw JSON-RPC client session behind the SplunkReady MCP proof."
  ],
  ["Claim ledger MCP client session JSONL", files.claimLedger, "submission-evidence/mcp-proof/mcp-client-session.jsonl"],
  ["Claim ledger MCP resource template", files.claimLedger, "splunkready://receipts/{receiptId}"],
  ["Claim ledger MCP template session", files.claimLedger, "resources/templates/list"],
  ["Claim ledger inline MCP transcript tool", files.claimLedger, "splunkready_certify_mcp_transcript_content"],
  ["Claim ledger hosted model MCP tool", files.claimLedger, "splunkready_check_hosted_model_access"],
  ["Claim ledger MCP composition review tool", files.claimLedger, "splunkready_review_mcp_composition"],
  ["Claim ledger MCP composition review claim", files.claimLedger, "The MCP proof exposes deterministic composition review as a first-class MCP tool."],
  ["Claim ledger MCP composition review summary", files.claimLedger, "mcpCompositionReview"],
  ["Claim ledger MCP composition review scorecard", files.claimLedger, "composition-review-tool"],
  ["Claim ledger MCP composition review Splunk knowledge objects", files.claimLedger, "splunk_get_knowledge_objects"],
  ["Claim ledger MCP composition review Splunk saved search", files.claimLedger, "splunk_run_saved_search"],
  ["Claim ledger operator live hosted-model status", files.claimLedger, "operatorLiveHostedModelStatus"],
  ["Claim ledger operator live SAIA route blocker", files.claimLedger, "SAIA_REST_HANDLERS_NOT_REGISTERED"],
  ["Claim ledger operator live route probe status", files.claimLedger, "restHandlerProbeStatus"],
  ["Claim ledger hosted model MCP resource", files.claimLedger, "splunkready://workflows/hosted-model-diagnostic"],
  ["Claim ledger hosted model MCP prompt", files.claimLedger, "splunkready_hosted_model_diagnostic"],
  ["Claim ledger Claude Desktop MCP config", files.claimLedger, "splunkready://client-config/claude-desktop"],
  ["Claim ledger Cursor MCP config", files.claimLedger, "splunkready://client-config/cursor"],
  ["Claim ledger Antigravity MCP config", files.claimLedger, "splunkready://client-config/antigravity"],
  ["Claim ledger Zed MCP config", files.claimLedger, "splunkready://client-config/zed"],
  ["Claim ledger Antigravity config path", files.claimLedger, "~/.gemini/antigravity/mcp_config.json"],
  ["Claim ledger Zed context server shape", files.claimLedger, "context_servers"],
  [
    "Claim ledger dedicated SAIA client config routing",
    files.claimLedger,
    "The MCP client config resources expose dedicated SAIA cloud routing placeholders without committing credentials."
  ],
  ["Claim ledger dedicated SAIA endpoint placeholder", files.claimLedger, "SPLUNKREADY_SAIA_ENDPOINT"],
  ["Claim ledger dedicated SAIA token placeholder", files.claimLedger, "SPLUNKREADY_SAIA_TOKEN"],
  ["Claim ledger SAIA MCP short alias", files.claimLedger, "SAIA_MCP_URL"],
  ["Claim ledger Splunk AI Assistant alias", files.claimLedger, "SPLUNK_AI_ASSISTANT_MCP_URL"],
  ["Claim ledger SAIA realm header placeholder", files.claimLedger, "SPLUNKREADY_SAIA_REALM"],
  ["Claim ledger SAIA tenant header placeholder", files.claimLedger, "SPLUNKREADY_SAIA_TENANT"],
  ["Claim ledger client config hosted diagnostic tool", files.claimLedger, "hostedModelDiagnosticTool"],
  [
    "Claim ledger Splunk MCP remote client config",
    files.claimLedger,
    "The MCP client config resources use Splunk's `mcp-remote` client shape for the existing Splunk MCP Server side."
  ],
  ["Claim ledger mcp-remote placeholder", files.claimLedger, "mcp-remote"],
  ["Claim ledger Splunk MCP URL placeholder", files.claimLedger, "SPLUNKREADY_SPLUNK_MCP_URL"],
  ["Claim ledger Splunk MCP token header placeholder", files.claimLedger, "Authorization: Bearer ${SPLUNKREADY_SPLUNK_MCP_TOKEN}"],
  ["Claim ledger package MCP entrypoint", files.claimLedger, "splunkready mcp"],
  ["README inline MCP transcript tool", files.readme, "splunkready_certify_mcp_transcript_content"],
  ["README hosted model MCP tool", files.readme, "splunkready_check_hosted_model_access"],
  ["README hosted model MCP resource", files.readme, "splunkready://workflows/hosted-model-diagnostic"],
  ["README hosted model MCP prompt", files.readme, "splunkready_hosted_model_diagnostic"],
  ["README Claude Desktop MCP config", files.readme, "splunkready://client-config/claude-desktop"],
  ["README Cursor MCP config", files.readme, "splunkready://client-config/cursor"],
  ["README Antigravity MCP config", files.readme, "splunkready://client-config/antigravity"],
  ["README Zed MCP config", files.readme, "splunkready://client-config/zed"],
  ["README Antigravity config path", files.readme, "~/.gemini/antigravity/mcp_config.json"],
  ["README Zed settings path", files.readme, "~/.config/zed/settings.json"],
  ["README Zed context servers", files.readme, "context_servers"],
  ["README mcp-remote client config", files.readme, "mcp-remote"],
  ["README Splunk MCP URL placeholder", files.readme, "SPLUNKREADY_SPLUNK_MCP_URL"],
  ["README Splunk MCP token placeholder", files.readme, "SPLUNKREADY_SPLUNK_MCP_TOKEN"],
  ["README SAIA MCP short alias", files.readme, "SAIA_MCP_URL"],
  ["README Splunk AI Assistant alias", files.readme, "SPLUNK_AI_ASSISTANT_MCP_URL"],
  ["README SAIA realm header placeholder", files.readme, "SPLUNKREADY_SAIA_REALM"],
  ["README SAIA tenant header placeholder", files.readme, "SPLUNKREADY_SAIA_TENANT"],
  ["README package MCP entrypoint", files.readme, "splunkready mcp"],
  ["Demo no LLM vibes", files.demo, "not another LLM judging vibes"],
  ["Demo no mutation", files.demo, "does not mutate Splunk"],
  ["Demo route", files.demo, "splunkready-shell.html#rerun-receipts"],
  ["Live disabled", files.liveAdapter, "Live mode is disabled by default"],
  ["Live no credentials for fixture", files.liveAdapter, "Normal fixture tests must not require Splunk credentials"],
  ["Live fixed allowlist", files.liveAdapter, "fixed inventory-only allowlist"],
  ["Live no mutation", files.liveAdapter, "never writes or mutates Splunk configuration"]
];

const forbiddenPositiveClaims = [
  ["Splunk chatbot positive claim", /\bis\s+(?:a|an)\s+Splunk chatbot\b/i],
  ["SOC copilot positive claim", /\bis\s+(?:a|an)\s+SOC copilot\b/i],
  ["MCP telemetry dashboard positive claim", /\bis\s+(?:a|an)\s+MCP telemetry dashboard\b/i],
  ["telemetry dashboard positive claim", /\bis\s+(?:a|an)\s+telemetry dashboard\b/i],
  ["detection-health dashboard positive claim", /\bis\s+(?:a|an)\s+detection-health dashboard\b/i],
  ["generic eval harness positive claim", /\bis\s+(?:a|an)\s+generic eval harness\b/i],
  ["LLM judge positive claim", /\bis\s+(?:a|an)\s+LLM judge\b/i]
];

const failures = checks.filter(([, text, expected]) => !text.includes(expected));
const driftClaims = [];

for (const [fileName, text] of Object.entries(files)) {
  for (const [name, pattern] of forbiddenPositiveClaims) {
    if (pattern.test(text)) {
      driftClaims.push({ file: fileName, name, pattern: String(pattern) });
    }
  }
}

if (failures.length > 0 || driftClaims.length > 0) {
  console.error(
    JSON.stringify(
      {
        failures: failures.map(([name, , expected]) => ({ name, expected })),
        driftClaims
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(`PASS submission copy audited (${checks.length} required claims)`);
