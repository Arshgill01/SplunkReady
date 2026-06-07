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
    setTimeout(() => {}, 10000);
    return;
  }

  console.error("Unknown command: mcp");
  process.exit(1);
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
  publishedMcp: { status: string; initialized: boolean };
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
      publishedMcp: { status: "BLOCKED", initialized: false }
    });
    expect(report.recommendedAction).toContain("Publish splunkready@0.1.2");
  });

  it("reports current when npm latest matches local source and MCP initializes", async () => {
    const root = await tempRoot();
    await writePackageJson(root, "0.1.2");

    const report = await runCurrentness(root, {
      FAKE_NPM_VERSIONS: JSON.stringify(["0.1.0", "0.1.1", "0.1.2"]),
      FAKE_NPM_LATEST: "0.1.2",
      FAKE_NPX_MCP_PASS: "true"
    });

    expect(report).toMatchObject({
      status: "CURRENT",
      registry: {
        latestVersion: "0.1.2",
        localVersion: "0.1.2",
        latestMatchesLocal: true
      },
      publishedJudgeProof: { status: "PASS", mutation: false },
      publishedMcp: { status: "PASS", initialized: true },
      recommendedAction: "No registry action required.",
      mutation: false
    });
  });
});
