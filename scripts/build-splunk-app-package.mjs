#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { deflateSync } from "node:zlib";

const execFileAsync = promisify(execFile);

const appId = "SplunkReady";
const staticAppPath = "splunkready";
const privateIpPattern = /\b(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})\b/g;

const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data = Buffer.alloc(0)) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
};

const encodePng = (width, height, draw) => {
  const pixels = Buffer.alloc(width * height * 4);

  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const offset = (y * width + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3] ?? 255;
  };

  const fillRect = (x, y, rectWidth, rectHeight, color) => {
    for (let row = y; row < y + rectHeight; row += 1) {
      for (let column = x; column < x + rectWidth; column += 1) {
        setPixel(column, row, color);
      }
    }
  };

  const strokeRect = (x, y, rectWidth, rectHeight, color) => {
    fillRect(x, y, rectWidth, 1, color);
    fillRect(x, y + rectHeight - 1, rectWidth, 1, color);
    fillRect(x, y, 1, rectHeight, color);
    fillRect(x + rectWidth - 1, y, 1, rectHeight, color);
  };

  const fillCircle = (centerX, centerY, radius, color) => {
    const radiusSquared = radius * radius;
    for (let row = centerY - radius; row <= centerY + radius; row += 1) {
      for (let column = centerX - radius; column <= centerX + radius; column += 1) {
        const deltaX = column - centerX;
        const deltaY = row - centerY;
        if (deltaX * deltaX + deltaY * deltaY <= radiusSquared) {
          setPixel(column, row, color);
        }
      }
    }
  };

  draw({ fillCircle, fillRect, height, setPixel, strokeRect, width });

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const rawOffset = row * (width * 4 + 1);
    raw[rawOffset] = 0;
    pixels.copy(raw, rawOffset + 1, row * width * 4, (row + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    pngSignature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND")
  ]);
};

const splunkReadyIcon = (size) => encodePng(size, size, ({ fillCircle, fillRect, height, strokeRect, width }) => {
  const scale = size / 36;
  const unit = (value) => Math.round(value * scale);

  fillRect(0, 0, width, height, [15, 23, 42, 255]);
  fillRect(unit(4), unit(5), unit(28), unit(26), [248, 250, 252, 255]);
  strokeRect(unit(4), unit(5), unit(28), unit(26), [72, 86, 104, 255]);
  fillRect(unit(8), unit(10), unit(20), unit(3), [14, 165, 233, 255]);
  fillRect(unit(8), unit(16), unit(14), unit(2), [100, 116, 139, 255]);
  fillRect(unit(8), unit(21), unit(18), unit(2), [100, 116, 139, 255]);
  fillCircle(unit(27), unit(25), unit(6), [34, 197, 94, 255]);
  fillRect(unit(24), unit(25), unit(2), unit(4), [15, 23, 42, 255]);
  fillRect(unit(26), unit(27), unit(6), unit(2), [15, 23, 42, 255]);
});

const splunkReadyScreenshot = () => encodePng(623, 350, ({ fillCircle, fillRect, strokeRect }) => {
  fillRect(0, 0, 623, 350, [248, 250, 252, 255]);
  fillRect(0, 0, 623, 48, [15, 23, 42, 255]);
  fillCircle(24, 24, 10, [34, 197, 94, 255]);
  fillRect(45, 15, 132, 8, [226, 232, 240, 255]);
  fillRect(45, 29, 86, 5, [148, 163, 184, 255]);
  fillRect(508, 16, 68, 16, [14, 165, 233, 255]);

  fillRect(24, 72, 176, 92, [255, 255, 255, 255]);
  strokeRect(24, 72, 176, 92, [203, 213, 225, 255]);
  fillRect(44, 94, 70, 7, [15, 23, 42, 255]);
  fillRect(44, 116, 118, 5, [100, 116, 139, 255]);
  fillRect(44, 132, 88, 5, [100, 116, 139, 255]);
  fillRect(44, 146, 134, 7, [34, 197, 94, 255]);

  fillRect(224, 72, 375, 206, [255, 255, 255, 255]);
  strokeRect(224, 72, 375, 206, [203, 213, 225, 255]);
  fillRect(248, 96, 110, 8, [15, 23, 42, 255]);
  fillRect(248, 122, 305, 1, [226, 232, 240, 255]);
  fillRect(248, 144, 276, 10, [239, 246, 255, 255]);
  fillRect(248, 170, 312, 10, [240, 253, 244, 255]);
  fillRect(248, 196, 256, 10, [254, 242, 242, 255]);
  fillRect(248, 232, 92, 22, [14, 165, 233, 255]);

  fillRect(24, 188, 176, 90, [255, 255, 255, 255]);
  strokeRect(24, 188, 176, 90, [203, 213, 225, 255]);
  fillRect(44, 210, 82, 7, [15, 23, 42, 255]);
  fillRect(44, 232, 128, 5, [100, 116, 139, 255]);
  fillRect(44, 249, 105, 5, [100, 116, 139, 255]);

  fillRect(24, 302, 575, 1, [203, 213, 225, 255]);
  fillRect(24, 322, 118, 7, [71, 85, 105, 255]);
  fillRect(492, 318, 107, 16, [22, 163, 74, 255]);
});

const writeSplunkbaseAssets = async (appRoot) => {
  const staticRoot = resolve(appRoot, "static");
  await mkdir(staticRoot, { recursive: true });
  await writeFile(resolve(staticRoot, "appIcon.png"), splunkReadyIcon(36));
  await writeFile(resolve(staticRoot, "appIcon_2x.png"), splunkReadyIcon(72));
  await writeFile(resolve(staticRoot, "screenshot.png"), splunkReadyScreenshot());
};

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

  if (/\.(?:html|json|md|txt|xml)$/i.test(sourcePath)) {
    const content = await readFile(sourcePath, "utf8");
    await writeFile(targetPath, content.replace(privateIpPattern, "[REDACTED-IP]"), "utf8");
    return;
  }

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

[id]
name = ${appId}
version = ${version}

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
access = read : [ * ], write : [ admin, sc_admin ]
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
  await writeSplunkbaseAssets(appRoot);
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
    splunkbaseListingAssets: {
      appIcon: `${appId}/static/appIcon.png`,
      appIcon2x: `${appId}/static/appIcon_2x.png`,
      screenshot: `${appId}/static/screenshot.png`,
      source: "generated-deterministic-assets"
    },
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
