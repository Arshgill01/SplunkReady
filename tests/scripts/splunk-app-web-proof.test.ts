import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { deriveSplunkWebUrl, parseEnvFileContent, runSplunkAppWebProof } from "../../scripts/capture-splunk-app-web-proof.mjs";

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-web-proof-test-"));

describe("Splunk app web proof", () => {
  it("parses exported env lines without requiring values to be printed", () => {
    expect(
      parseEnvFileContent([
        "export SPLUNKREADY_SPLUNK_MCP_URL=https://127.0.0.1:8089/services/mcp",
        "SPLUNKREADY_SPLUNK_USERNAME='admin'",
        'SPLUNKREADY_SPLUNK_PASSWORD="password-value"',
        "# ignored"
      ].join("\n"))
    ).toEqual({
      SPLUNKREADY_SPLUNK_MCP_URL: "https://127.0.0.1:8089/services/mcp",
      SPLUNKREADY_SPLUNK_USERNAME: "admin",
      SPLUNKREADY_SPLUNK_PASSWORD: "password-value"
    });
  });

  it("derives a Splunk Web URL from the MCP URL when no explicit web URL is configured", () => {
    expect(
      deriveSplunkWebUrl({
        SPLUNKREADY_SPLUNK_MCP_URL: "https://localhost:8089/services/mcp"
      })
    ).toEqual({
      url: "http://localhost:8000",
      source: "derived-from-mcp-url"
    });
  });

  it("writes a skipped public-safe proof before opening a browser when operator confirmation is missing", async () => {
    const root = await tempRoot();
    const result = await runSplunkAppWebProof(
      {
        envFile: join(root, ".missing"),
        outDir: join(root, "proof"),
        screenshotPath: join(root, "screenshots", "proof.png"),
        confirmBrowser: false,
        headed: false,
        json: false,
        help: false
      },
      {}
    );

    expect(result.status).toBe("SKIP");
    const proof = await readFile(join(root, "proof", "splunk-app-web-proof.json"), "utf8");
    expect(proof).toContain("SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF=1");
    expect(proof).toContain("--confirm-browser true");
    expect(proof).toContain('"endpointValueWritten": false');
    expect(proof).toContain('"secretValuesWritten": false');
    expect(proof).not.toContain("password-value");
  });
});
