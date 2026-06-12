import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const requiredArtifactDirs = ["mcp-proof", "suite-proof", "ci-pr-gate", "public-proof-export", "real-splunk-stress-llm-layer"];
const generatedArtifactDirs = ["judge-proof"];
const interactiveSourceDir = "judge-proof/suite-proof/mission-security-lateral-movement-readiness";
const interactiveArtifactDir = "interactive-demo";
const execFileAsync = promisify(execFile);
export const publicDemoInputPaths = [
  "fixtures",
  "scripts/export-public-demo.js",
  "scripts/audit-public-demo-export.mjs",
  "src",
  "submission-evidence/ci-pr-gate",
  "submission-evidence/mcp-proof",
  "submission-evidence/public-proof-export",
  "submission-evidence/real-splunk-stress-llm-layer",
  "submission-evidence/screenshots",
  "submission-evidence/suite-proof",
  "ui",
  "vite.config.ts"
];

const isContained = (root, target) => {
  const relativePath = relative(root, target);

  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes(`..${sep}`));
};

const copyTree = async (source, target, root = source) => {
  const sourcePath = resolve(source);
  const targetPath = resolve(target);
  const sourceRoot = resolve(root);

  if (!isContained(sourceRoot, sourcePath)) {
    throw new Error(`Source path escapes public demo export root: ${source}`);
  }

  const info = await lstat(sourcePath);

  if (info.isSymbolicLink()) {
    throw new Error(`Refusing to copy symbolic link into public demo export: ${source}`);
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
  const entries = [];

  for (const entry of await readdir(dir)) {
    const path = resolve(dir, entry);
    const info = await lstat(path);

    if (info.isSymbolicLink()) {
      throw new Error(`Refusing to inspect symbolic link in public demo export: ${path}`);
    }

    if (info.isDirectory()) {
      entries.push(...await listRelativeFiles(path, root));
    } else if (info.isFile()) {
      entries.push(relative(root, path));
    }
  }

  return entries.sort();
};

const parseArgs = (argv) => {
  const outIndex = argv.indexOf("--out");

  return {
    outDir: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/public-demo"
  };
};

const credentialFreeEnv = () =>
  Object.fromEntries(
    Object.entries({
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: process.env.NODE_ENV,
      NO_COLOR: "1",
      SPLUNKREADY_LLM_ENABLED: "false",
      GEMINI_API_KEY: ""
    }).filter(([, value]) => value !== undefined)
  );

const runCredentialFreeJudgeProof = async ({ repoRoot, targetArtifactDir }) => {
  const cliPath = resolve(repoRoot, "dist/src/cli.js");
  const relativeOutDir = relative(repoRoot, targetArtifactDir).split(sep).join("/");

  await execFileAsync(process.execPath, [cliPath, "judge-proof", "--out", relativeOutDir, "--json"], {
    cwd: repoRoot,
    env: credentialFreeEnv(),
    maxBuffer: 10 * 1024 * 1024
  });
};

const gitCommit = async (repoRoot) => {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024
    });

    return stdout.trim() || "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
};

const resolvePublicDemoInputCommit = async (repoRoot) => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "-1", "--format=%H", "--", ...publicDemoInputPaths],
      {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024
      }
    );

    return stdout.trim() || "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
};

const resolveDeploymentCommit = async (repoRoot) => process.env.GITHUB_SHA ?? await gitCommit(repoRoot);

const writeArtifactManifest = async (targetArtifactDir, generatedAt) => {
  await writeFile(
    resolve(targetArtifactDir, "artifact-manifest.json"),
    `${JSON.stringify(
      {
        source: "splunkready-artifact-file-manifest",
        generatedAt,
        files: await listRelativeFiles(targetArtifactDir)
      },
      null,
      2
    )}\n`,
    "utf8"
  );
};

export const exportPublicDemo = async ({
  root = process.cwd(),
  outDir = "artifacts/public-demo",
  generatedAt = new Date().toISOString(),
  generateJudgeProof = runCredentialFreeJudgeProof,
  sourceCommit,
  deploymentCommit
} = {}) => {
  const repoRoot = resolve(root);
  const targetRoot = resolve(repoRoot, outDir);
  const distUi = resolve(repoRoot, "dist-ui");
  const evidenceRoot = resolve(repoRoot, "submission-evidence");

  await rm(targetRoot, { recursive: true, force: true });
  await copyTree(distUi, targetRoot);

  for (const artifactDir of requiredArtifactDirs) {
    const targetArtifactDir = resolve(targetRoot, "artifacts", artifactDir);

    await copyTree(resolve(evidenceRoot, artifactDir), targetArtifactDir);
    await writeArtifactManifest(targetArtifactDir, generatedAt);
  }

  for (const artifactDir of generatedArtifactDirs) {
    const targetArtifactDir = resolve(targetRoot, "artifacts", artifactDir);

    await generateJudgeProof({ repoRoot, targetArtifactDir });
    await writeArtifactManifest(targetArtifactDir, generatedAt);
  }

  const interactiveTargetDir = resolve(targetRoot, "artifacts", interactiveArtifactDir);
  await copyTree(resolve(targetRoot, "artifacts", interactiveSourceDir), interactiveTargetDir);
  await writeArtifactManifest(interactiveTargetDir, generatedAt);

  await copyTree(resolve(evidenceRoot, "screenshots"), resolve(targetRoot, "screenshots"));

  const artifactBases = [...requiredArtifactDirs, ...generatedArtifactDirs, interactiveArtifactDir].map(
    (artifactDir) => `artifacts/${artifactDir}`
  );
  const resolvedSourceCommit = sourceCommit ?? await resolvePublicDemoInputCommit(repoRoot);
  const resolvedDeploymentCommit = deploymentCommit ?? await resolveDeploymentCommit(repoRoot);
  const manifest = {
    source: "splunkready-public-demo-export",
    generatedAt,
    sourceCommit: resolvedSourceCommit,
    sourceCommitShort: resolvedSourceCommit === "UNKNOWN" ? "UNKNOWN" : resolvedSourceCommit.slice(0, 7),
    deploymentCommit: resolvedDeploymentCommit,
    deploymentCommitShort:
      resolvedDeploymentCommit === "UNKNOWN" ? "UNKNOWN" : resolvedDeploymentCommit.slice(0, 7),
    mutation: false,
    defaultUrl: "?artifacts=artifacts%2Fmcp-proof#mcp-proof",
    interactiveUrl: "?demo=interactive",
    artifactBases,
    screenshots: "screenshots",
    notes:
      "Static export for hosting the Vite workbench with tracked credential-free evidence. The judge-proof bundle is generated with LLM mode disabled for hosting. Live Splunk credentials and .env files are not copied."
  };

  await writeFile(resolve(targetRoot, "public-demo-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    outDir: targetRoot,
    manifest,
    copiedArtifactBases: manifest.artifactBases
  };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { outDir } = parseArgs(process.argv.slice(2));
  const result = await exportPublicDemo({ outDir });

  console.log(JSON.stringify(result, null, 2));
}
