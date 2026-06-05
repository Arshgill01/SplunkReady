#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requireReady = process.argv.includes("--require-ready");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const failures = [];
const blockers = [];

const run = (command, args) => {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
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

if (packageJson.private === true) {
  failures.push("package.json must not set private: true");
}

if (packageJson.publishConfig?.access !== "public") {
  failures.push("package.json must set publishConfig.access to public");
}

if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
  failures.push("package.json must define a package name");
}

if (typeof packageJson.version !== "string" || packageJson.version.length === 0 || packageJson.version === "0.0.0") {
  failures.push("package.json must define a non-placeholder package version");
}

const whoami = run("npm", ["whoami"]);
const auth = whoami.ok
  ? { authenticated: true, username: whoami.stdout.trim() }
  : { authenticated: false, reason: whoami.stderr.trim() || whoami.message };

if (!auth.authenticated) {
  blockers.push("npm auth is not configured; run npm adduser or npm login before publishing");
}

const view = run("npm", ["view", packageJson.name, "versions", "--json"]);
let registry = { packageName: packageJson.name, status: "UNKNOWN", versions: [], currentVersionAvailable: false };

if (view.ok) {
  const parsed = JSON.parse(view.stdout);
  const versions = Array.isArray(parsed) ? parsed.filter((version) => typeof version === "string") : [String(parsed)];
  registry = {
    packageName: packageJson.name,
    status: versions.includes(packageJson.version) ? "VERSION_ALREADY_PUBLISHED" : "EXISTS_VERSION_AVAILABLE",
    versions,
    currentVersionAvailable: !versions.includes(packageJson.version)
  };

  if (versions.includes(packageJson.version)) {
    failures.push(`${packageJson.name}@${packageJson.version} already exists on npm`);
  }
} else if (view.stderr.includes("E404") || view.stdout.includes("\"code\":\"E404\"")) {
  registry = {
    packageName: packageJson.name,
    status: "UNCLAIMED",
    versions: [],
    currentVersionAvailable: true
  };
} else {
  blockers.push(`npm registry lookup did not complete: ${view.stderr.trim() || view.message}`);
}

const pack = run("npm", ["pack", "--dry-run", "--json"]);
let packSummary = { ok: false, fileCount: 0, filename: "" };

if (pack.ok) {
  const entries = JSON.parse(pack.stdout);
  const entry = Array.isArray(entries) ? entries[0] : undefined;
  packSummary = {
    ok: true,
    fileCount: Array.isArray(entry?.files) ? entry.files.length : 0,
    filename: typeof entry?.filename === "string" ? entry.filename : ""
  };
} else {
  failures.push(`npm pack --dry-run --json failed: ${pack.stderr.trim() || pack.message}`);
}

const status = failures.length > 0 ? "FAIL" : blockers.length > 0 ? "BLOCKED" : "READY";
const report = {
  source: "splunkready-npm-release-preflight",
  status,
  package: {
    name: packageJson.name,
    version: packageJson.version,
    publishConfig: packageJson.publishConfig ?? null
  },
  auth,
  registry,
  pack: packSummary,
  blockers,
  failures,
  releaseCommand: "npm publish --access public",
  mutation: false
};

console.log(JSON.stringify(report, null, 2));

if (status === "FAIL" || (requireReady && status !== "READY")) {
  process.exitCode = 1;
}
