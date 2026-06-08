#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const dossierPath = "submission-evidence/splunkbase-readiness/splunkbase-listing-dossier.json";
const readinessPath = "submission-evidence/splunkbase-readiness/splunkbase-readiness.json";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const sha256File = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");

const fail = (message) => {
  throw new Error(message);
};

const requireString = (value, path) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${path} must be a non-empty string`);
  }
};

const main = async () => {
  const dossier = await readJson(dossierPath);
  const readiness = await readJson(readinessPath);
  const packagePath = dossier.package?.path;

  requireString(dossier.source, "source");
  requireString(dossier.status, "status");
  requireString(packagePath, "package.path");

  if (dossier.source !== "splunkready-splunkbase-listing-dossier") {
    fail("unexpected dossier source");
  }

  if (dossier.status !== "READY_FOR_OPERATOR_SUBMISSION") {
    fail("dossier must remain READY_FOR_OPERATOR_SUBMISSION until a real public listing exists");
  }

  if (!Array.isArray(dossier.doNotClaim) || !dossier.doNotClaim.some((item) => item.includes("Available on Splunkbase"))) {
    fail("dossier must include the no-Splunkbase-approval guardrail");
  }

  if (!existsSync(packagePath)) {
    fail(`package path does not exist: ${packagePath}`);
  }

  const packageSha = await sha256File(packagePath);

  if (packageSha !== dossier.package.sha256) {
    fail(`package sha mismatch: dossier=${dossier.package.sha256} actual=${packageSha}`);
  }

  if (readiness.package?.sha256 !== dossier.package.sha256) {
    fail("dossier package sha does not match splunkbase readiness report");
  }

  if (readiness.package?.appId !== dossier.package.appId || readiness.package?.version !== dossier.package.version) {
    fail("dossier package identity does not match splunkbase readiness report");
  }

  const appInspect = dossier.package.appInspect;

  if (
    appInspect.errors !== 0 ||
    appInspect.failures !== 0 ||
    appInspect.futureFailures !== 0 ||
    appInspect.expectedWarning !== "check_collections_conf"
  ) {
    fail("dossier AppInspect summary must preserve zero-error/failure evidence and expected warning");
  }

  const support = dossier.portalFields?.metadata?.support;

  if (support?.status !== "OPERATOR_REQUIRED") {
    fail("support contact must remain operator-required until a monitored publisher contact is known");
  }

  for (const field of [
    ["portalFields.appInformation.name", dossier.portalFields?.appInformation?.name],
    ["portalFields.appInformation.tagline", dossier.portalFields?.appInformation?.tagline],
    ["portalFields.metadata.shortDescription", dossier.portalFields?.metadata?.shortDescription],
    ["portalFields.releaseInformation.version", dossier.portalFields?.releaseInformation?.version],
    ["portalFields.releaseInformation.upgradeInstructions", dossier.portalFields?.releaseInformation?.upgradeInstructions]
  ]) {
    requireString(field[1], field[0]);
  }

  const releaseNotes = dossier.portalFields?.releaseInformation?.releaseNotes ?? [];

  if (!Array.isArray(releaseNotes) || releaseNotes.length < 3) {
    fail("release notes must contain at least three concrete bullets");
  }

  const requiredRefs = new Set([
    "submit-splunkbase-apps",
    "splunkbase-file-standards",
    "upload-validate-app-package",
    "publish-app"
  ]);
  const actualRefs = new Set((dossier.officialReferences ?? []).map((reference) => reference.id));

  for (const reference of requiredRefs) {
    if (!actualRefs.has(reference)) {
      fail(`dossier missing official reference ${reference}`);
    }
  }

  process.stdout.write("PASS splunkbase listing dossier audited\n");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
