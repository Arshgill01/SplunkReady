import { copyFile, lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const requiredArtifactDirs = ["mcp-proof", "suite-proof", "public-proof-export"];

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

const parseArgs = (argv) => {
  const outIndex = argv.indexOf("--out");

  return {
    outDir: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/public-demo"
  };
};

export const exportPublicDemo = async ({
  root = process.cwd(),
  outDir = "artifacts/public-demo",
  generatedAt = new Date().toISOString()
} = {}) => {
  const repoRoot = resolve(root);
  const targetRoot = resolve(repoRoot, outDir);
  const distUi = resolve(repoRoot, "dist-ui");
  const evidenceRoot = resolve(repoRoot, "submission-evidence");

  await rm(targetRoot, { recursive: true, force: true });
  await copyTree(distUi, targetRoot);

  for (const artifactDir of requiredArtifactDirs) {
    await copyTree(resolve(evidenceRoot, artifactDir), resolve(targetRoot, "artifacts", artifactDir));
  }

  await copyTree(resolve(evidenceRoot, "screenshots"), resolve(targetRoot, "screenshots"));

  const manifest = {
    source: "splunkready-public-demo-export",
    generatedAt,
    mutation: false,
    defaultUrl: "?artifacts=artifacts%2Fmcp-proof#mcp-proof",
    artifactBases: requiredArtifactDirs.map((artifactDir) => `artifacts/${artifactDir}`),
    screenshots: "screenshots",
    notes:
      "Static export for hosting the Vite workbench with tracked credential-free evidence. Live Splunk credentials and .env files are not copied."
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
