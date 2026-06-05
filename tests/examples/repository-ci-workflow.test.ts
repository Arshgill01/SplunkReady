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
    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("run: npm ci --ignore-scripts");
    expect(workflow).toContain("sudo apt-get install -y ripgrep");
    expect(workflow).toContain("run: npm run check");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("GEMINI_API_KEY");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_TOKEN");
    expect(workflow).not.toContain("SPLUNKREADY_SPLUNK_MCP_URL");
  });
});
