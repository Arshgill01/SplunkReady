#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const outIndex = process.argv.indexOf("--out");
const outPath =
  outIndex >= 0
    ? process.argv[outIndex + 1]
    : "submission-evidence/release-alignment/release-alignment.json";
const requireAligned = process.argv.includes("--require-aligned");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const currentnessPath = "submission-evidence/public-package-currentness/public-package-currentness.json";
const currentness = JSON.parse(readFileSync(join(root, currentnessPath), "utf8"));

const bumpPatch = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(version);

  if (!match) {
    return null;
  }

  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

const registry = currentness.registry ?? {};
const publishedProbes = [
  currentness.publishedJudgeProof,
  currentness.publishedMcp,
  currentness.publishedLiveMockProof,
  currentness.publishedRecorder,
  currentness.publishedPolicyRegistry
].filter(Boolean);
const publishedProbeFailures = publishedProbes.filter((probe) => probe.status !== "PASS");
const localVersionPublished = registry.localVersionPublished === true;
const latestMatchesLocal = registry.latestMatchesLocal === true;
const gitHeadMatchesPackageInputs = registry.gitHeadMatchesPackageInputs === true;
const dirtyPackageInputs = Array.isArray(registry.dirtyPackageInputs) ? registry.dirtyPackageInputs : [];
const packageInputsClean = dirtyPackageInputs.length === 0;
const packageInputsStale =
  localVersionPublished && latestMatchesLocal && packageInputsClean && gitHeadMatchesPackageInputs === false;
const aligned = currentness.status === "CURRENT" && gitHeadMatchesPackageInputs;
const recommendedNextVersion = packageInputsStale ? bumpPatch(packageJson.version) : null;
const status =
  publishedProbeFailures.length > 0
    ? "FAIL"
    : aligned
      ? "CURRENT"
      : packageInputsStale && recommendedNextVersion
        ? "ACTION_REQUIRED"
        : "BLOCKED";

const report = {
  source: "splunkready-release-alignment",
  status,
  package: {
    name: packageJson.name,
    version: packageJson.version,
    recommendedNextVersion
  },
  currentness: {
    artifactPath: currentnessPath,
    status: currentness.status,
    latestVersion: registry.latestVersion ?? null,
    localVersion: registry.localVersion ?? packageJson.version,
    localVersionPublished,
    latestMatchesLocal,
    latestGitHead: registry.latestGitHead ?? null,
    packageInputGitHead: registry.packageInputGitHead ?? null,
    gitHeadMatchesPackageInputs,
    packageInputPaths: registry.packageInputPaths ?? [],
    dirtyPackageInputs
  },
  publishedProbeStatus: [
    ["judgeProof", currentness.publishedJudgeProof],
    ["mcp", currentness.publishedMcp],
    ["liveMockProof", currentness.publishedLiveMockProof],
    ["recorder", currentness.publishedRecorder],
    ["policyRegistry", currentness.publishedPolicyRegistry]
  ]
    .filter(([, probe]) => Boolean(probe))
    .map(([id, probe]) => ({
      id,
      packageSpec: probe.packageSpec ?? null,
      status: probe.status,
      command: probe.command ?? null
    })),
  nextCommands:
    status === "ACTION_REQUIRED"
      ? [
          `npm version ${recommendedNextVersion} --no-git-tag-version`,
          "npm run audit:npm-release-preflight -- --require-ready",
          "npm publish --access public",
          "npm run audit:public-package-currentness -- --require-current --out submission-evidence/public-package-currentness",
          "npm run audit:release-alignment -- --require-aligned"
        ]
      : [],
  summary:
    status === "CURRENT"
      ? "The public package gitHead matches the current package-input tree."
      : status === "ACTION_REQUIRED"
        ? `The public package probes pass, but package inputs moved beyond ${packageJson.version}; bump to ${recommendedNextVersion}, publish, and rerun currentness.`
        : "Release alignment cannot be claimed until the listed blockers are resolved.",
  mutation: false,
  failures: publishedProbeFailures.map((probe) => ({
    packageSpec: probe.packageSpec ?? null,
    status: probe.status,
    error: probe.error ?? null
  }))
};

mkdirSync(dirname(join(root, outPath)), { recursive: true });
writeFileSync(join(root, outPath), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (status === "FAIL" || (requireAligned && status !== "CURRENT")) {
  process.exitCode = 1;
}
