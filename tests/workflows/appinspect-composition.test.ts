import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  runAppInspectCompositionWorkflow,
  summarizeAppInspectToolResult
} from "../../src/workflows/appinspect-composition.js";

describe("AppInspect MCP composition", () => {
  it("summarizes AppInspect MCP tool output without turning validation failures into proof failure", () => {
    const summary = summarizeAppInspectToolResult({
      status: "success",
      summary: {
        error: 0,
        failure: 2,
        warning: 1,
        success: 8
      },
      validation_results: {
        groups: {
          checks: []
        }
      },
      next_steps: ["Review /Users/alice/SplunkReady/dist/app.spl before upload."],
      logs: "Validated /tmp/SplunkReady.spl against https://splunk.example.test"
    });

    expect(summary).toMatchObject({
      status: "SUCCESS",
      toolStatus: "success",
      failureCount: 2,
      errorCount: 0,
      warningCount: 1,
      validationGroupCount: 1,
      publicSafe: true
    });
    expect(summary.nextSteps[0]).not.toContain("/Users/");
    expect(summary.logsPreview).not.toContain("https://splunk.example.test");
  });

  it("writes a public-safe blocked artifact when AppInspect composition is not requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "splunkready-appinspect-test-"));
    const artifactPath = join(dir, "appinspect-mcp-composition.json");
    const markdownPath = join(dir, "appinspect-mcp-composition.md");

    try {
      const summary = await runAppInspectCompositionWorkflow({
        enabled: false,
        appPackagePath: join(dir, "missing.spl"),
        artifactPath,
        markdownPath
      });
      const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as unknown;
      const markdown = await readFile(markdownPath, "utf8");

      expect(summary.status).toBe("NOT_REQUESTED");
      expect(summary.server.status).toBe("NOT_REQUESTED");
      expect(summary.validation.status).toBe("NOT_RUN");
      expect(summary.mutation).toBe(false);
      expect(artifact).toMatchObject({ source: "splunkready-appinspect-mcp-composition" });
      expect(markdown).toContain("AppInspect MCP Composition");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
