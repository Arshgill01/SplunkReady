#!/usr/bin/env node

import { build } from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chmod, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

const optionValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const hasFlag = (name) => args.includes(name);

export const currentTarget = () => {
  const platform =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "win32"
        ? "windows"
        : process.platform === "linux"
          ? "linux"
          : process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
  return `${platform}-${arch}`;
};

export const executableNameForTarget = (target) => (target.startsWith("windows-") ? "splunkready.exe" : "splunkready");

export const releaseAssetNames = (target) => {
  const archiveName = `splunkready-${target}.tar.gz`;
  return {
    archiveName,
    checksumName: `${archiveName}.sha256`,
    manifestName: `standalone-release-${target}.json`,
    executableName: executableNameForTarget(target)
  };
};

const sha256File = (path) => {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
};

const run = (command, commandArgs, options = {}) =>
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
    ...options
  });

const codesignAvailable = () => {
  if (process.platform !== "darwin") {
    return false;
  }
  const result = spawnSync("command", ["-v", "codesign"], { shell: true, stdio: "ignore" });
  return result.status === 0;
};

const postjectArgs = (binaryPath, blobPath) => {
  const baseArgs = [
    binaryPath,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
  ];
  return process.platform === "darwin" ? [...baseArgs, "--macho-segment-name", "NODE_SEA"] : baseArgs;
};

export const postjectInvocation = (platform = process.platform) => {
  if (platform === "win32") {
    return {
      command: process.execPath,
      leadingArgs: [resolve(repoRoot, "node_modules/postject/dist/cli.js")]
    };
  }

  return {
    command: resolve(repoRoot, "node_modules/.bin/postject"),
    leadingArgs: []
  };
};

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const runSmoke = async ({ archivePath, executableName, target }) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "splunkready-standalone-smoke-"));
  run("tar", ["-xzf", archivePath, "-C", tempRoot], { cwd: repoRoot });
  const executablePath = join(tempRoot, executableName);
  const outDir = join(tempRoot, "judge-proof");
  const result = spawnSync(executablePath, ["judge-proof", "--out", outDir, "--json"], {
    cwd: tempRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      TEMP: process.env.TEMP ?? tmpdir(),
      TMP: process.env.TMP ?? tmpdir(),
      TMPDIR: process.env.TMPDIR ?? tmpdir()
    }
  });

  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = {};
  }

  const summaryPath = join(outDir, "judge-proof-summary.json");
  const summary = existsSync(summaryPath) ? JSON.parse(await readFile(summaryPath, "utf8")) : {};

  return {
    status: result.status === 0 && parsed.status === "PASS" ? "PASS" : "FAIL",
    target,
    tempRoot,
    command: `${basename(executablePath)} judge-proof --out ./judge-proof --json`,
    exitCode: result.status,
    stdoutStatus: parsed.status ?? "UNKNOWN",
    stdoutCommand: parsed.command ?? "UNKNOWN",
    summaryStatus: summary.status ?? "UNKNOWN",
    mutation: summary.mutation ?? false,
    artifactCount: Array.isArray(parsed.artifacts) ? parsed.artifacts.length : 0,
    stderr: result.stderr.trim()
  };
};

export const buildStandaloneRelease = async ({
  outDir = "dist/release",
  target = currentTarget(),
  smoke = false,
  evidenceOut
} = {}) => {
  const actualTarget = currentTarget();
  if (target !== actualTarget) {
    throw new Error(`Target ${target} does not match current runner ${actualTarget}; build each standalone target on its own OS/arch runner.`);
  }

  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const absoluteOutDir = resolve(repoRoot, outDir);
  const names = releaseAssetNames(target);
  const workDir = join(absoluteOutDir, "work", target);
  const bundlePath = join(workDir, "splunkready.cjs");
  const seaConfigPath = join(workDir, "sea-config.json");
  const blobPath = join(workDir, "splunkready.blob");
  const packageDir = join(workDir, "package");
  const executablePath = join(packageDir, names.executableName);
  const archivePath = join(absoluteOutDir, names.archiveName);
  const checksumPath = join(absoluteOutDir, names.checksumName);
  const manifestPath = join(absoluteOutDir, names.manifestName);

  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(packageDir, { recursive: true });

  await build({
    entryPoints: [join(repoRoot, "src/cli.ts")],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    external: ["fsevents"],
    define: {
      "import.meta.url": "__SPLUNKREADY_MODULE_URL"
    },
    banner: {
      js: 'const __SPLUNKREADY_MODULE_URL = require("node:url").pathToFileURL(require("node:fs").realpathSync(process.argv[1] || process.execPath)).href;'
    },
    logLevel: "silent"
  });

  writeJson(seaConfigPath, {
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false
  });

  run(process.execPath, ["--experimental-sea-config", seaConfigPath]);
  copyFileSync(process.execPath, executablePath);

  if (process.platform === "darwin" && codesignAvailable()) {
    spawnSync("codesign", ["--remove-signature", executablePath], { stdio: "ignore" });
  }

  const postject = postjectInvocation();
  run(postject.command, [...postject.leadingArgs, ...postjectArgs(executablePath, blobPath)]);

  if (process.platform === "darwin" && codesignAvailable()) {
    run("codesign", ["--sign", "-", executablePath]);
  }

  await chmod(executablePath, 0o755);
  writeFileSync(
    join(packageDir, "README.txt"),
    [
      `SplunkReady ${packageJson.version} standalone release artifact`,
      "",
      "Run:",
      `  ./${names.executableName} judge-proof --out ./judge-proof --json`,
      "",
      "This archive embeds the Node.js runtime through Node SEA packaging and does not require npm install."
    ].join("\n"),
    "utf8"
  );
  cpSync(join(repoRoot, "fixtures"), join(packageDir, "fixtures"), { recursive: true });
  cpSync(join(repoRoot, "policies"), join(packageDir, "policies"), { recursive: true });

  rmSync(archivePath, { force: true });
  run("tar", ["-czf", archivePath, "-C", packageDir, names.executableName, "README.txt", "fixtures", "policies"]);
  const archiveSha256 = sha256File(archivePath);
  writeFileSync(checksumPath, `${archiveSha256}  ${names.archiveName}\n`, "utf8");

  const smokeResult = smoke ? await runSmoke({ archivePath, executableName: names.executableName, target }) : null;
  const status = smoke && smokeResult?.status !== "PASS" ? "FAIL" : "PASS";
  const manifest = {
    source: "splunkready-standalone-release",
    status,
    package: {
      name: packageJson.name,
      version: packageJson.version
    },
    target,
    currentRunnerTarget: actualTarget,
    nodeRuntime: process.version,
    nodeSea: {
      mode: "experimental-sea-config",
      bundleFormat: "commonjs",
      useSnapshot: false,
      useCodeCache: false,
      postject: true
    },
    assets: {
      archive: names.archiveName,
      checksum: names.checksumName,
      executable: names.executableName,
      bundledDataDirs: ["fixtures", "policies"],
      archiveSha256,
      archiveBytes: readFileSync(archivePath).byteLength,
      executableBytes: readFileSync(executablePath).byteLength
    },
    smoke: smokeResult ?? {
      status: "NOT_RUN"
    },
    releaseClaimBoundary: {
      currentOsOnly: true,
      allPlatformReleaseRequiresTagWorkflow: true,
      noNodeClaimRequiresPerOsSmoke: true
    },
    mutation: false
  };

  writeJson(manifestPath, manifest);
  if (evidenceOut) {
    writeJson(resolve(repoRoot, evidenceOut), manifest);
  }

  if (status !== "PASS") {
    throw new Error(`Standalone release build failed for ${target}.`);
  }

  return manifest;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildStandaloneRelease({
    outDir: optionValue("--out-dir", "dist/release"),
    target: optionValue("--target", currentTarget()),
    smoke: hasFlag("--smoke"),
    evidenceOut: optionValue("--evidence-out", undefined)
  })
    .then((manifest) => {
      console.log(JSON.stringify(manifest, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
