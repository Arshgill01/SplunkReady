import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type LiveSecurityKitValidationStatus = "PASS" | "FAIL";

export interface LiveSecurityKitValidationCheck {
  id: string;
  status: LiveSecurityKitValidationStatus;
  path: string;
  detail: string;
}

export interface LiveSecurityKitValidationReport {
  status: LiveSecurityKitValidationStatus;
  expectedFiles: string[];
  checks: LiveSecurityKitValidationCheck[];
}

export const liveSecurityKitExpectedFiles = [
  "SplunkEnterpriseSecuritySuite/default/app.conf",
  "SplunkEnterpriseSecuritySuite/default/indexes.conf",
  "SplunkEnterpriseSecuritySuite/default/props.conf",
  "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
  "lateral-movement-events.csv",
  "README.md"
] as const;

export const liveSecurityKitOperatorWarnings = [
  "Operator-owned install/import only; SplunkReady generated local files and performs no Splunk write operation.",
  "If Enterprise Security is already installed, do not overwrite its app directory; merge the generated stanzas through normal Splunk administration."
] as const;

export const liveSecurityKitCleanupGuidance = [
  "Cleanup is operator-owned and outside SplunkReady.",
  "For disposable trials, remove or disable the generated SplunkReady app only through normal Splunk admin controls.",
  "Delete imported sample events only in an approved disposable environment; do not run destructive cleanup against production data."
] as const;

const pass = (id: string, path: string, detail: string): LiveSecurityKitValidationCheck => ({ id, status: "PASS", path, detail });

const fail = (id: string, path: string, detail: string): LiveSecurityKitValidationCheck => ({ id, status: "FAIL", path, detail });

const readKitFile = async (outDir: string, path: string): Promise<string | undefined> => {
  try {
    return await readFile(join(outDir, path), "utf8");
  } catch {
    return undefined;
  }
};

const checkIncludes = (
  id: string,
  path: string,
  content: string | undefined,
  expected: string,
  detail: string
): LiveSecurityKitValidationCheck => {
  if (!content) {
    return fail(id, path, `${path} is missing.`);
  }

  return content.includes(expected) ? pass(id, path, detail) : fail(id, path, `${path} does not include ${expected}.`);
};

export const validateLiveSecurityKit = async (outDir: string): Promise<LiveSecurityKitValidationReport> => {
  const appConf = await readKitFile(outDir, "SplunkEnterpriseSecuritySuite/default/app.conf");
  const indexes = await readKitFile(outDir, "SplunkEnterpriseSecuritySuite/default/indexes.conf");
  const props = await readKitFile(outDir, "SplunkEnterpriseSecuritySuite/default/props.conf");
  const savedSearches = await readKitFile(outDir, "SplunkEnterpriseSecuritySuite/default/savedsearches.conf");
  const sampleEvents = await readKitFile(outDir, "lateral-movement-events.csv");
  const readme = await readKitFile(outDir, "README.md");
  const contentByPath = new Map<string, string | undefined>([
    ["SplunkEnterpriseSecuritySuite/default/app.conf", appConf],
    ["SplunkEnterpriseSecuritySuite/default/indexes.conf", indexes],
    ["SplunkEnterpriseSecuritySuite/default/props.conf", props],
    ["SplunkEnterpriseSecuritySuite/default/savedsearches.conf", savedSearches],
    ["lateral-movement-events.csv", sampleEvents],
    ["README.md", readme]
  ]);
  const sampleRows = sampleEvents?.trim().split(/\r?\n/).slice(1) ?? [];
  const sampleRefs = sampleRows.map((row) => row.split(",")[1] ?? "");
  const checks: LiveSecurityKitValidationCheck[] = [
    ...liveSecurityKitExpectedFiles.map((path) =>
      contentByPath.get(path)
        ? pass(`file-present:${path}`, path, `${path} was generated.`)
        : fail(`file-present:${path}`, path, `${path} is missing.`)
    ),
    checkIncludes(
      "app-context",
      "SplunkEnterpriseSecuritySuite/default/app.conf",
      appConf,
      "label = SplunkReady Security Readiness",
      "Generated app context is labeled for SplunkReady security readiness."
    ),
    checkIncludes(
      "index-stanza",
      "SplunkEnterpriseSecuritySuite/default/indexes.conf",
      indexes,
      "[wineventlog]",
      "Expected wineventlog index stanza is present."
    ),
    checkIncludes(
      "sourcetype-stanza",
      "SplunkEnterpriseSecuritySuite/default/props.conf",
      props,
      "[XmlWinEventLog:Security]",
      "Expected XmlWinEventLog:Security props stanza is present."
    ),
    checkIncludes(
      "saved-search-stanza",
      "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
      savedSearches,
      "[ES - Lateral Movement Auth Chain]",
      "Expected lateral-movement saved-search stanza is present."
    ),
    checkIncludes(
      "saved-search-index",
      "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
      savedSearches,
      "index=wineventlog",
      "Saved search targets the operator-owned wineventlog index."
    ),
    checkIncludes(
      "saved-search-window",
      "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
      savedSearches,
      "dispatch.earliest_time = -24h",
      "Saved search uses the configured dispatch time window instead of inline earliest."
    ),
    checkIncludes(
      "saved-search-event-ref",
      "SplunkEnterpriseSecuritySuite/default/savedsearches.conf",
      savedSearches,
      "dedup eventRef",
      "Saved search preserves row-level evidence refs."
    ),
    sampleRows.length === 3
      ? pass("sample-row-count", "lateral-movement-events.csv", "Exactly three sample evidence rows are present.")
      : fail("sample-row-count", "lateral-movement-events.csv", `Expected 3 sample rows, found ${sampleRows.length}.`),
    ["live-evt-102", "live-evt-118", "live-evt-141"].every((ref) => sampleRefs.includes(ref))
      ? pass("sample-event-refs", "lateral-movement-events.csv", "Expected lateral-movement evidence refs are present.")
      : fail("sample-event-refs", "lateral-movement-events.csv", "Expected live-evt-102, live-evt-118, and live-evt-141."),
    sampleRows.length > 0 && sampleRows.every((row) => row.includes("XmlWinEventLog:Security"))
      ? pass("sample-sourcetype", "lateral-movement-events.csv", "Sample rows use XmlWinEventLog:Security.")
      : fail("sample-sourcetype", "lateral-movement-events.csv", "Sample rows must use XmlWinEventLog:Security."),
    checkIncludes(
      "operator-owned-boundary",
      "README.md",
      readme,
      "SplunkReady will not do that automatically",
      "README keeps install/import responsibility with the operator."
    ),
    checkIncludes(
      "existing-es-warning",
      "README.md",
      readme,
      "If Splunk Enterprise Security is already installed, do not blindly overwrite that app.",
      "README warns operators not to overwrite existing Enterprise Security deployments."
    ),
    checkIncludes(
      "cleanup-guidance",
      "README.md",
      readme,
      "Cleanup is operator-owned and outside SplunkReady.",
      "README includes cleanup guidance."
    )
  ];

  return {
    status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL",
    expectedFiles: [...liveSecurityKitExpectedFiles],
    checks
  };
};
