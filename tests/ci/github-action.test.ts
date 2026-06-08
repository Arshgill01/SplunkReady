import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildGitHubActionPlan, readGitHubActionInputs, renderGitHubStepSummary } from "../../src/ci/github-action.js";

const actionPath = "/tmp/splunkready-action";
const workspace = "/tmp/caller-workspace";

describe("GitHub Action runner", () => {
  it("builds the default credential-free judge proof plan", () => {
    const inputs = readGitHubActionInputs({
      GITHUB_ACTION_PATH: actionPath,
      GITHUB_WORKSPACE: workspace,
      GITHUB_SHA: "1234567890abcdef"
    });
    const plan = buildGitHubActionPlan(inputs, {
      GITHUB_ACTION_PATH: actionPath,
      GITHUB_WORKSPACE: workspace
    });

    expect(inputs).toMatchObject({
      mode: "judge-proof",
      outDir: "artifacts/splunkready-gate",
      agentVersion: "github-1234567890ab",
      requirePass: true,
      strictImport: true
    });
    expect(plan).toMatchObject({
      mode: "judge-proof",
      actionPath,
      workspace,
      outDir: `${workspace}/artifacts/splunkready-gate`,
      outputs: {
        outDir: `${workspace}/artifacts/splunkready-gate`,
        receiptPath: `${workspace}/artifacts/splunkready-gate/suite-proof/receipt-after-001.json`,
        summaryPath: `${workspace}/artifacts/splunkready-gate/judge-proof-summary.json`,
        diagnosticsPath: `${workspace}/artifacts/splunkready-gate/suite-proof/compiler-diagnostics.json`
      }
    });
    expect(plan.commands).toEqual([
      {
        name: "Run credential-free judge proof",
        command: "node",
        args: [
          `${actionPath}/dist/src/cli.js`,
          "judge-proof",
          "--out",
          `${workspace}/artifacts/splunkready-gate`,
          "--json"
        ],
        cwd: actionPath
      }
    ]);
  });

  it("builds a strict MCP transcript certification plan from caller workspace paths", () => {
    const inputs = readGitHubActionInputs({
      INPUT_MODE: "mcp-transcript",
      INPUT_TRANSCRIPT: "traces/splunk-mcp.jsonl",
      INPUT_OUT_DIR: "artifacts/mcp-gate",
      INPUT_AGENT_NAME: "PR Agent",
      INPUT_AGENT_VERSION: "pr-91",
      GITHUB_ACTION_PATH: actionPath,
      GITHUB_WORKSPACE: workspace
    });
    const plan = buildGitHubActionPlan(inputs, {
      GITHUB_ACTION_PATH: actionPath,
      GITHUB_WORKSPACE: workspace
    });

    expect(plan.commands).toHaveLength(1);
    expect(plan.commands[0]).toMatchObject({
      name: "Certify MCP JSON-RPC transcript",
      cwd: actionPath
    });
    expect(plan.commands[0].args).toEqual([
      `${actionPath}/dist/src/cli.js`,
      "certify-mcp-transcript",
      "--transcript",
      `${workspace}/traces/splunk-mcp.jsonl`,
      "--out",
      `${workspace}/artifacts/mcp-gate`,
      "--strict-import",
      "true",
      "--require-pass",
      "true",
      "--agent-name",
      "PR Agent",
      "--agent-version",
      "pr-91",
      "--json"
    ]);
    expect(plan.outputs).toMatchObject({
      receiptPath: `${workspace}/artifacts/mcp-gate/receipt-external-001.json`,
      summaryPath: `${workspace}/artifacts/mcp-gate/mcp-transcript-certification.json`,
      diagnosticsPath: `${workspace}/artifacts/mcp-gate/readiness-profile.json`
    });
  });

  it("builds an external trace gate without requiring pass when configured", () => {
    const inputs = readGitHubActionInputs({
      INPUT_MODE: "external-trace",
      INPUT_TRACE: "/var/tmp/trace.json",
      INPUT_OUT_DIR: "/var/tmp/splunkready-proof",
      INPUT_REQUIRE_PASS: "false",
      GITHUB_ACTION_PATH: actionPath,
      GITHUB_WORKSPACE: workspace
    });
    const plan = buildGitHubActionPlan(inputs, {
      GITHUB_ACTION_PATH: actionPath,
      GITHUB_WORKSPACE: workspace
    });

    expect(plan.commands.map((command) => command.name)).toEqual([
      "Compile fixture contract",
      "Grade external trace",
      "Audit external trace proof"
    ]);
    expect(plan.commands[1].args).toContain("/var/tmp/trace.json");
    expect(plan.commands[2].args).not.toContain("--require-pass");
    expect(plan.outputs).toMatchObject({
      outDir: "/var/tmp/splunkready-proof",
      receiptPath: "/var/tmp/splunkready-proof/receipt-external-001.json",
      summaryPath: "/var/tmp/splunkready-proof/proof-audit.json",
      diagnosticsPath: "/var/tmp/splunkready-proof/readiness-profile.json"
    });
  });

  it("fails closed for missing mode-specific paths and malformed booleans", () => {
    expect(() =>
      buildGitHubActionPlan(
        readGitHubActionInputs({
          INPUT_MODE: "mcp-transcript",
          GITHUB_ACTION_PATH: actionPath,
          GITHUB_WORKSPACE: workspace
        }),
        { GITHUB_ACTION_PATH: actionPath, GITHUB_WORKSPACE: workspace }
      )
    ).toThrow("mode=mcp-transcript requires the transcript input");

    expect(() =>
      readGitHubActionInputs({
        INPUT_REQUIRE_PASS: "maybe",
        GITHUB_ACTION_PATH: actionPath,
        GITHUB_WORKSPACE: workspace
      })
    ).toThrow('Expected boolean input value "true" or "false"');
  });

  it("keeps action metadata credential-free and composite-action compatible", async () => {
    const metadata = await readFile("action.yml", "utf8");

    expect(metadata).toContain("using: composite");
    expect(metadata).toContain("diagnostics-path:");
    expect(metadata).toContain("steps.splunkready-gate.outputs.diagnostics-path");
    expect(metadata).toContain("working-directory: ${{ github.action_path }}");
    expect(metadata).toContain("node dist/src/ci/github-action.js");
    expect(metadata).toContain("INPUT_MODE: ${{ inputs.mode }}");
    expect(metadata).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN");
    expect(metadata).not.toContain("SPLUNKREADY_SPLUNK_MCP_URL");
    expect(metadata).not.toContain("GEMINI_API_KEY");
    expect(metadata).not.toContain("live-security-proof");
  });

  it("keeps the setup action checksum-verified and credential-free", async () => {
    const metadata = await readFile("setup-splunkready/action.yml", "utf8");

    expect(metadata).toContain("name: Setup SplunkReady");
    expect(metadata).toContain("using: composite");
    expect(metadata).toContain("default: v0.1.6");
    expect(metadata).toContain("Arshgill01/SplunkReady");
    expect(metadata).toContain("Linux-X64");
    expect(metadata).toContain("macOS-ARM64");
    expect(metadata).toContain("Windows-X64");
    expect(metadata).toContain("curl -fsSL");
    expect(metadata).toContain("shasum -a 256 -c");
    expect(metadata).toContain("sha256sum -c");
    expect(metadata).toContain("tar -xzf");
    expect(metadata).toContain("GITHUB_PATH");
    expect(metadata).toContain("launcher_dir");
    expect(metadata).toContain('exec "%s" "$@"');
    expect(metadata).toContain("binary-path=");
    expect(metadata).not.toContain("npm ci");
    expect(metadata).not.toContain("actions/setup-node");
    expect(metadata).not.toContain("GEMINI_API_KEY");
    expect(metadata).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN");
    expect(metadata).not.toContain("SPLUNKREADY_SPLUNK_MCP_URL");
  });

  it("renders a concise deterministic GitHub step summary", () => {
    const plan = buildGitHubActionPlan(
      readGitHubActionInputs({
        INPUT_MODE: "mcp-transcript",
        INPUT_TRANSCRIPT: "traces/splunk-mcp.jsonl",
        INPUT_OUT_DIR: "artifacts/mcp-gate",
        GITHUB_ACTION_PATH: actionPath,
        GITHUB_WORKSPACE: workspace
      }),
      { GITHUB_ACTION_PATH: actionPath, GITHUB_WORKSPACE: workspace }
    );
    const summary = renderGitHubStepSummary(plan, "PASS");

    expect(summary).toContain("## SplunkReady Gate");
    expect(summary).toContain("| Mode | mcp-transcript |");
    expect(summary).toContain("| Status | PASS |");
    expect(summary).toContain(`| Proof directory | \`${workspace}/artifacts/mcp-gate\` |`);
    expect(summary).toContain(`| Receipt | \`${workspace}/artifacts/mcp-gate/receipt-external-001.json\` |`);
    expect(summary).toContain(`| Diagnostics | \`${workspace}/artifacts/mcp-gate/readiness-profile.json\` |`);
    expect(summary).toContain("Deterministic SplunkReady checks decide pass/fail");
    expect(summary).toContain("hosted-model output is advisory only");
  });
});
