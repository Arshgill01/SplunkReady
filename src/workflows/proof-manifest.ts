import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

export interface ProofManifestFile {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface ProofManifest {
  source: "splunkready-proof-manifest";
  generatedAt: string;
  proofDir: string;
  aggregateSha256: string;
  files: ProofManifestFile[];
}

export interface ProofManifestVerification {
  source: "splunkready-proof-manifest-verification";
  generatedAt: string;
  status: "PASS" | "FAIL";
  proofDir: string;
  manifestPath: string;
  expectedAggregateSha256: string;
  actualAggregateSha256: string;
  expectedFiles: number;
  actualFiles: number;
  missingFiles: string[];
  unexpectedFiles: string[];
  changedFiles: Array<{
    path: string;
    expectedSha256: string;
    actualSha256: string;
    expectedSizeBytes: number;
    actualSizeBytes: number;
  }>;
}

export interface ProofManifestVerificationInput {
  outDir: string;
  generatedAt: string;
}

const proofManifestExcludedFiles = new Set(["proof-manifest.json", "proof-manifest-verification.json"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringFromRecord = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

const numberFromRecord = (value: unknown, key: string): number | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "number" ? field : undefined;
};

const readJson = async <T>(filePath: string, label: string): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    throw new Error(`Unable to read ${label} at ${filePath}. Run the prerequisite CLI command first.`);
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const collectProofManifestFiles = async (proofDir: string, currentDir = proofDir): Promise<string[]> => {
  const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        return collectProofManifestFiles(proofDir, filePath);
      }

      if (!entry.isFile() || proofManifestExcludedFiles.has(entry.name)) {
        return [];
      }

      return [filePath];
    })
  );

  return files.flat();
};

const proofManifestPath = (proofDir: string, filePath: string): string =>
  relative(proofDir, filePath).split(sep).join("/");

const sha256Hex = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

export const buildProofManifest = async (proofDir: string, generatedAt: string): Promise<ProofManifest> => {
  const filePaths = await collectProofManifestFiles(proofDir);
  const files = (
    await Promise.all(
      filePaths.map(async (filePath) => {
        const content = await readFile(filePath);

        return {
          path: proofManifestPath(proofDir, filePath),
          sizeBytes: content.byteLength,
          sha256: sha256Hex(content)
        };
      })
    )
  ).sort((left, right) => left.path.localeCompare(right.path));
  const aggregateInput = files.map((file) => `${file.path}:${file.sizeBytes}:${file.sha256}`).join("\n");

  return {
    source: "splunkready-proof-manifest",
    generatedAt,
    proofDir,
    aggregateSha256: sha256Hex(aggregateInput),
    files
  };
};

export const parseProofManifest = (input: unknown, label: string): ProofManifest => {
  if (!isRecord(input)) {
    throw new Error(`${label} is not a proof manifest object.`);
  }

  const source = stringFromRecord(input, "source");
  const generatedAtValue = stringFromRecord(input, "generatedAt");
  const proofDir = stringFromRecord(input, "proofDir");
  const aggregateSha256 = stringFromRecord(input, "aggregateSha256");
  const fileInputs = Array.isArray(input.files) ? input.files : undefined;

  if (
    source !== "splunkready-proof-manifest" ||
    !generatedAtValue ||
    !proofDir ||
    !aggregateSha256 ||
    !fileInputs
  ) {
    throw new Error(`${label} is missing required proof manifest fields.`);
  }

  const files = fileInputs.map((fileInput, index): ProofManifestFile => {
    if (!isRecord(fileInput)) {
      throw new Error(`${label} contains a non-object file entry at index ${index}.`);
    }

    const path = stringFromRecord(fileInput, "path");
    const sizeBytes = numberFromRecord(fileInput, "sizeBytes");
    const sha256 = stringFromRecord(fileInput, "sha256");

    if (!path || sizeBytes === undefined || !sha256) {
      throw new Error(`${label} contains an incomplete file entry at index ${index}.`);
    }

    return { path, sizeBytes, sha256 };
  });

  return {
    source,
    generatedAt: generatedAtValue,
    proofDir,
    aggregateSha256,
    files
  };
};

export const writeProofManifest = async (proofDir: string, generatedAt: string): Promise<string> => {
  const manifestPath = join(proofDir, "proof-manifest.json");

  await writeJson(manifestPath, await buildProofManifest(proofDir, generatedAt));

  return manifestPath;
};

export const verifyProofManifest = async (
  input: ProofManifestVerificationInput
): Promise<{ report: ProofManifestVerification; reportPath: string }> => {
  const manifestPath = join(input.outDir, "proof-manifest.json");
  const reportPath = join(input.outDir, "proof-manifest-verification.json");
  const expected = parseProofManifest(await readJson<unknown>(manifestPath, "proof manifest"), manifestPath);
  const actual = await buildProofManifest(input.outDir, input.generatedAt);
  const expectedFiles = new Map(expected.files.map((file) => [file.path, file]));
  const actualFiles = new Map(actual.files.map((file) => [file.path, file]));
  const missingFiles = expected.files
    .filter((file) => !actualFiles.has(file.path))
    .map((file) => file.path)
    .sort();
  const unexpectedFiles = actual.files
    .filter((file) => !expectedFiles.has(file.path))
    .map((file) => file.path)
    .sort();
  const changedFiles = expected.files
    .flatMap((expectedFile) => {
      const actualFile = actualFiles.get(expectedFile.path);

      if (!actualFile || (actualFile.sha256 === expectedFile.sha256 && actualFile.sizeBytes === expectedFile.sizeBytes)) {
        return [];
      }

      return [
        {
          path: expectedFile.path,
          expectedSha256: expectedFile.sha256,
          actualSha256: actualFile.sha256,
          expectedSizeBytes: expectedFile.sizeBytes,
          actualSizeBytes: actualFile.sizeBytes
        }
      ];
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  const status: ProofManifestVerification["status"] =
    expected.aggregateSha256 === actual.aggregateSha256 &&
    missingFiles.length === 0 &&
    unexpectedFiles.length === 0 &&
    changedFiles.length === 0
      ? "PASS"
      : "FAIL";
  const report: ProofManifestVerification = {
    source: "splunkready-proof-manifest-verification",
    generatedAt: input.generatedAt,
    status,
    proofDir: input.outDir,
    manifestPath,
    expectedAggregateSha256: expected.aggregateSha256,
    actualAggregateSha256: actual.aggregateSha256,
    expectedFiles: expected.files.length,
    actualFiles: actual.files.length,
    missingFiles,
    unexpectedFiles,
    changedFiles
  };

  await writeJson(reportPath, report);

  return { report, reportPath };
};

export const manifestFailureDetail = (report: ProofManifestVerification): string => {
  const details = [
    report.missingFiles.length > 0 ? `missing ${report.missingFiles.join(", ")}` : undefined,
    report.unexpectedFiles.length > 0 ? `unexpected ${report.unexpectedFiles.join(", ")}` : undefined,
    report.changedFiles.length > 0 ? `changed ${report.changedFiles.map((file) => file.path).join(", ")}` : undefined
  ].filter((detail): detail is string => Boolean(detail));

  return details.length > 0 ? details.join("; ") : "aggregate hash mismatch";
};
