import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("repository CI workflow", () => {
  it("runs the canonical check without live secrets", async () => {
    const workflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

    expect(workflow).toContain("name: CI");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- splunkready-build");
    expect(workflow).toContain("uses: actions/checkout@v5");
    expect(workflow).toContain("uses: actions/setup-node@v5");
    expect(workflow).not.toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("run: npm ci --ignore-scripts");
    expect(workflow).toContain("sudo apt-get install -y ripgrep");
    expect(workflow).toContain("run: npm run check");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("GEMINI_API_KEY");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_URL");
  });

  it("defines a manual GitHub Pages workflow for the credential-free public demo", async () => {
    const workflow = await readFile(new URL("../../.github/workflows/public-demo-pages.yml", import.meta.url), "utf8");

    expect(workflow).toContain("name: Public Demo Pages");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("push:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pages: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("uses: actions/checkout@v5");
    expect(workflow).toContain("uses: actions/setup-node@v5");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("run: npm ci --ignore-scripts");
    expect(workflow).toContain("run: npm run public-demo:build");
    expect(workflow).toContain("run: npm run audit:public-demo-export");
    expect(workflow).toContain("uses: actions/configure-pages@v6");
    expect(workflow).toContain("uses: actions/upload-pages-artifact@v5");
    expect(workflow).toContain("path: artifacts/public-demo");
    expect(workflow).toContain("uses: actions/deploy-pages@v5");
    expect(workflow).not.toContain("GEMINI_API_KEY");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_URL");
  });

  it("defines a live readiness PR gate without live secrets", async () => {
    const workflow = await readFile(new URL("../../.github/workflows/live-certification-gate.yml", import.meta.url), "utf8");

    expect(workflow).toContain("name: Live Certification PR Gate");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("issues: write");
    expect(workflow).toContain("uses: actions/checkout@v5");
    expect(workflow).toContain("uses: actions/setup-node@v5");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("run: npm ci --ignore-scripts");
    expect(workflow).toContain("node dist/src/cli.js live-proof --out artifacts/pr-gate --live-mock --json");
    expect(workflow).toContain("node dist/src/cli.js proof-audit --out artifacts/pr-gate --json");
    expect(workflow).toContain("node scripts/render-pr-gate-comment.mjs --proof-dir artifacts/pr-gate");
    expect(workflow).toContain("uses: actions/upload-artifact@v4");
    expect(workflow).toContain("uses: actions/github-script@v8");
    expect(workflow).toContain("splunkready-live-readiness-pr-gate");
    expect(workflow).not.toContain("GEMINI_API_KEY");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_URL");
  });
});
