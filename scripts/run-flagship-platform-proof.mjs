#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(process.cwd());

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const options = {
  out: argValue("--out", "artifacts/flagship-platform-proof/flagship-platform-proof.json"),
  skipCommands: process.argv.includes("--skip-commands")
};

const run = async (label, command, args) => {
  const startedAt = Date.now();
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, NO_COLOR: "1", SPLUNKREADY_LLM_ENABLED: "false" },
    maxBuffer: 30 * 1024 * 1024
  });

  return {
    label,
    command: [command, ...args].join(" "),
    durationMs: Date.now() - startedAt,
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
};

const readJson = async (path) => JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));

const writeSummary = async (path, summary) => {
  const absolutePath = resolve(repoRoot, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(
    absolutePath.replace(/\.json$/, ".md"),
    `# SplunkReady Flagship Platform Proof

Status: ${summary.status}

Mutation: ${summary.mutation ? "true" : "false"}

Pass/fail authority: ${summary.passFailAuthority}

## What This Proves

- Real Splunk evidence audit: ${summary.realSplunkProof.status}, score ${summary.realSplunkProof.score}
- Platform proof wrapper: ${summary.platformProof.status}
- Public npm source currentness: ${summary.publicPackage.status}
- Release alignment: ${summary.releaseAlignment.status}

## Boundary

${summary.boundary}
`,
    "utf8"
  );
};

export const runFlagshipPlatformProof = async () => {
  const steps = [];
  if (!options.skipCommands) {
    steps.push(await run("platform-proof", process.execPath, ["scripts/run-platform-devex-proof.mjs"]));
    steps.push(
      await run("real-splunk-proof-audit", "npm", [
        "run",
        "audit:real-splunk-proof",
        "--",
        "--require-pass",
        "--out",
        "submission-evidence/real-splunk-proof-audit/real-splunk-proof-audit.json"
      ])
    );
    steps.push(
      await run("public-package-currentness", "npm", [
        "run",
        "audit:public-package-currentness",
        "--",
        "--require-current",
        "--out",
        "submission-evidence/public-package-currentness"
      ])
    );
    steps.push(await run("release-alignment", "npm", ["run", "audit:release-alignment", "--", "--require-aligned"]));
  }

  const realSplunkProof = await readJson("submission-evidence/real-splunk-proof-audit/real-splunk-proof-audit.json");
  const platformProof = await readJson("artifacts/platform-devex-proof/platform-devex-proof.json");
  const publicPackage = await readJson("submission-evidence/public-package-currentness/public-package-currentness.json");
  const releaseAlignment = await readJson("submission-evidence/release-alignment/release-alignment.json");

  const checks = [
    {
      id: "real-splunk-proof",
      status: realSplunkProof.status === "PASS" && realSplunkProof.score === 100 ? "PASS" : "FAIL"
    },
    {
      id: "platform-proof",
      status: platformProof.status === "PASS" && platformProof.mutation === false ? "PASS" : "FAIL"
    },
    {
      id: "public-package-currentness",
      status: publicPackage.status === "CURRENT" ? "PASS" : "FAIL"
    },
    {
      id: "release-alignment",
      status: releaseAlignment.status === "CURRENT" ? "PASS" : "FAIL"
    }
  ];
  const failures = checks.filter((check) => check.status !== "PASS");
  const mutation = Boolean(platformProof.mutation || realSplunkProof.realSplunkAuthority?.defaultJudgePathMutatesSplunk);
  const status = failures.length === 0 && !mutation ? "PASS" : "FAIL";
  const summary = {
    source: "splunkready-flagship-platform-proof",
    generatedAt: new Date().toISOString(),
    status,
    mutation,
    passFailAuthority: "deterministic-rule-engine",
    credentialFree: true,
    operatorSetupBoundary:
      "This command verifies tracked public-safe real Splunk evidence. It does not start containers, install apps, ingest events, or mutate Splunk.",
    boundary:
      "The real Splunk proof is backed by a fresh Splunk Enterprise deployment through a local MCP compatibility bridge; do not claim fresh-container official Splunk MCP Server app coverage.",
    realSplunkProof: {
      status: realSplunkProof.status,
      score: realSplunkProof.score,
      workflow: realSplunkProof.realSplunkAuthority?.workflow ?? null
    },
    platformProof: {
      status: platformProof.status,
      receipts: platformProof.receipts ?? null
    },
    publicPackage: {
      status: publicPackage.status,
      packageSpec: publicPackage.publishedJudgeProof?.packageSpec ?? null
    },
    releaseAlignment: {
      status: releaseAlignment.status
    },
    checks,
    failures,
    steps: steps.map((step) => ({
      label: step.label,
      command: step.command,
      durationMs: step.durationMs
    }))
  };

  await writeSummary(options.out, summary);
  console.log(JSON.stringify(summary, null, 2));

  if (status !== "PASS") {
    process.exitCode = 1;
  }

  return summary;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runFlagshipPlatformProof();
}
