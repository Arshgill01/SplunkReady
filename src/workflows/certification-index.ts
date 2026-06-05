import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { readinessReceiptSchema, type EnvironmentContract, type ReadinessReceipt } from "../schemas/core.js";
import { manifestFailureDetail, verifyProofManifest, type ProofManifestVerification } from "./proof-manifest.js";

type ProofAuditStatus = "PASS" | "WARN" | "FAIL";
type ProofLoop = "fail-to-pass" | "ready-without-patch" | "not-ready-after-rerun" | "mixed-verdict";

interface ProofAuditCheck {
  id: string;
  status: ProofAuditStatus;
  detail: string;
  evidence?: unknown;
}

interface ProofAuditReport {
  status: ProofAuditStatus;
  proofType: "live-security" | "live" | "receipt" | "firewall-block" | "suite" | "external-trace" | "unknown";
  proofDir: string;
  mode?: EnvironmentContract["mode"];
  mutation?: boolean;
  failToPass?: boolean;
  readyAfterPatch?: boolean;
  readyWithoutPatch?: boolean;
  proofLoop?: ProofLoop;
  hostedModelStatus?: string;
  checks: ProofAuditCheck[];
}

export interface CertificationIndexEntry {
  label: string;
  proofDir: string;
  proofType: ProofAuditReport["proofType"] | "missing";
  status: ProofAuditStatus;
  manifestStatus: ProofManifestVerification["status"] | "UNVERIFIED" | "MISSING";
  mode?: EnvironmentContract["mode"];
  mutation: boolean | null;
  agent: {
    name: string;
    version: string;
  };
  receipt: {
    id: string;
    verdict: string;
    score: number;
    violations: number;
    evidenceRefs: number;
  } | null;
  missions: string[];
  domains: string[];
  proofLoop?: ProofLoop;
  hostedModelStatus?: string;
  manifest?: {
    aggregateSha256: string;
    files: number;
  };
  href: string;
}

export interface CertificationIndex {
  status: ProofAuditStatus;
  source: "splunkready-certification-index";
  mutation: boolean;
  generatedAt: string;
  proofDirs: string[];
  totals: {
    proofs: number;
    ready: number;
    notReady: number;
    pass: number;
    warn: number;
    fail: number;
  };
  entries: CertificationIndexEntry[];
}

interface UiArtifactManifest {
  source: "splunkready-ui-artifacts";
  generatedAt: string;
  defaultArtifact: string;
  artifacts: Array<{
    label: string;
    path: string;
  }>;
}

export interface CertificationIndexWorkflowInput {
  outDir: string;
  proofDirs: string[];
  proofArtifactBases?: string[];
  indexArtifactBase?: string;
  requirePass?: boolean;
  generatedAt?: string;
  verifyInputs?: boolean;
}

export interface CertificationIndexWorkflowResult {
  status: "PASS" | "WARN" | "FAIL";
  outDir: string;
  artifacts: string[];
  mutation: boolean;
  messages: string[];
}

const defaultGeneratedAt = "2026-06-01T06:45:00.000Z";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringFromRecord = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

const booleanFromRecord = (value: unknown, key: string): boolean | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "boolean" ? field : undefined;
};

const readOptionalJson = async <T>(filePath: string): Promise<T | undefined> =>
  readFile(filePath, "utf8")
    .then((input) => JSON.parse(input) as T)
    .catch(() => undefined);

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const labelFromProofDir = (proofDir: string): string => {
  const parts = proofDir.split(/[\\/]/).filter((part) => part.length > 0);

  return parts.at(-1) ?? proofDir;
};

const parseProofAuditReport = (input: unknown): ProofAuditReport | undefined => {
  if (!isRecord(input)) {
    return undefined;
  }

  const status = stringFromRecord(input, "status");
  const proofType = stringFromRecord(input, "proofType");
  const proofDir = stringFromRecord(input, "proofDir");
  const mode = stringFromRecord(input, "mode");
  const proofLoop = stringFromRecord(input, "proofLoop");
  const proofTypes: ProofAuditReport["proofType"][] = [
    "live-security",
    "live",
    "receipt",
    "firewall-block",
    "suite",
    "external-trace",
    "unknown"
  ];
  const proofLoops: ProofLoop[] = ["fail-to-pass", "ready-without-patch", "not-ready-after-rerun", "mixed-verdict"];
  const checks = Array.isArray(input.checks) ? input.checks.filter(isRecord) : undefined;

  if (
    (status !== "PASS" && status !== "WARN" && status !== "FAIL") ||
    !proofType ||
    !proofTypes.includes(proofType as ProofAuditReport["proofType"]) ||
    !proofDir ||
    !checks
  ) {
    return undefined;
  }

  return {
    status,
    proofType: proofType as ProofAuditReport["proofType"],
    proofDir,
    mode: mode === "fixture" || mode === "live" ? mode : undefined,
    mutation: booleanFromRecord(input, "mutation"),
    failToPass: booleanFromRecord(input, "failToPass"),
    readyAfterPatch: booleanFromRecord(input, "readyAfterPatch"),
    readyWithoutPatch: booleanFromRecord(input, "readyWithoutPatch"),
    proofLoop: proofLoop && proofLoops.includes(proofLoop as ProofLoop) ? (proofLoop as ProofLoop) : undefined,
    hostedModelStatus: stringFromRecord(input, "hostedModelStatus"),
    checks: checks.map((check) => {
      const checkStatus = stringFromRecord(check, "status");

      return {
        id: stringFromRecord(check, "id") ?? "unknown-check",
        status: checkStatus === "PASS" || checkStatus === "WARN" || checkStatus === "FAIL" ? checkStatus : "FAIL",
        detail: stringFromRecord(check, "detail") ?? "No detail recorded.",
        evidence: check.evidence
      };
    })
  };
};

const receiptForIndex = async (proofDir: string): Promise<ReadinessReceipt | undefined> => {
  const candidates = ["receipt-after-001.json", "receipt-external-001.json", "receipt-before-001.json"];

  for (const fileName of candidates) {
    const input = await readOptionalJson<unknown>(join(proofDir, fileName));
    const result = input ? readinessReceiptSchema.safeParse(input) : undefined;

    if (result?.success) {
      return result.data;
    }
  }

  return undefined;
};

const missionFactsForIndex = async (proofDir: string): Promise<{ missions: string[]; domains: string[] }> => {
  const missionInputs = await readOptionalJson<unknown>(join(proofDir, "missions.json"));
  const suiteSummary = await readOptionalJson<unknown>(join(proofDir, "suite-proof-summary.json"));
  const directMissions = Array.isArray(missionInputs) ? missionInputs.filter(isRecord) : [];
  const suiteMissions = isRecord(suiteSummary) && Array.isArray(suiteSummary.missions) ? suiteSummary.missions.filter(isRecord) : [];
  const missionIds = [...directMissions, ...suiteMissions]
    .map((mission) => stringFromRecord(mission, "id") ?? stringFromRecord(mission, "missionId"))
    .filter((missionId): missionId is string => Boolean(missionId));
  const domains = [...directMissions, ...suiteMissions]
    .map((mission) => stringFromRecord(mission, "domain"))
    .filter((domain): domain is string => Boolean(domain));

  return {
    missions: [...new Set(missionIds)].sort(),
    domains: [...new Set(domains)].sort()
  };
};

const certificationIndexEntry = async (proofDir: string): Promise<CertificationIndexEntry> => {
  const audit = parseProofAuditReport(await readOptionalJson<unknown>(join(proofDir, "proof-audit.json")));
  const manifestInput = await readOptionalJson<unknown>(join(proofDir, "proof-manifest.json"));
  const verificationInput = await readOptionalJson<unknown>(join(proofDir, "proof-manifest-verification.json"));
  const manifest = isRecord(manifestInput) ? manifestInput : undefined;
  const verification = isRecord(verificationInput) ? verificationInput : undefined;
  const verificationStatus = stringFromRecord(verification, "status");
  const manifestStatus =
    verificationStatus === "PASS" || verificationStatus === "FAIL" ? verificationStatus : manifest ? "UNVERIFIED" : "MISSING";
  const manifestAggregateSha256 = stringFromRecord(manifest, "aggregateSha256");
  const manifestFiles = Array.isArray(manifest?.files) ? manifest.files.length : undefined;
  const receipt = await receiptForIndex(proofDir);
  const suiteSummary = await readOptionalJson<unknown>(join(proofDir, "suite-proof-summary.json"));
  const suiteTitle = stringFromRecord(suiteSummary, "suiteTitle") ?? stringFromRecord(suiteSummary, "suiteId");
  const label = receipt ? receipt.agent.name : suiteTitle ?? labelFromProofDir(proofDir);
  const missionFacts = await missionFactsForIndex(proofDir);

  return {
    label,
    proofDir,
    proofType: audit?.proofType ?? "missing",
    status: audit?.status ?? "FAIL",
    manifestStatus,
    mode: audit?.mode ?? receipt?.mode,
    mutation: audit?.mutation ?? null,
    agent: receipt?.agent ?? { name: label, version: "n/a" },
    receipt: receipt
      ? {
          id: receipt.id,
          verdict: receipt.verdict,
          score: receipt.score,
          violations: receipt.violations.length,
          evidenceRefs: receipt.evidenceRefs.length
        }
      : null,
    missions: missionFacts.missions,
    domains: missionFacts.domains,
    proofLoop: audit?.proofLoop,
    hostedModelStatus: audit?.hostedModelStatus,
    manifest:
      manifestAggregateSha256 && manifestFiles !== undefined
        ? {
            aggregateSha256: manifestAggregateSha256,
            files: manifestFiles
          }
        : undefined,
    href: `?artifacts=${encodeURIComponent(proofDir)}#receipt`
  };
};

const uniqueUiArtifacts = (artifacts: UiArtifactManifest["artifacts"]): UiArtifactManifest["artifacts"] => {
  const seen = new Set<string>();

  return artifacts.filter((artifact) => {
    if (seen.has(artifact.path)) {
      return false;
    }

    seen.add(artifact.path);
    return true;
  });
};

const artifactLabelForIndexEntry = (entry: CertificationIndexEntry): string => {
  const suffixes = [entry.agent.version, entry.proofLoop, entry.status].filter((suffix) => suffix && suffix !== "n/a").join(" / ");

  return suffixes ? `${entry.label} - ${suffixes}` : entry.label;
};

const uiArtifactManifestFromIndex = (defaultArtifact: string, entries: CertificationIndexEntry[], generatedAt: string): UiArtifactManifest => ({
  source: "splunkready-ui-artifacts",
  generatedAt,
  defaultArtifact,
  artifacts: uniqueUiArtifacts([
    { label: "Certification index", path: defaultArtifact },
    ...entries.map((entry) => ({
      label: artifactLabelForIndexEntry(entry),
      path: entry.proofDir
    }))
  ])
});

export const writeCertificationIndex = async (
  input: CertificationIndexWorkflowInput
): Promise<{ artifacts: string[]; index: CertificationIndex }> => {
  const generatedAt = input.generatedAt ?? defaultGeneratedAt;
  const proofDirs = [...new Set(input.proofDirs.map((proofDir) => proofDir.trim()).filter((proofDir) => proofDir.length > 0))];

  if (proofDirs.length === 0) {
    throw new Error("certification-index requires --proof-dirs <dir[,dir]>.");
  }

  const entries = await Promise.all(proofDirs.map(certificationIndexEntry));
  const totals = {
    proofs: entries.length,
    ready: entries.filter((entry) => entry.receipt?.verdict === "READY").length,
    notReady: entries.filter((entry) => entry.receipt && entry.receipt.verdict !== "READY").length,
    pass: entries.filter((entry) => entry.status === "PASS").length,
    warn: entries.filter((entry) => entry.status === "WARN").length,
    fail: entries.filter((entry) => entry.status === "FAIL").length
  };
  const status: ProofAuditStatus = totals.fail > 0 ? "FAIL" : totals.warn > 0 ? "WARN" : "PASS";
  const index: CertificationIndex = {
    status,
    source: "splunkready-certification-index",
    mutation: entries.some((entry) => entry.mutation === true),
    generatedAt,
    proofDirs,
    totals,
    entries
  };
  const indexPath = join(input.outDir, "certification-index.json");
  const manifestPath = join(input.outDir, "ui-artifacts.json");

  await writeJson(indexPath, index);
  await writeJson(manifestPath, uiArtifactManifestFromIndex(input.outDir, entries, generatedAt));

  if (input.requirePass && status !== "PASS") {
    throw new Error(`certification-index strict gate failed with ${status}. Inspect ${indexPath}.`);
  }

  return { artifacts: [indexPath, manifestPath], index };
};

export const runCertificationIndexWorkflow = async (
  input: CertificationIndexWorkflowInput
): Promise<CertificationIndexWorkflowResult> => {
  const generatedAt = input.generatedAt ?? defaultGeneratedAt;
  const proofDirs = [...new Set(input.proofDirs.map((proofDir) => proofDir.trim()).filter((proofDir) => proofDir.length > 0))];

  if (input.verifyInputs !== false && proofDirs.length < 2) {
    throw new Error("certification-index workbench requires at least two managed proof runs.");
  }

  if (input.verifyInputs !== false) {
    const verificationReports = await Promise.all(
      proofDirs.map(async (proofDir) => {
        const { report } = await verifyProofManifest({ outDir: proofDir, generatedAt });

        return report;
      })
    );
    const failed = verificationReports.filter((report) => report.status !== "PASS");

    if (failed.length > 0) {
      throw new Error(
        `Cannot index unverifiable proof bundle(s): ${failed
          .map((report) => `${report.proofDir} ${report.status} (${manifestFailureDetail(report)})`)
          .join("; ")}.`
      );
    }
  }

  const { artifacts, index } = await writeCertificationIndex({
    ...input,
    proofDirs,
    requirePass: input.requirePass ?? false,
    generatedAt
  });
  const indexPath = join(input.outDir, "certification-index.json");
  const manifestPath = join(input.outDir, "ui-artifacts.json");
  const artifactBases = input.proofArtifactBases;
  let finalIndex = index;

  if (artifactBases && artifactBases.length === index.entries.length) {
    const entries = index.entries.map((entry, indexEntry) => {
      const proofDir = artifactBases[indexEntry] ?? entry.proofDir;

      return {
        ...entry,
        proofDir,
        href: `?artifacts=${encodeURIComponent(proofDir)}#receipt`
      };
    });

    finalIndex = {
      ...index,
      proofDirs: artifactBases,
      entries
    };
    await writeJson(indexPath, finalIndex);
    await writeJson(manifestPath, uiArtifactManifestFromIndex(input.indexArtifactBase ?? input.outDir, entries, generatedAt));
  }

  return {
    status: finalIndex.status,
    outDir: input.outDir,
    artifacts,
    mutation: finalIndex.mutation,
    messages: [`Indexed ${proofDirs.length} verified managed proof run(s).`]
  };
};
