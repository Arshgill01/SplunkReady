#!/usr/bin/env node

import { execFileSync } from "node:child_process";
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

  console.log(
    `PASS package installability audit (${basename(tarballPath)} installed; npx splunkready judge-proof returned PASS)`
  );
} catch (error) {
  console.error(`FAIL package installability audit: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
