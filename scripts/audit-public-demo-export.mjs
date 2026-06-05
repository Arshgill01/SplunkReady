#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { exportPublicDemo } from "./export-public-demo.js";

const root = process.cwd();
const failures = [];

const fail = (message) => {
  failures.push(message);
};

const isSecretFileName = (name) => name === ".env" || name.startsWith(".env.") || name.startsWith(".splunkready");

const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const info = lstatSync(path);

    if (info.isSymbolicLink()) {
      fail(`public demo export must not contain symlink: ${relative(root, path)}`);
      continue;
    }

    if (isSecretFileName(basename(path))) {
      fail(`public demo export must not contain secret-named file: ${relative(root, path)}`);
      continue;
    }

    if (info.isDirectory()) {
      walk(path, files);
    } else if (info.isFile()) {
      files.push(path);
    }
  }

  return files;
};

try {
  const result = await exportPublicDemo({
    root,
    outDir: "artifacts/public-demo",
    generatedAt: "2026-06-06T00:00:00.000Z"
  });
  const outDir = result.outDir;

  for (const requiredPath of [
    "index.html",
    "public-demo-manifest.json",
    "artifacts/mcp-proof/mcp-proof-summary.json",
    "artifacts/mcp-proof/mcp-client-walkthrough.json",
    "artifacts/mcp-proof/mcp-client-walkthrough.md",
    "artifacts/suite-proof/suite-proof-summary.json",
    "artifacts/public-proof-export/public-proof-summary.json",
    "screenshots/workbench-mcp-proof.png"
  ]) {
    if (!existsSync(join(outDir, requiredPath))) {
      fail(`public demo export missing required file: ${requiredPath}`);
    }
  }

  const manifestPath = join(outDir, "public-demo-manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

  if (manifest.source !== "splunkready-public-demo-export") {
    fail("public demo manifest source must be splunkready-public-demo-export");
  }

  if (manifest.mutation !== false) {
    fail("public demo manifest must preserve mutation=false");
  }

  if (manifest.defaultUrl !== "?artifacts=artifacts%2Fmcp-proof#mcp-proof") {
    fail("public demo manifest must point at the relative MCP proof workbench route");
  }

  const expectedArtifactBases = ["artifacts/mcp-proof", "artifacts/suite-proof", "artifacts/public-proof-export"];

  if (JSON.stringify(manifest.artifactBases) !== JSON.stringify(expectedArtifactBases)) {
    fail("public demo manifest artifactBases changed unexpectedly");
  }

  const indexHtmlPath = join(outDir, "index.html");
  const indexHtml = existsSync(indexHtmlPath) ? readFileSync(indexHtmlPath, "utf8") : "";

  if (indexHtml.includes('src="/assets/') || indexHtml.includes('href="/assets/')) {
    fail("public demo index must use relative asset paths for project-site hosting");
  }

  const files = walk(outDir);

  if (failures.length > 0) {
    throw new Error(JSON.stringify({ failures }, null, 2));
  }

  console.log(
    `PASS public demo export audit (${relative(root, outDir)}; ${files.length} files; mutation=false; defaultRoute=mcp-proof)`
  );
} catch (error) {
  console.error(`FAIL public demo export audit: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
