#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const appId = "SplunkReady";
const staticAppPath = "splunkready";

const isContained = (root, target) => {
  const relativePath = relative(resolve(root), resolve(target));

  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes(`..${sep}`));
};

const assertContained = (root, target, label) => {
  if (!isContained(root, target)) {
    throw new Error(`${label} escapes expected root: ${target}`);
  }
};

const copyTree = async (source, target, root = source) => {
  const sourcePath = resolve(source);
  const targetPath = resolve(target);
  const sourceRoot = resolve(root);

  assertContained(sourceRoot, sourcePath, "Source path");

  const info = await lstat(sourcePath);

  if (info.isSymbolicLink()) {
    throw new Error(`Refusing to copy symbolic link into Splunk app package: ${source}`);
  }

  if (info.isDirectory()) {
    await mkdir(targetPath, { recursive: true });

    for (const entry of await readdir(sourcePath)) {
      await copyTree(resolve(sourcePath, entry), resolve(targetPath, entry), sourceRoot);
    }

    return;
  }

  if (!info.isFile()) {
    return;
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
};

const listRelativeFiles = async (dir, root = dir) => {
  const files = [];

  for (const entry of await readdir(dir)) {
    const path = resolve(dir, entry);
    const info = await lstat(path);

    if (info.isSymbolicLink()) {
      throw new Error(`Refusing to inspect symbolic link in Splunk app package: ${path}`);
    }

    if (info.isDirectory()) {
      files.push(...await listRelativeFiles(path, root));
    } else if (info.isFile()) {
      files.push(relative(root, path).split(sep).join("/"));
    }
  }

  return files.sort();
};

const normalizePackagePermissions = async (path) => {
  const info = await lstat(path);

  if (info.isSymbolicLink()) {
    throw new Error(`Refusing to set permissions on symbolic link in Splunk app package: ${path}`);
  }

  if (info.isDirectory()) {
    await chmod(path, 0o755);

    for (const entry of await readdir(path)) {
      await normalizePackagePermissions(resolve(path, entry));
    }

    return;
  }

  if (info.isFile()) {
    await chmod(path, 0o644);
  }
};

const sha256File = async (path) =>
  new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });

const parseArgs = (argv) => {
  const outIndex = argv.indexOf("--out");
  const sourceIndex = argv.indexOf("--source");

  return {
    outDir: outIndex >= 0 ? argv[outIndex + 1] : "submission-evidence/splunk-app-package",
    sourceDir: sourceIndex >= 0 ? argv[sourceIndex + 1] : "artifacts/public-demo"
  };
};

const appConf = ({ version }) => `[install]
is_configured = false

[ui]
is_visible = 1
label = SplunkReady

[launcher]
author = SplunkReady
description = Certify AI agents before they touch production Splunk.
version = ${version}

[package]
id = ${appId}
check_for_updates = 0
`;

const defaultMeta = `[]
access = read : [ * ], write : [ admin ]
export = system
`;

const navXml = `<nav search_view="search">
  <view name="splunkready" default="true" />
  <view name="splunkready_overview" />
</nav>
`;

const viewXml = `<view version="1.1" type="html">
  <label>SplunkReady</label>
  <html><![CDATA[
    <iframe
      title="SplunkReady artifact workbench"
      src="/static/app/${appId}/${staticAppPath}/index.html?artifacts=artifacts%2Fmcp-proof#mcp-proof"
      style="border:0;width:100%;min-height:calc(100vh - 120px);background:#ffffff;"
    ></iframe>
  ]]></html>
</view>
`;

const overviewViewXml = `<form version="1.1" theme="light">
  <label>SplunkReady Receipt Overview</label>
  <description>Readiness Receipt status from bundled credential-free evidence and optional operator-owned KV Store rows.</description>
  <fieldset submitButton="false"></fieldset>
  <row>
    <panel>
      <title>Bundled Proof Evidence</title>
      <table>
        <search>
          <query>| makeresults
| eval source="bundled-static-evidence", status="PASS", receipt="submission-evidence/mcp-proof/mcp-transcript-certification/receipt-external-001.json", mutation="false", authority="splunkready-deterministic"
| table source status receipt mutation authority</query>
          <earliest>-24h@h</earliest>
          <latest>now</latest>
        </search>
        <option name="count">5</option>
      </table>
    </panel>
  </row>
  <row>
    <panel>
      <title>Operator-Owned Receipt Store</title>
      <table>
        <search>
          <query>| inputlookup splunkready_receipts_lookup
| sort 0 - updated_at
| table updated_at receipt_id verdict score mutation policy_id receipt_hash previous_receipt_hash source</query>
          <earliest>-24h@h</earliest>
          <latest>now</latest>
        </search>
        <option name="count">10</option>
        <option name="drilldown">none</option>
      </table>
    </panel>
  </row>
</form>
`;

const collectionsConf = `[splunkready_receipts]
enforceTypes = true
field.receipt_id = string
field.receipt_hash = string
field.previous_receipt_hash = string
field.verdict = string
field.score = number
field.mutation = bool
field.policy_id = string
field.policy_version = string
field.source = string
field.updated_at = time
accelerated_fields.receipt_lookup = {"receipt_id": 1, "receipt_hash": 1}
`;

const transformsConf = `[splunkready_receipts_lookup]
external_type = kvstore
collection = splunkready_receipts
fields_list = _key, receipt_id, receipt_hash, previous_receipt_hash, verdict, score, mutation, policy_id, policy_version, source, updated_at
`;

const packageReadme = ({ version }) => `# SplunkReady Splunk App Package

This package embeds the credential-free SplunkReady artifact workbench inside a
Splunk app shell.

- Product: SplunkReady
- Engine: Agent Readiness Compiler
- Version: ${version}
- Mutation: false

The app package contains static proof evidence and a launcher view. It does not
include Splunk credentials, Python REST handlers, scripted inputs, modular
inputs, searches, or write operations.

It also defines an optional splunkready_receipts KV Store collection plus
splunkready_receipts_lookup lookup for operator-owned receipt storage. The
collection is empty at install time; SplunkReady does not populate it
automatically.
`;

export const buildSplunkAppPackage = async ({
  root = process.cwd(),
  outDir = "submission-evidence/splunk-app-package",
  sourceDir = "artifacts/public-demo",
  generatedAt = new Date().toISOString()
} = {}) => {
  const repoRoot = resolve(root);
  const outputRoot = resolve(repoRoot, outDir);
  const sourceRoot = resolve(repoRoot, sourceDir);
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const version = packageJson.version;
  const stagingRoot = resolve(outputRoot, ".staging");
  const appRoot = resolve(stagingRoot, appId);
  const packageName = `${appId}-${version}.spl`;
  const packagePath = resolve(outputRoot, packageName);

  assertContained(repoRoot, outputRoot, "Output directory");
  assertContained(repoRoot, sourceRoot, "Static source directory");

  await lstat(sourceRoot);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(resolve(appRoot, "default", "data", "ui", "views"), { recursive: true });
  await mkdir(resolve(appRoot, "default", "data", "ui", "nav"), { recursive: true });
  await mkdir(resolve(appRoot, "metadata"), { recursive: true });
  await mkdir(resolve(appRoot, "appserver", "static", staticAppPath), { recursive: true });

  await writeFile(resolve(appRoot, "default", "app.conf"), appConf({ version }), "utf8");
  await writeFile(resolve(appRoot, "default", "collections.conf"), collectionsConf, "utf8");
  await writeFile(resolve(appRoot, "default", "transforms.conf"), transformsConf, "utf8");
  await writeFile(resolve(appRoot, "default", "data", "ui", "views", "splunkready.xml"), viewXml, "utf8");
  await writeFile(resolve(appRoot, "default", "data", "ui", "views", "splunkready_overview.xml"), overviewViewXml, "utf8");
  await writeFile(resolve(appRoot, "default", "data", "ui", "nav", "default.xml"), navXml, "utf8");
  await writeFile(resolve(appRoot, "metadata", "default.meta"), defaultMeta, "utf8");
  await writeFile(resolve(appRoot, "README.md"), packageReadme({ version }), "utf8");
  await copyTree(sourceRoot, resolve(appRoot, "appserver", "static", staticAppPath), sourceRoot);

  const appFiles = await listRelativeFiles(appRoot);
  const forbidden = appFiles.filter(
    (file) =>
      file.startsWith("local/") ||
      file === "metadata/local.meta" ||
      file.includes("/.env") ||
      file.includes("/.splunkready") ||
      basename(file).startsWith(".env") ||
      basename(file).startsWith(".splunkready")
  );

  if (forbidden.length > 0) {
    throw new Error(`Splunk app package contains forbidden files: ${forbidden.join(", ")}`);
  }

  await mkdir(outputRoot, { recursive: true });
  await normalizePackagePermissions(appRoot);
  await execFileAsync("tar", ["-czf", packagePath, appId], {
    cwd: stagingRoot,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    maxBuffer: 10 * 1024 * 1024
  });
  const packageSha256 = await sha256File(packagePath);

  const manifest = {
    source: "splunkready-splunk-app-package",
    status: "PASS",
    generatedAt,
    appId,
    version,
    mutation: false,
    packagePath: relative(repoRoot, packagePath).split(sep).join("/"),
    packageSha256,
    staticSource: relative(repoRoot, sourceRoot).split(sep).join("/"),
    launcherView: `${appId}/default/data/ui/views/splunkready.xml`,
    overviewView: `${appId}/default/data/ui/views/splunkready_overview.xml`,
    receiptCollection: "splunkready_receipts",
    receiptLookup: "splunkready_receipts_lookup",
    staticEntry: `${appId}/appserver/static/${staticAppPath}/index.html`,
    publicDemoManifest: `${appId}/appserver/static/${staticAppPath}/public-demo-manifest.json`,
    fileCount: appFiles.length,
    files: appFiles,
    officialSplunkPackagingReferences: [
      "https://dev.splunk.com/enterprise/docs/developapps/createapps/appanatomy/",
      "https://dev.splunk.com/enterprise/docs/releaseapps/packageapps",
      "https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.0/configuration-file-reference/10.0.0-configuration-file-reference/app.conf"
    ],
    noCredentialFiles: true,
    noPythonHandlers: true,
    noScriptedInputs: true,
    operatorOwnedReceiptStore: true
  };

  await writeFile(resolve(outputRoot, "splunk-app-package-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rm(stagingRoot, { recursive: true, force: true });

  return manifest;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const manifest = await buildSplunkAppPackage(options);
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    console.error(`FAIL Splunk app package build: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
