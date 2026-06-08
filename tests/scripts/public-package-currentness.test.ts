import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = resolve(repoRoot, "scripts/audit-public-package-currentness.mjs");

const tempRoot = async (): Promise<string> => mkdtemp(join(tmpdir(), "splunkready-public-package-currentness-test-"));

const writeFixture = async (path: string, value: string, mode?: number): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");

  if (mode !== undefined) {
    await chmod(path, mode);
  }
};

const writePackageJson = async (root: string, version = "0.1.2"): Promise<void> => {
  await writeFixture(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "splunkready",
        version,
        publishConfig: { access: "public" }
      },
      null,
      2
    )}\n`
  );
};

const createFakeNpmTools = async (root: string): Promise<string> => {
  const binDir = join(root, "bin");

  await writeFixture(
    join(binDir, "npm"),
    `#!/usr/bin/env node
const args = process.argv.slice(2);
const versions = JSON.parse(process.env.FAKE_NPM_VERSIONS || '["0.1.0"]');
const latest = process.env.FAKE_NPM_LATEST || versions[versions.length - 1];

if (args[0] === "view" && args[2] === "versions") {
  console.log(JSON.stringify(versions));
  process.exit(0);
}

if (args[0] === "view" && args[2] === "version") {
  console.log(JSON.stringify(latest));
  process.exit(0);
}

console.error("unexpected npm command: " + args.join(" "));
process.exit(1);
`,
    0o755
  );

  await writeFixture(
    join(binDir, "npx"),
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const command = args[2];

if (command === "judge-proof") {
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "judge-proof";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "judge-proof-summary.json"), JSON.stringify({ status: "PASS", mutation: false }, null, 2));
  console.log(JSON.stringify({ command: "judge-proof", status: "PASS", artifacts: [path.join(outDir, "judge-proof-summary.json")] }));
  process.exit(0);
}

if (command === "mcp") {
  if (process.env.FAKE_NPX_MCP_PASS === "true") {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: "initialize",
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "splunkready", version: "fixture" },
        instructions: "Deterministic rules decide readiness."
      }
    }));
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: "tools-list",
      result: {
        tools: [
          { name: "splunkready_certify_mcp_transcript_content" },
          { name: "splunkready_check_hosted_model_access" },
          { name: "splunkready_review_mcp_composition" }
        ]
      }
    }));
    setTimeout(() => {}, 10000);
    return;
  }

  console.error("Unknown command: mcp");
  process.exit(1);
}

if (command === "live-proof") {
  if (process.env.FAKE_NPX_LIVE_MOCK_PASS === "true") {
    const outIndex = args.indexOf("--out");
    const outDir = outIndex >= 0 ? args[outIndex + 1] : "live-mock";
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "live-proof-summary.json"), JSON.stringify({
      status: "PASS",
      mode: "live",
      mutation: false,
      failToPass: true
    }, null, 2));
    console.log(JSON.stringify({ command: "live-proof", status: "PASS" }));
    process.exit(0);
  }

  console.error("Unknown option --live-mock");
  process.exit(1);
}

if (command === "mcp-recorder") {
  if (process.env.FAKE_NPX_RECORDER_PASS !== "true") {
    console.error("Unknown option --server.");
    process.exit(1);
  }

  const requiredTools = [
    "splunk__splunk_get_knowledge_objects",
    "splunk__splunk_run_saved_search",
    "splunkready_recorder_flush"
  ];

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    for (const line of chunk.split("\\n")) {
      if (!line.trim()) {
        continue;
      }

      const request = JSON.parse(line);

      if (request.method === "initialize") {
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "splunkready-mcp-recorder", version: "fixture" }
          }
        }));
        continue;
      }

      if (request.method === "tools/list") {
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: requiredTools.map((name) => ({ name }))
          }
        }));
        continue;
      }

      if (request.method === "tools/call" && request.params?.name === "splunkready_recorder_flush") {
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{ type: "text", text: "{\\"status\\":\\"PASS\\"}" }],
            structuredContent: { status: "PASS", certification: { status: "PASS" }, frameCount: 5 }
          }
        }));
        continue;
      }

      if (request.method === "tools/call") {
        console.log(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: { content: [{ type: "text", text: "{}" }], structuredContent: { status: "PASS" } }
        }));
      }
    }
  });
  setTimeout(() => {}, 10000);
  return;
}

if (command === "policy-publish") {
  if (process.env.FAKE_NPX_POLICY_PASS !== "true") {
    console.error("Unknown option --policy");
    process.exit(1);
  }

  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "policy-registry";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "soc2-readiness.policy-manifest.json"), JSON.stringify({
    source: "splunkready-policy-registry",
    signature: { status: "SIGNED", algorithm: "ed25519" }
  }, null, 2));
  console.log(JSON.stringify({ command: "policy-publish", status: "PASS" }));
  process.exit(0);
}

if (command === "compile") {
  if (process.env.FAKE_NPX_POLICY_PASS !== "true") {
    console.error("compile failed");
    process.exit(1);
  }

  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "policy-eval";
  fs.mkdirSync(outDir, { recursive: true });
  console.log(JSON.stringify({ command: "compile", status: "PASS" }));
  process.exit(0);
}

if (command === "evaluate") {
  if (process.env.FAKE_NPX_POLICY_PASS !== "true") {
    console.error("evaluate failed");
    process.exit(1);
  }

  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "policy-eval";
  fs.mkdirSync(outDir, { recursive: true });
  console.log(JSON.stringify({ command: "evaluate", status: "PASS" }));
  process.exit(0);
}

if (command === "receipt") {
  if (process.env.FAKE_NPX_POLICY_PASS !== "true") {
    console.error("receipt failed");
    process.exit(1);
  }

  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "policy-eval";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "receipt-before-001.json"), JSON.stringify({
    policy: {
      id: "pci-dss-readiness",
      hash: "f".repeat(64)
    }
  }, null, 2));
  console.log(JSON.stringify({ command: "receipt", status: "PASS" }));
  process.exit(0);
}

console.error("unexpected npx command: " + args.join(" "));
process.exit(1);
`,
    0o755
  );

  return binDir;
};

const runCurrentness = async (
  root: string,
  env: NodeJS.ProcessEnv
): Promise<{
  status: string;
  registry: { latestVersion: string; localVersion: string; latestMatchesLocal: boolean };
  publishedJudgeProof: { status: string; mutation: boolean };
  publishedMcp: { status: string; initialized: boolean; requiredToolsPresent: boolean; toolNames: string[] };
  publishedLiveMockProof: { status: string; mutation: boolean; mode: string; failToPass: boolean };
  publishedRecorder: {
    status: string;
    initialized: boolean;
    capabilitiesPresent: boolean;
    requiredToolsPresent: boolean;
    flushStatus: string;
    flushContentPresent: boolean;
    toolNames: string[];
  };
  publishedPolicyRegistry: {
    status: string;
    signedPolicyManifest: boolean;
    signatureAlgorithm: string;
    receiptPolicyId: string;
    receiptPolicyHash: string;
  };
  recommendedAction: string;
}> => {
  const binDir = await createFakeNpmTools(root);
  const result = await execFileAsync(process.execPath, [scriptPath], {
    cwd: root,
    env: { ...process.env, ...env, PATH: `${binDir}:${process.env.PATH ?? ""}` }
  });

  return JSON.parse(result.stdout);
};

describe("public package currentness audit", () => {
  it("reports stale when npm latest is behind local source and lacks MCP", async () => {
    const root = await tempRoot();
    await writePackageJson(root, "0.1.2");

    const report = await runCurrentness(root, {
      FAKE_NPM_VERSIONS: JSON.stringify(["0.1.0"]),
      FAKE_NPM_LATEST: "0.1.0",
      FAKE_NPX_MCP_PASS: "false"
    });

    expect(report).toMatchObject({
      status: "STALE",
      registry: {
        latestVersion: "0.1.0",
        localVersion: "0.1.2",
        latestMatchesLocal: false
      },
      publishedJudgeProof: { status: "PASS", mutation: false },
      publishedMcp: { status: "BLOCKED", initialized: false },
      publishedLiveMockProof: { status: "BLOCKED" },
      publishedRecorder: { status: "BLOCKED", initialized: false, requiredToolsPresent: false },
      publishedPolicyRegistry: { status: "BLOCKED" }
    });
    expect(report.recommendedAction).toContain("Publish splunkready@0.1.2");
  }, 30_000);

  it("reports current when npm latest matches local source and advanced public surfaces pass", async () => {
    const root = await tempRoot();
    await writePackageJson(root, "0.1.2");

    const report = await runCurrentness(root, {
      FAKE_NPM_VERSIONS: JSON.stringify(["0.1.0", "0.1.1", "0.1.2"]),
      FAKE_NPM_LATEST: "0.1.2",
      FAKE_NPX_MCP_PASS: "true",
      FAKE_NPX_LIVE_MOCK_PASS: "true",
      FAKE_NPX_RECORDER_PASS: "true",
      FAKE_NPX_POLICY_PASS: "true"
    });

    expect(report).toMatchObject({
      status: "CURRENT",
      registry: {
        latestVersion: "0.1.2",
        localVersion: "0.1.2",
        latestMatchesLocal: true
      },
      publishedJudgeProof: { status: "PASS", mutation: false },
      publishedMcp: { status: "PASS", initialized: true, requiredToolsPresent: true },
      publishedLiveMockProof: { status: "PASS", mutation: false, mode: "live", failToPass: true },
      publishedRecorder: {
        status: "PASS",
        initialized: true,
        capabilitiesPresent: true,
        requiredToolsPresent: true,
        flushStatus: "PASS",
        flushContentPresent: true
      },
      publishedPolicyRegistry: {
        status: "PASS",
        signedPolicyManifest: true,
        signatureAlgorithm: "ed25519",
        receiptPolicyId: "pci-dss-readiness"
      },
      recommendedAction: "No registry action required.",
      mutation: false
    });
    expect(report.publishedMcp.toolNames).toContain("splunkready_review_mcp_composition");
    expect(report.publishedRecorder.toolNames).toContain("splunkready_recorder_flush");
    expect(report.publishedPolicyRegistry.receiptPolicyHash).toMatch(/^[a-f0-9]{64}$/);
  }, 30_000);

  it("fails when npm latest matches local version but lacks newer live-mock and policy surfaces", async () => {
    const root = await tempRoot();
    await writePackageJson(root, "0.1.2");

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--require-current"], {
        cwd: root,
        env: {
          ...process.env,
          FAKE_NPM_VERSIONS: JSON.stringify(["0.1.0", "0.1.1", "0.1.2"]),
          FAKE_NPM_LATEST: "0.1.2",
          FAKE_NPX_MCP_PASS: "true",
          FAKE_NPX_LIVE_MOCK_PASS: "true",
          FAKE_NPX_POLICY_PASS: "true",
          PATH: `${await createFakeNpmTools(root)}:${process.env.PATH ?? ""}`
        }
      })
    ).rejects.toMatchObject({
      code: 1
    });
  }, 30_000);
});
