#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const failures = [];

const fail = (message) => {
  failures.push(message);
};

if (packageJson.name !== "splunkready") {
  fail(`package name must be splunkready, got ${JSON.stringify(packageJson.name)}`);
}

if (packageJson.private === true) {
  fail("package.json must not set private: true for publish readiness");
}

if (packageJson.version === "0.0.0") {
  fail("package version must not remain 0.0.0 for publish readiness");
}

if (packageJson.publishConfig?.access !== "public") {
  fail("package.json must set publishConfig.access to public");
}

if (packageJson.bin?.splunkready !== "dist/src/cli.js") {
  fail("package bin.splunkready must point at dist/src/cli.js");
}

for (const requiredFile of [
  "dist/src/cli.js",
  "dist/src/integrations/agent-trace-bridge.js",
  "dist/src/integrations/agent-trace-bridge.d.ts",
  "dist/src/integrations/callback-trace-capture.js",
  "dist/src/integrations/callback-trace-capture.d.ts",
  "dist/src/schemas/core.js",
  "dist/src/schemas/core.d.ts",
  "README.md",
  "action.yml",
  "fixtures/acme-soc-dev/adapter-fixture.json"
]) {
  if (!existsSync(join(root, requiredFile))) {
    fail(`required package file missing after build: ${requiredFile}`);
  }
}

const cli = existsSync(join(root, "dist/src/cli.js")) ? readFileSync(join(root, "dist/src/cli.js"), "utf8") : "";

if (!cli.startsWith("#!/usr/bin/env node")) {
  fail("dist/src/cli.js must preserve the executable shebang");
}

let packEntries = [];
try {
  packEntries = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8" }));
} catch (error) {
  fail(`npm pack --dry-run --json failed: ${error instanceof Error ? error.message : String(error)}`);
}

const packedFiles = new Set(packEntries.flatMap((entry) => (Array.isArray(entry.files) ? entry.files.map((file) => file.path) : [])));

for (const expected of [
  "package.json",
  "README.md",
  "action.yml",
  "dist/src/cli.js",
  "dist/src/integrations/agent-trace-bridge.js",
  "dist/src/integrations/callback-trace-capture.js",
  "dist/src/schemas/core.js",
  "fixtures/acme-soc-dev/adapter-fixture.json"
]) {
  if (!packedFiles.has(expected)) {
    fail(`npm pack dry run did not include expected file: ${expected}`);
  }
}

for (const packedFile of packedFiles) {
  if (
    packedFile.startsWith("artifacts/") ||
    packedFile.startsWith("dist-ui/") ||
    packedFile.startsWith("logs/") ||
    packedFile.startsWith("moves/") ||
    packedFile.startsWith("src/") ||
    packedFile.startsWith(".splunkready") ||
    packedFile.startsWith(".env")
  ) {
    fail(`npm pack dry run included forbidden file: ${packedFile}`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL package readiness audit (${failures.length} issue${failures.length === 1 ? "" : "s"})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`PASS package readiness audit (${packedFiles.size} packed files checked)`);
}
