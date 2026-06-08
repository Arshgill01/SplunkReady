#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const officialReferences = [
  {
    id: "splunkbase-submission",
    title: "Submit Splunkbase apps",
    url: "https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/submit-splunkbase-apps"
  },
  {
    id: "splunkbase-file-standards",
    title: "Splunkbase file standards",
    url: "https://dev.splunk.com/enterprise/docs/releaseapps/splunkbase/approvalcriteria"
  },
  {
    id: "splunk-app-icons",
    title: "Create a Splunk app and set properties",
    url: "https://dev.splunk.com/enterprise/docs/developapps/createapps"
  },
  {
    id: "splunk-app-packaging",
    title: "Package apps",
    url: "https://dev.splunk.com/enterprise/docs/releaseapps/packageapps"
  },
  {
    id: "appinspect-cli",
    title: "Splunk AppInspect CLI reference",
    url: "https://dev.splunk.com/enterprise/reference/appinspect/appinspectcliref"
  },
  {
    id: "app-conf",
    title: "app.conf configuration reference",
    url:
      "https://help.splunk.com/en/data-management/splunk-enterprise-admin-manual/10.0/configuration-file-reference/10.0.0-configuration-file-reference/app.conf"
  }
];

const defaultPaths = {
  packageManifest: "submission-evidence/splunk-app-package/splunk-app-package-manifest.json",
  appinspect: "submission-evidence/splunkbase-readiness/appinspect-precert.json",
  liveInstall: "submission-evidence/splunk-app-install/splunk-app-install-proof.json",
  receiptStore: "submission-evidence/splunk-receipt-store/splunk-receipt-store-proof.json",
  screenshots: "submission-evidence/screenshots",
  readme: "README.md",
  license: "LICENSE",
  packageJson: "package.json",
  outDir: "submission-evidence/splunkbase-readiness"
};

const parseArgs = (argv) => {
  const valueAfter = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : fallback;
  };

  return {
    root: valueAfter("--root", "."),
    outDir: valueAfter("--out", defaultPaths.outDir),
    jsonOnly: argv.includes("--json")
  };
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const sha256File = async (path) => {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
};

const listFiles = async (dir, root = dir) => {
  if (!existsSync(dir)) {
    return [];
  }

  const files = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path, root));
    } else if (entry.isFile()) {
      files.push(relative(root, path).split(sep).join("/"));
    }
  }

  return files.sort();
};

const pngDimensionsFromBuffer = (buffer) => {
  const signature = buffer.subarray(0, 8).toString("hex");

  if (signature !== "89504e470d0a1a0a") {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const pngDimensions = async (path) => pngDimensionsFromBuffer(await readFile(path));

const tarList = async (path) => {
  const { stdout } = await execFileAsync("tar", ["-tzf", path], { maxBuffer: 1024 * 1024 * 20 });
  return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
};

const tarRead = async (path, entry) => {
  const { stdout } = await execFileAsync("tar", ["-xOzf", path, entry], { maxBuffer: 1024 * 1024 * 2 });
  return stdout;
};

const tarReadBuffer = async (path, entry) => {
  const { stdout } = await execFileAsync("tar", ["-xOzf", path, entry], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 5
  });
  return stdout;
};

const packagedPng = async (packagePath, entry) => {
  try {
    return pngDimensionsFromBuffer(await tarReadBuffer(packagePath, entry));
  } catch {
    return null;
  }
};

const dimensionsMatch = (actual, expected) => actual?.width === expected.width && actual?.height === expected.height;

const flattenAppInspectChecks = (appinspect) => {
  const checks = [];

  for (const report of appinspect.reports ?? []) {
    for (const group of report.groups ?? []) {
      for (const check of group.checks ?? []) {
        checks.push({
          group: group.name,
          name: check.name,
          result: check.result,
          messages: check.messages ?? []
        });
      }
    }
  }

  return checks;
};

const check = (id, label, status, evidence, detail = "") => ({ id, label, status, evidence, detail });

const deriveStatus = (checks) => {
  if (checks.some((item) => item.status === "FAIL")) {
    return "FAIL";
  }
  if (checks.some((item) => item.status.startsWith("BLOCKED"))) {
    return "ACTION_REQUIRED";
  }
  if (checks.some((item) => item.status === "WARN")) {
    return "PASS_WITH_WARNINGS";
  }
  return "PASS";
};

export const auditSplunkbaseReadiness = async ({ root = ".", outDir = defaultPaths.outDir, generatedAt = new Date().toISOString() } = {}) => {
  const rootDir = resolve(root);
  const outPath = resolve(rootDir, outDir);
  const packageManifestPath = resolve(rootDir, defaultPaths.packageManifest);
  const appinspectPath = resolve(rootDir, defaultPaths.appinspect);
  const liveInstallPath = resolve(rootDir, defaultPaths.liveInstall);
  const receiptStorePath = resolve(rootDir, defaultPaths.receiptStore);
  const packageJsonPath = resolve(rootDir, defaultPaths.packageJson);
  const readmePath = resolve(rootDir, defaultPaths.readme);
  const licensePath = resolve(rootDir, defaultPaths.license);
  const screenshotsDir = resolve(rootDir, defaultPaths.screenshots);

  const packageManifest = await readJson(packageManifestPath);
  const appinspect = await readJson(appinspectPath);
  const liveInstall = await readJson(liveInstallPath);
  const receiptStore = await readJson(receiptStorePath);
  const packageJson = await readJson(packageJsonPath);
  const readme = await readFile(readmePath, "utf8");
  const licensePresent = existsSync(licensePath);
  const packagePath = resolve(rootDir, packageManifest.packagePath);
  const packageFiles = await tarList(packagePath);
  const appConf = await tarRead(packagePath, `${packageManifest.appId}/default/app.conf`);
  const meta = await tarRead(packagePath, `${packageManifest.appId}/metadata/default.meta`);
  const appinspectSummary = appinspect.summary ?? appinspect.reports?.[0]?.summary ?? {};
  const appinspectChecks = flattenAppInspectChecks(appinspect);
  const appinspectWarnings = appinspectChecks
    .filter((item) => item.result === "warning")
    .map((item) => ({
      group: item.group,
      name: item.name,
      messages: item.messages.map((message) => message.message).filter(Boolean)
    }));
  const screenshotFiles = (await listFiles(screenshotsDir))
    .filter((file) => extname(file).toLowerCase() === ".png");
  const screenshots = [];

  for (const file of screenshotFiles) {
    const dimensions = await pngDimensions(resolve(screenshotsDir, file));
    screenshots.push({ path: join(defaultPaths.screenshots, file), ...dimensions });
  }

  const listedPackageSha = packageManifest.packageSha256;
  const actualPackageSha = await sha256File(packagePath);
  const installProbeFailures = (liveInstall.probes ?? []).filter((probe) => probe.status !== "PASS");
  const listingAssetEntries = {
    appIcon: packageManifest.splunkbaseListingAssets?.appIcon ?? `${packageManifest.appId}/static/appIcon.png`,
    appIcon2x: packageManifest.splunkbaseListingAssets?.appIcon2x ?? `${packageManifest.appId}/static/appIcon_2x.png`,
    screenshot: packageManifest.splunkbaseListingAssets?.screenshot ?? `${packageManifest.appId}/static/screenshot.png`
  };
  const listingAssets = {
    appIcon: {
      path: listingAssetEntries.appIcon,
      dimensions: await packagedPng(packagePath, listingAssetEntries.appIcon),
      expected: { width: 36, height: 36 }
    },
    appIcon2x: {
      path: listingAssetEntries.appIcon2x,
      dimensions: await packagedPng(packagePath, listingAssetEntries.appIcon2x),
      expected: { width: 72, height: 72 }
    },
    screenshot: {
      path: listingAssetEntries.screenshot,
      dimensions: await packagedPng(packagePath, listingAssetEntries.screenshot),
      expected: { width: 623, height: 350 }
    }
  };
  const iconAssetsReady =
    dimensionsMatch(listingAssets.appIcon.dimensions, listingAssets.appIcon.expected) &&
    dimensionsMatch(listingAssets.appIcon2x.dimensions, listingAssets.appIcon2x.expected);
  const screenshotAssetReady = dimensionsMatch(listingAssets.screenshot.dimensions, listingAssets.screenshot.expected);

  const checks = [
    check(
      "package-archive",
      "Splunk app package exists and checksum matches manifest",
      existsSync(packagePath) && listedPackageSha === actualPackageSha ? "PASS" : "FAIL",
      packageManifest.packagePath,
      `sha256=${actualPackageSha}`
    ),
    check(
      "package-single-app-root",
      "Package extracts to one app root",
      packageFiles.every((file) => file.startsWith(`${packageManifest.appId}/`)) ? "PASS" : "FAIL",
      packageManifest.packagePath,
      `${packageFiles.length} packaged files`
    ),
    check(
      "app-conf-identity",
      "default/app.conf carries id, version, label, and package metadata",
      appConf.includes("[id]") && appConf.includes(`name = ${packageManifest.appId}`) && appConf.includes(`version = ${packageManifest.version}`)
        ? "PASS"
        : "FAIL",
      `${packageManifest.appId}/default/app.conf`,
      `version=${packageManifest.version}`
    ),
    check(
      "cloud-metadata-role",
      "metadata/default.meta grants write access to admin and sc_admin",
      meta.includes("write : [ admin, sc_admin ]") ? "PASS" : "FAIL",
      `${packageManifest.appId}/metadata/default.meta`
    ),
    check(
      "appinspect-precert",
      "AppInspect precertification has zero errors, failures, and future failures",
      (appinspectSummary.error ?? 0) === 0 && (appinspectSummary.failure ?? 0) === 0 && (appinspectSummary.future_failure ?? 0) === 0
        ? "PASS"
        : "FAIL",
      defaultPaths.appinspect,
      `success=${appinspectSummary.success ?? 0}; warnings=${appinspectSummary.warning ?? 0}`
    ),
    check(
      "expected-kv-warning",
      "Remaining AppInspect warning is limited to the intentional KV Store collection",
      appinspectWarnings.length === 1 && appinspectWarnings[0]?.name === "check_collections_conf" ? "PASS" : "WARN",
      defaultPaths.appinspect,
      appinspectWarnings.map((warning) => warning.name).join(", ") || "none"
    ),
    check(
      "credential-free-package",
      "Package manifest declares no credential files, Python REST handlers, or scripted inputs",
      packageManifest.noCredentialFiles && packageManifest.noPythonHandlers && packageManifest.noScriptedInputs ? "PASS" : "FAIL",
      defaultPaths.packageManifest
    ),
    check(
      "live-install-proof",
      "Operator-owned live Splunk install proof passes",
      liveInstall.status === "PASS" && liveInstall.install?.status === "PASS" && installProbeFailures.length === 0 ? "PASS" : "FAIL",
      defaultPaths.liveInstall,
      `${liveInstall.probes?.length ?? 0} probes; ${installProbeFailures.length} failed`
    ),
    check(
      "receipt-kv-proof",
      "Operator-owned receipt KV Store proof passes",
      receiptStore.status === "PASS" && receiptStore.write?.status === "PASS" && receiptStore.lookup?.status === "PASS" ? "PASS" : "FAIL",
      defaultPaths.receiptStore,
      `${receiptStore.lookup?.rowCount ?? 0} rows verified`
    ),
    check("license", "Repository ships an explicit license", licensePresent ? "PASS" : "FAIL", defaultPaths.license),
    check(
      "support-metadata",
      "Package metadata includes repository and issue tracker URLs",
      Boolean(packageJson.repository?.url && packageJson.bugs?.url) ? "PASS" : "WARN",
      defaultPaths.packageJson,
      packageJson.bugs?.url ?? "missing bugs URL"
    ),
    check(
      "splunkbase-doc-copy",
      "README mentions the Splunk app package and operator-owned install proof",
      readme.includes(packageManifest.packagePath) && readme.includes(defaultPaths.liveInstall) ? "PASS" : "WARN",
      defaultPaths.readme
    ),
    check(
      "listing-screenshots",
      "Submission evidence includes public-safe product screenshots",
      screenshots.length >= 4 ? "PASS" : "BLOCKED_REPO",
      defaultPaths.screenshots,
      `${screenshots.length} PNG screenshots`
    ),
    check(
      "app-icon",
      "Splunkbase app icon assets are packaged with exact dimensions",
      iconAssetsReady ? "PASS" : "BLOCKED_REPO",
      packageManifest.packagePath,
      `${listingAssets.appIcon.path}=${listingAssets.appIcon.dimensions?.width ?? "missing"}x${listingAssets.appIcon.dimensions?.height ?? "missing"}; ${listingAssets.appIcon2x.path}=${listingAssets.appIcon2x.dimensions?.width ?? "missing"}x${listingAssets.appIcon2x.dimensions?.height ?? "missing"}`
    ),
    check(
      "splunkbase-screenshot",
      "Splunkbase listing screenshot is packaged with exact dimensions",
      screenshotAssetReady ? "PASS" : "BLOCKED_REPO",
      packageManifest.packagePath,
      `${listingAssets.screenshot.path}=${listingAssets.screenshot.dimensions?.width ?? "missing"}x${listingAssets.screenshot.dimensions?.height ?? "missing"}`
    ),
    check(
      "publisher-account",
      "Splunkbase publisher account, support contact, and listing metadata are available",
      "BLOCKED_EXTERNAL",
      "Splunkbase publisher portal",
      "Requires operator account access; no credentials are stored in this repository."
    ),
    check(
      "splunkbase-upload",
      "Splunkbase upload/review has been submitted",
      "BLOCKED_EXTERNAL",
      "Splunkbase publisher portal",
      "Do not claim Available on Splunkbase until Splunkbase returns a public listing."
    ),
    check(
      "splunk-cloud-review",
      "Splunk Cloud review/listing status is confirmed",
      "BLOCKED_EXTERNAL",
      "Splunkbase/Splunk Cloud review",
      "External review status is not available from local evidence."
    )
  ];

  const report = {
    source: "splunkready-splunkbase-readiness",
    generatedAt,
    status: deriveStatus(checks),
    officialReferences,
    package: {
      path: packageManifest.packagePath,
      sha256: actualPackageSha,
      version: packageManifest.version,
      appId: packageManifest.appId,
      fileCount: packageFiles.length,
      listingAssets
    },
    appinspect: {
      path: defaultPaths.appinspect,
      summary: appinspectSummary,
      warnings: appinspectWarnings
    },
    liveEvidence: {
      installProof: defaultPaths.liveInstall,
      installStatus: liveInstall.status,
      installMutation: liveInstall.splunkMutation,
      installProbeCount: liveInstall.probes?.length ?? 0,
      receiptStoreProof: defaultPaths.receiptStore,
      receiptStoreStatus: receiptStore.status,
      receiptStoreMutation: receiptStore.splunkMutation,
      receiptRowsVerified: receiptStore.lookup?.rowCount ?? 0
    },
    screenshots,
    checks,
    nextActions: [
      "Prepare Splunkbase listing metadata, support contact, release notes, and public-safe screenshots in the publisher portal.",
      "Upload submission-evidence/splunk-app-package/SplunkReady-0.1.3.spl through an operator-owned Splunkbase publisher account.",
      "Claim the Splunkbase badge only after the public Splunkbase listing is visible."
    ]
  };

  await mkdir(outPath, { recursive: true });
  await writeFile(resolve(outPath, "splunkbase-readiness.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(resolve(outPath, "splunkbase-readiness.md"), renderMarkdown(report), "utf8");

  return report;
};

const renderMarkdown = (report) => {
  const checkRows = report.checks
    .map((item) => `| ${item.id} | ${item.status} | ${item.evidence} | ${item.detail || ""} |`)
    .join("\n");
  const warningRows = report.appinspect.warnings.length === 0
    ? "| none | PASS | |"
    : report.appinspect.warnings
        .map((warning) => `| ${warning.name} | warning | ${warning.messages.join(" ")} |`)
        .join("\n");
  const referenceRows = report.officialReferences
    .map((reference) => `- [${reference.title}](${reference.url})`)
    .join("\n");
  const nextActions = report.nextActions.map((item) => `- ${item}`).join("\n");
  const listingAssetRows = Object.entries(report.package.listingAssets)
    .map(([name, asset]) => {
      const actual = asset.dimensions ? `${asset.dimensions.width}x${asset.dimensions.height}` : "missing";
      const expected = `${asset.expected.width}x${asset.expected.height}`;
      return `| ${name} | \`${asset.path}\` | ${actual} | ${expected} |`;
    })
    .join("\n");

  return `# Splunkbase Readiness

Source: \`${report.source}\`

Status: \`${report.status}\`

Generated: \`${report.generatedAt}\`

## Package

- App ID: \`${report.package.appId}\`
- Version: \`${report.package.version}\`
- Package: \`${report.package.path}\`
- SHA256: \`${report.package.sha256}\`
- Files: \`${report.package.fileCount}\`

## Splunkbase Listing Assets

| Asset | Path | Actual | Expected |
| --- | --- | --- | --- |
${listingAssetRows}

## AppInspect

- Errors: \`${report.appinspect.summary.error ?? 0}\`
- Failures: \`${report.appinspect.summary.failure ?? 0}\`
- Future failures: \`${report.appinspect.summary.future_failure ?? 0}\`
- Warnings: \`${report.appinspect.summary.warning ?? 0}\`
- Successes: \`${report.appinspect.summary.success ?? 0}\`

| Check | Result | Message |
| --- | --- | --- |
${warningRows}

## Checklist

| Requirement | Status | Evidence | Detail |
| --- | --- | --- | --- |
${checkRows}

## Live Evidence

- Install proof: \`${report.liveEvidence.installProof}\` (\`${report.liveEvidence.installStatus}\`, \`${report.liveEvidence.installMutation}\`)
- Receipt store proof: \`${report.liveEvidence.receiptStoreProof}\` (\`${report.liveEvidence.receiptStoreStatus}\`, \`${report.liveEvidence.receiptStoreMutation}\`)
- Receipt rows verified through Splunk lookup: \`${report.liveEvidence.receiptRowsVerified}\`

## Official References

${referenceRows}

## Next Actions

${nextActions}
`;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const report = await auditSplunkbaseReadiness(args);

  if (args.jsonOnly) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Wrote ${join(args.outDir, "splunkbase-readiness.json")}\n`);
    process.stdout.write(`Status: ${report.status}\n`);
  }

  if (report.status === "FAIL") {
    process.exitCode = 1;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
