#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const requireCurrent = process.argv.includes("--require-current");
const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
const tempRoot = mkdtempSync(join(tmpdir(), "splunkready-public-package-currentness-"));

const run = (command, args, options = {}) => {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, {
        cwd: options.cwd ?? root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: options.timeoutMs ?? 60_000,
        env: {
          ...process.env,
          NO_COLOR: "1",
          ...options.env
        }
      })
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "",
      stderr: error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "",
      message: error instanceof Error ? error.message : String(error)
    };
  }
};

const parseJson = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeError = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 500);

const readPublishedMcpInitialize = (packageSpec) =>
  new Promise((resolve) => {
    const child = spawn("npx", ["-y", packageSpec, "mcp"], {
      cwd: tempRoot,
      env: {
        ...process.env,
        NO_COLOR: "1"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        status: "BLOCKED",
        initialized: false,
        error: safeError(`published mcp did not initialize before timeout. stderr=${stderr}`)
      });
    }, 15_000);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newlineIndex = stdout.indexOf("\n");

      if (newlineIndex === -1) {
        return;
      }

      const line = stdout.slice(0, newlineIndex).trim();

      if (!line) {
        return;
      }

      const parsed = parseJson(line, null);
      const result = parsed?.result;
      const initialized =
        parsed?.jsonrpc === "2.0" &&
        parsed?.id === "initialize" &&
        result?.protocolVersion === "2025-06-18" &&
        result?.serverInfo?.name === "splunkready";

      finish({
        status: initialized ? "PASS" : "BLOCKED",
        initialized,
        serverInfo: result?.serverInfo ?? null,
        error: initialized ? null : "published mcp initialize response did not match SplunkReady MCP"
      });
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish({ status: "BLOCKED", initialized: false, error: safeError(error.message) });
    });

    child.on("exit", (code, signal) => {
      if (!settled) {
        finish({
          status: "BLOCKED",
          initialized: false,
          error: safeError(`published mcp exited before initialize response: code=${code} signal=${signal} stderr=${stderr}`)
        });
      }
    });

    child.stdin.end(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "initialize",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "public-package-currentness-audit",
            version: "1.0.0"
          }
        }
      })}\n`
    );
  });

try {
  const versionsResult = run("npm", ["view", packageJson.name, "versions", "--json"], { timeoutMs: 30_000 });
  const latestResult = run("npm", ["view", packageJson.name, "version", "--json"], { timeoutMs: 30_000 });
  const failures = [];

  let versions = [];
  let latestVersion = null;

  if (versionsResult.ok) {
    const parsed = parseJson(versionsResult.stdout, []);
    versions = Array.isArray(parsed) ? parsed.filter((version) => typeof version === "string") : [String(parsed)];
  } else {
    failures.push(`npm versions lookup failed: ${safeError(versionsResult.stderr || versionsResult.message)}`);
  }

  if (latestResult.ok) {
    const parsed = parseJson(latestResult.stdout, null);
    latestVersion = typeof parsed === "string" ? parsed : String(parsed ?? "").replace(/^"|"$/g, "");
  } else {
    failures.push(`npm latest lookup failed: ${safeError(latestResult.stderr || latestResult.message)}`);
  }

  const localVersion = packageJson.version;
  const latestMatchesLocal = latestVersion === localVersion;
  const localVersionPublished = versions.includes(localVersion);
  const packageSpec = latestVersion ? `${packageJson.name}@${latestVersion}` : `${packageJson.name}@latest`;

  const proofDir = join(tempRoot, "judge-proof");
  let publishedJudgeProof = {
    packageSpec,
    status: "BLOCKED",
    mutation: null,
    command: `npx -y ${packageSpec} judge-proof --out ./judge-proof --json`,
    error: null
  };
  let publishedMcp = {
    packageSpec,
    status: "BLOCKED",
    initialized: false,
    error: null
  };

  if (latestVersion) {
    const judgeProofResult = run("npx", ["-y", packageSpec, "judge-proof", "--out", proofDir, "--json"], {
      cwd: tempRoot,
      timeoutMs: 120_000
    });

    if (judgeProofResult.ok) {
      const parsed = parseJson(judgeProofResult.stdout, {});
      const summary = run(
        "node",
        [
          "-e",
          "const fs=require('fs'); const p=process.argv[1]; console.log(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '{}')",
          join(proofDir, "judge-proof-summary.json")
        ],
        {
          cwd: tempRoot,
          timeoutMs: 5_000
        }
      );
      const summaryJson = parseJson(summary.stdout, {});

      publishedJudgeProof = {
        ...publishedJudgeProof,
        status: parsed.status === "PASS" && summaryJson.mutation === false ? "PASS" : "BLOCKED",
        mutation: summaryJson.mutation ?? null,
        error:
          parsed.status === "PASS" && summaryJson.mutation === false
            ? null
            : "published judge-proof did not return PASS with mutation=false"
      };
    } else {
      publishedJudgeProof = {
        ...publishedJudgeProof,
        error: safeError(judgeProofResult.stderr || judgeProofResult.message)
      };
    }

    publishedMcp = {
      packageSpec,
      ...(await readPublishedMcpInitialize(packageSpec))
    };
  }

  const registry = {
    packageName: packageJson.name,
    versions,
    latestVersion,
    localVersion,
    localVersionPublished,
    latestMatchesLocal
  };
  const publishedSmokePassed = publishedJudgeProof.status === "PASS" && publishedMcp.status === "PASS";
  const status =
    failures.length > 0
      ? "FAIL"
      : latestMatchesLocal && !publishedSmokePassed
        ? "FAIL"
        : latestMatchesLocal && publishedSmokePassed
          ? "CURRENT"
          : "STALE";
  const report = {
    source: "splunkready-public-package-currentness",
    status,
    registry,
    publishedJudgeProof,
    publishedMcp,
    recommendedAction:
      status === "CURRENT"
        ? "No registry action required."
        : `Publish ${packageJson.name}@${localVersion} after npm-authenticated release preflight passes, then rerun this audit.`,
    mutation: false,
    failures
  };

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "public-package-currentness.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report, null, 2));

  if (status === "FAIL" || (requireCurrent && status !== "CURRENT")) {
    process.exitCode = 1;
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
