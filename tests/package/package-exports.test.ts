import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("package exports", () => {
  it("exposes trace bridge helpers through stable package subpaths", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as {
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).toMatchObject({
      "./trace-bridge": {
        import: "./dist/src/integrations/agent-trace-bridge.js",
        types: "./dist/src/integrations/agent-trace-bridge.d.ts"
      },
      "./callback-trace-capture": {
        import: "./dist/src/integrations/callback-trace-capture.js",
        types: "./dist/src/integrations/callback-trace-capture.d.ts"
      },
      "./schemas": {
        import: "./dist/src/schemas/core.js",
        types: "./dist/src/schemas/core.d.ts"
      }
    });

    await readFile(new URL("../../dist/src/integrations/agent-trace-bridge.d.ts", import.meta.url), "utf8");
    await readFile(new URL("../../dist/src/integrations/callback-trace-capture.d.ts", import.meta.url), "utf8");

    const tempProject = await mkdtemp(join(tmpdir(), "splunkready-package-exports-"));
    const nodeModules = join(tempProject, "node_modules");
    await mkdir(nodeModules);
    await symlink(new URL("../..", import.meta.url), join(nodeModules, "splunkready"), "dir");

    const script = `
      import { createSplunkReadyTraceBridge } from "splunkready/trace-bridge";
      import { createSplunkReadyCallbackTraceCapture } from "splunkready/callback-trace-capture";
      import { traceEventSchema } from "splunkready/schemas";

      const bridge = createSplunkReadyTraceBridge({
        missionId: "mission-security-lateral-movement-readiness",
        timestamp: "2026-06-01T06:05:10.000Z"
      });
      const callId = bridge.recordToolCall({
        toolName: "splunk_run_saved_search",
        toolInput: { name: "ES - Lateral Movement Auth Chain" }
      });
      bridge.recordToolResult({
        parentId: callId,
        toolName: "splunk_run_saved_search",
        outputSummary: "Saved search returned rows.",
        queryRef: "saved-search-lateral-movement",
        resultCount: 3,
        evidenceRefs: ["evt-102", "evt-118", "evt-141"]
      });

      const capture = createSplunkReadyCallbackTraceCapture({
        missionId: "mission-security-lateral-movement-readiness",
        timestamp: "2026-06-01T06:05:10.000Z"
      });
      capture.onToolStart({
        runId: "run-001",
        toolName: "splunk_run_saved_search",
        toolInput: { name: "ES - Lateral Movement Auth Chain" }
      });
      capture.onToolEnd({
        runId: "run-001",
        outputSummary: "Saved search returned rows.",
        queryRef: "saved-search-lateral-movement",
        resultCount: 3,
        evidenceRefs: ["evt-102", "evt-118", "evt-141"]
      });

      traceEventSchema.array().parse([...bridge.events(), ...capture.events()]);
    `;

    await execFileAsync("node", ["--input-type=module", "--eval", script], { cwd: tempProject });
  });
});
