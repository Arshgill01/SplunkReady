#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const root = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "splunkready-package-install-"));
const packDir = join(tempRoot, "pack");
const projectDir = join(tempRoot, "project");

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: {
      ...process.env,
      ...options.env
    }
  });

const readInstalledMcpInitialize = (cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn("npx", ["splunkready", "mcp"], {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: "1"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error, response) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");

      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    };

    const timeout = setTimeout(() => {
      finish(new Error(`Installed splunkready mcp did not initialize before timeout. stderr: ${stderr.trim()}`));
    }, 10_000);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const newlineIndex = stdout.indexOf("\n");

      if (newlineIndex === -1) {
        return;
      }

      const line = stdout.slice(0, newlineIndex).trim();

      if (line.length === 0) {
        return;
      }

      try {
        finish(undefined, JSON.parse(line));
      } catch (error) {
        finish(new Error(`Installed splunkready mcp returned invalid JSON: ${line}`));
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish(error);
    });

    child.on("exit", (code, signal) => {
      if (!settled && code !== 0) {
        finish(new Error(`Installed splunkready mcp exited before initialize response: code=${code} signal=${signal}`));
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
            name: "package-installability-audit",
            version: "1.0.0"
          }
        }
      })}\n`
    );
  });

try {
  run("mkdir", ["-p", packDir, projectDir]);
  const packOutput = run("npm", ["pack", "--json", "--pack-destination", packDir]);
  const packEntries = JSON.parse(packOutput);
  const tarballName = packEntries[0]?.filename;

  if (typeof tarballName !== "string" || !tarballName.endsWith(".tgz")) {
    throw new Error("npm pack did not return a tarball filename.");
  }

  const tarballPath = join(packDir, basename(tarballName));

  writeFileSync(join(projectDir, "package.json"), JSON.stringify({ type: "module" }, null, 2), "utf8");
  run("npm", ["install", "--ignore-scripts", tarballPath], { cwd: projectDir });

  const proofDir = join(projectDir, "proof");
  const output = run("npx", ["splunkready", "judge-proof", "--out", proofDir, "--json"], { cwd: projectDir });
  const result = JSON.parse(output);

  if (result.command !== "judge-proof" || result.status !== "PASS") {
    throw new Error(`Installed splunkready judge-proof did not pass: ${output}`);
  }

  const summary = JSON.parse(readFileSync(join(proofDir, "judge-proof-summary.json"), "utf8"));

  if (summary.status !== "PASS" || summary.mutation !== false) {
    throw new Error("Installed splunkready judge-proof summary did not preserve PASS/no-mutation status.");
  }

  const mcpInitialize = await readInstalledMcpInitialize(projectDir);
  const mcpResult = mcpInitialize?.result;

  if (
    mcpInitialize?.jsonrpc !== "2.0" ||
    mcpInitialize?.id !== "initialize" ||
    mcpResult?.protocolVersion !== "2025-06-18" ||
    mcpResult?.serverInfo?.name !== "splunkready" ||
    typeof mcpResult?.instructions !== "string" ||
    !mcpResult.instructions.includes("Deterministic rules decide readiness")
  ) {
    throw new Error(`Installed splunkready mcp initialize response was not valid: ${JSON.stringify(mcpInitialize)}`);
  }

  console.log(
    `PASS package installability audit (${basename(tarballPath)} installed; npx splunkready judge-proof returned PASS; npx splunkready mcp initialized)`
  );
} catch (error) {
  console.error(`FAIL package installability audit: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
