#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const defaultHostedUrl = "https://arshgill01.github.io/SplunkReady/";
const publicDemoInputPaths = [
  "fixtures",
  "scripts/export-public-demo.js",
  "scripts/audit-public-demo-export.mjs",
  "src",
  "submission-evidence/mcp-proof",
  "submission-evidence/public-proof-export",
  "submission-evidence/screenshots",
  "submission-evidence/suite-proof",
  "ui",
  "vite.config.ts"
];

const parseArgs = (argv) => {
  const parsed = {
    hostedUrl: defaultHostedUrl,
    out: "",
    expectedCommit: "",
    requireCurrent: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--url") {
      parsed.hostedUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--out") {
      parsed.out = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--expected-commit") {
      parsed.expectedCommit = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--require-current") {
      parsed.requireCurrent = true;
    }
  }

  return parsed;
};

const normalizeBaseUrl = (rawUrl) => {
  const url = new URL(rawUrl || defaultHostedUrl);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url;
};

const textFromUrl = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GET ${url.toString()} returned HTTP ${response.status}`);
  }

  return response.text();
};

const jsonFromUrl = async (url) => JSON.parse(await textFromUrl(url));

const assetNamesFromHtml = (html) =>
  [...html.matchAll(/(?:src|href)="\.?\/?assets\/([^"]+)"/g)].map((match) => basename(match[1] ?? "")).sort();

const localAssetNames = async () => {
  const html = await readFile(resolve(process.cwd(), "dist-ui/index.html"), "utf8");

  return assetNamesFromHtml(html);
};

const latestPublicDemoInputCommit = async () => {
  const { stdout } = await execFileAsync("git", ["log", "-1", "--format=%H", "--", ...publicDemoInputPaths], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024
  });

  return stdout.trim();
};

const currentHead = async () => {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024
    });

    return stdout.trim();
  } catch {
    return "UNKNOWN";
  }
};

const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.hostedUrl);
  const manifestUrl = new URL("public-demo-manifest.json", baseUrl);
  const manifest = await jsonFromUrl(manifestUrl);
  const hostedIndexHtml = await textFromUrl(baseUrl);
  const hostedAssets = assetNamesFromHtml(hostedIndexHtml);
  const localAssets = await localAssetNames();
  const expectedCommit = args.expectedCommit || await latestPublicDemoInputCommit();
  const headCommit = await currentHead();
  const failures = [];

  if (manifest.source !== "splunkready-public-demo-export") {
    failures.push("hosted manifest source is not splunkready-public-demo-export");
  }

  if (manifest.mutation !== false) {
    failures.push("hosted manifest does not preserve mutation=false");
  }

  if (manifest.defaultUrl !== "?artifacts=artifacts%2Fmcp-proof#mcp-proof") {
    failures.push("hosted manifest default route is not the MCP proof route");
  }

  if (!manifest.sourceCommit || manifest.sourceCommit === "UNKNOWN") {
    failures.push("hosted manifest does not record sourceCommit");
  } else if (manifest.sourceCommit !== expectedCommit) {
    failures.push(`hosted sourceCommit ${manifest.sourceCommit} does not match expected public-demo input commit ${expectedCommit}`);
  }

  if (JSON.stringify(hostedAssets) !== JSON.stringify(localAssets)) {
    failures.push("hosted index asset names do not match local dist-ui asset names");
  }

  const report = {
    source: "splunkready-hosted-demo-currentness",
    status: failures.length === 0 ? "CURRENT" : "STALE",
    hostedUrl: baseUrl.toString(),
    manifestUrl: manifestUrl.toString(),
    expectedPublicDemoInputCommit: expectedCommit,
    localHead: headCommit,
    hostedSourceCommit: typeof manifest.sourceCommit === "string" ? manifest.sourceCommit : null,
    hostedSourceCommitShort: typeof manifest.sourceCommitShort === "string" ? manifest.sourceCommitShort : null,
    assets: {
      local: localAssets,
      hosted: hostedAssets,
      match: JSON.stringify(hostedAssets) === JSON.stringify(localAssets)
    },
    manifest: {
      source: manifest.source,
      mutation: manifest.mutation,
      defaultUrl: manifest.defaultUrl,
      artifactBases: manifest.artifactBases
    },
    mutation: false,
    failures
  };

  if (args.out) {
    await writeJson(args.out, report);
  }

  console.log(JSON.stringify(report, null, 2));

  if (args.requireCurrent && report.status !== "CURRENT") {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`FAIL hosted demo currentness audit: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
