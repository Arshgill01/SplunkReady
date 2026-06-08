#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const requireCurrent = process.argv.includes("--require-current");
const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
const tempRoot = mkdtempSync(join(tmpdir(), "splunkready-public-package-currentness-"));
const packageInputPaths = [
  "package.json",
  "package-lock.json",
  "README.md",
  "action.yml",
  "src",
  "examples",
  "fixtures",
  "policies",
  "scripts/run-readiness-score-calibration.mjs"
];

const run = (command, args, options = {}) => {
  try {
    return {
      ok: true,
      stdout: execFileSync(command, args, {
        cwd: options.cwd ?? root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: options.timeoutMs ?? 60_000,
        env: {
          ...process.env,
          NO_COLOR: "1",
          ...options.env
        }
      })
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "",
      stderr: error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "",
      message: error instanceof Error ? error.message : String(error)
    };
  }
};

const parseJson = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeError = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 500);

const readPublishedMcpProbe = (packageSpec) =>
  new Promise((resolve) => {
    const child = spawn("npx", ["-y", packageSpec, "mcp"], {
      cwd: tempRoot,
      env: {
        ...process.env,
        NO_COLOR: "1"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let initialized = false;
    let serverInfo = null;
    let toolNames = [];
    const requiredTools = [
      "splunkready_certify_mcp_transcript_content",
      "splunkready_check_hosted_model_access",
      "splunkready_review_mcp_composition"
    ];

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        status: "BLOCKED",
        initialized: false,
        toolNames,
        requiredTools,
        requiredToolsPresent: false,
        error: safeError(`published mcp did not complete initialize/tools-list probe before timeout. stderr=${stderr}`)
      });
    }, 15_000);

    const inspectStdout = () => {
      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const parsed = parseJson(line, null);
        const result = parsed?.result;

        if (
          parsed?.jsonrpc === "2.0" &&
          parsed?.id === "initialize" &&
          result?.protocolVersion === "2025-06-18" &&
          result?.serverInfo?.name === "splunkready"
        ) {
          initialized = true;
          serverInfo = result.serverInfo;
        }

        if (parsed?.jsonrpc === "2.0" && parsed?.id === "tools-list" && Array.isArray(result?.tools)) {
          toolNames = result.tools.map((tool) => tool?.name).filter((name) => typeof name === "string");
        }
      }

      const requiredToolsPresent = requiredTools.every((tool) => toolNames.includes(tool));

      if (initialized && requiredToolsPresent) {
        finish({
          status: "PASS",
          initialized,
          serverInfo,
          toolNames,
          requiredTools,
          requiredToolsPresent,
          error: null
        });
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      inspectStdout();
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish({ status: "BLOCKED", initialized: false, error: safeError(error.message) });
    });

    child.on("exit", (code, signal) => {
      if (!settled) {
        const requiredToolsPresent = requiredTools.every((tool) => toolNames.includes(tool));
        finish({
          status: "BLOCKED",
          initialized,
          serverInfo,
          toolNames,
          requiredTools,
          requiredToolsPresent,
          error: safeError(
            `published mcp exited before complete probe: code=${code} signal=${signal} initialized=${initialized} requiredToolsPresent=${requiredToolsPresent} stderr=${stderr}`
          )
        });
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "initialize",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "public-package-currentness-audit",
            version: "1.0.0"
          }
        }
      })}\n`
    );
    child.stdin.end(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "tools-list",
        method: "tools/list",
        params: {}
      })}\n`
    );
  });

const readPublishedRecorderProbe = (packageSpec) =>
  new Promise((resolve) => {
    const outDir = join(tempRoot, "mcp-recorder");
    const child = spawn(
      "npx",
      [
        "-y",
        packageSpec,
        "mcp-recorder",
        "--server",
        "splunk=mock-splunk-mcp",
        "--server",
        "splunkready=mcp",
        "--out",
        outDir
      ],
      {
        cwd: tempRoot,
        env: {
          ...process.env,
          NO_COLOR: "1"
        },
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;
    let nextId = 1;
    const pending = new Map();
    const requiredTools = [
      "splunk__splunk_get_knowledge_objects",
      "splunk__splunk_run_saved_search",
      "splunkready_recorder_flush"
    ];

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        packageSpec,
        status: "BLOCKED",
        initialized: false,
        capabilitiesPresent: false,
        requiredTools,
        requiredToolsPresent: false,
        flushStatus: null,
        flushContentPresent: false,
        error: safeError(`published mcp-recorder probe timed out. stderr=${stderr}`)
      });
    }, 90_000);

    const rejectPending = (message) => {
      for (const waiter of pending.values()) {
        waiter.reject(new Error(message));
      }
      pending.clear();
    };

    const consumeStdout = () => {
      while (stdout.includes("\n")) {
        const index = stdout.indexOf("\n");
        const line = stdout.slice(0, index).trim();
        stdout = stdout.slice(index + 1);

        if (!line) {
          continue;
        }

        const parsed = parseJson(line, null);
        const waiter = parsed?.id ? pending.get(parsed.id) : null;

        if (waiter) {
          pending.delete(parsed.id);
          waiter.resolve(parsed);
        }
      }
    };

    const sendRequest = (method, params = {}) => {
      const id = `recorder-${nextId++}`;
      return new Promise((requestResolve, requestReject) => {
        pending.set(id, { resolve: requestResolve, reject: requestReject });
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      consumeStdout();
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      rejectPending(error.message);
      finish({
        packageSpec,
        status: "BLOCKED",
        initialized: false,
        capabilitiesPresent: false,
        requiredTools,
        requiredToolsPresent: false,
        flushStatus: null,
        flushContentPresent: false,
        error: safeError(error.message)
      });
    });

    child.on("exit", (code, signal) => {
      if (!settled) {
        const message = `published mcp-recorder exited before complete probe: code=${code} signal=${signal} stderr=${stderr}`;
        rejectPending(message);
        finish({
          packageSpec,
          status: "BLOCKED",
          initialized: false,
          capabilitiesPresent: false,
          requiredTools,
          requiredToolsPresent: false,
          flushStatus: null,
          flushContentPresent: false,
          error: safeError(message)
        });
      }
    });

    (async () => {
      try {
        const initialize = await sendRequest("initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "public-package-currentness-recorder-audit",
            version: "1.0.0"
          }
        });
        const toolsList = await sendRequest("tools/list");
        const toolNames = Array.isArray(toolsList?.result?.tools)
          ? toolsList.result.tools.map((tool) => tool?.name).filter((name) => typeof name === "string")
          : [];
        const capabilitiesPresent = Boolean(initialize?.result?.capabilities?.tools);
        const initialized = initialize?.result?.serverInfo?.name === "splunkready-mcp-recorder";
        const requiredToolsPresent = requiredTools.every((tool) => toolNames.includes(tool));

        if (!initialized || !capabilitiesPresent || !requiredToolsPresent) {
          finish({
            packageSpec,
            status: "BLOCKED",
            initialized,
            capabilitiesPresent,
            toolNames,
            requiredTools,
            requiredToolsPresent,
            flushStatus: null,
            flushContentPresent: false,
            error: safeError(
              `published mcp-recorder missing required handshake/tools: initialized=${initialized} capabilitiesPresent=${capabilitiesPresent} requiredToolsPresent=${requiredToolsPresent}`
            )
          });
          return;
        }

        await sendRequest("tools/call", {
          name: "splunk__splunk_get_knowledge_objects",
          arguments: { types: ["saved_searches"], app: "SplunkEnterpriseSecuritySuite" }
        });
        await sendRequest("tools/call", {
          name: "splunk__splunk_run_saved_search",
          arguments: {
            name: "ES - Lateral Movement Auth Chain",
            app: "SplunkEnterpriseSecuritySuite",
            tokens: { host: "win-finance-07", earliest: "-24h", latest: "now" },
            maxRows: 10
          }
        });
        const flush = await sendRequest("tools/call", {
          name: "splunkready_recorder_flush",
          arguments: {
            finalAnswer:
              "Evidence supports suspicious lateral movement from win-finance-07 through admin-login-02 to dc-01 and finance-sql-03.",
            requirePass: true
          }
        });
        const flushStatus = flush?.result?.structuredContent?.status ?? null;
        const flushContentPresent = Array.isArray(flush?.result?.content) && flush.result.content.some((item) => item?.type === "text");
        const passed = flushStatus === "PASS" && flushContentPresent;

        finish({
          packageSpec,
          status: passed ? "PASS" : "BLOCKED",
          initialized,
          capabilitiesPresent,
          toolNames,
          requiredTools,
          requiredToolsPresent,
          flushStatus,
          flushContentPresent,
          error: passed
            ? null
            : safeError(
                `published mcp-recorder flush did not return displayable PASS: flushStatus=${flushStatus} flushContentPresent=${flushContentPresent}`
              )
        });
      } catch (error) {
        finish({
          packageSpec,
          status: "BLOCKED",
          initialized: false,
          capabilitiesPresent: false,
          requiredTools,
          requiredToolsPresent: false,
          flushStatus: null,
          flushContentPresent: false,
          error: safeError(error instanceof Error ? error.message : String(error))
        });
      }
    })();
  });

const runPublishedLiveMockProof = (packageSpec) => {
  const outDir = join(tempRoot, "live-mock");
  const result = run("npx", ["-y", packageSpec, "live-proof", "--out", outDir, "--live-mock", "--json"], {
    cwd: tempRoot,
    timeoutMs: 120_000
  });
  const summary = run(
    "node",
    [
      "-e",
      "const fs=require('fs'); const p=process.argv[1]; console.log(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '{}')",
      join(outDir, "live-proof-summary.json")
    ],
    { cwd: tempRoot, timeoutMs: 5_000 }
  );
  const parsed = parseJson(result.stdout, {});
  const summaryJson = parseJson(summary.stdout, {});
  const passed =
    result.ok &&
    parsed.status === "PASS" &&
    summaryJson.status === "PASS" &&
    summaryJson.mode === "live" &&
    summaryJson.mutation === false &&
    summaryJson.failToPass === true;

  return {
    packageSpec,
    status: passed ? "PASS" : "BLOCKED",
    mutation: summaryJson.mutation ?? null,
    mode: summaryJson.mode ?? null,
    failToPass: summaryJson.failToPass ?? null,
    command: `npx -y ${packageSpec} live-proof --out ./live-mock --live-mock --json`,
    error: passed ? null : safeError(result.stderr || result.message || "published live-mock proof did not return PASS")
  };
};

const runPublishedPolicyRegistryProof = (packageSpec) => {
  const policyDir = join(tempRoot, "policy-registry");
  const evalDir = join(tempRoot, "policy-eval");
  const publish = run("npx", ["-y", packageSpec, "policy-publish", "--policy", "soc2-readiness", "--out", policyDir, "--json"], {
    cwd: tempRoot,
    timeoutMs: 60_000
  });
  const compile = publish.ok
    ? run("npx", ["-y", packageSpec, "compile", "--out", evalDir, "--json"], { cwd: tempRoot, timeoutMs: 60_000 })
    : { ok: false, stderr: "", message: "policy-publish failed" };
  const evaluate = compile.ok
    ? run("npx", ["-y", packageSpec, "evaluate", "--out", evalDir, "--policy", "pci-dss-readiness", "--json"], {
        cwd: tempRoot,
        timeoutMs: 60_000
      })
    : { ok: false, stderr: "", message: "compile failed" };
  const receipt = evaluate.ok
    ? run("npx", ["-y", packageSpec, "receipt", "--out", evalDir, "--json"], { cwd: tempRoot, timeoutMs: 60_000 })
    : { ok: false, stderr: "", message: "policy evaluate failed" };
  const manifest = run(
    "node",
    [
      "-e",
      "const fs=require('fs'); const p=process.argv[1]; console.log(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '{}')",
      join(policyDir, "soc2-readiness.policy-manifest.json")
    ],
    { cwd: tempRoot, timeoutMs: 5_000 }
  );
  const receiptJson = run(
    "node",
    [
      "-e",
      "const fs=require('fs'); const p=process.argv[1]; console.log(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '{}')",
      join(evalDir, "receipt-before-001.json")
    ],
    { cwd: tempRoot, timeoutMs: 5_000 }
  );
  const manifestParsed = parseJson(manifest.stdout, {});
  const receiptParsed = parseJson(receiptJson.stdout, {});
  const passed =
    publish.ok &&
    compile.ok &&
    evaluate.ok &&
    receipt.ok &&
    manifestParsed?.signature?.status === "SIGNED" &&
    manifestParsed?.signature?.algorithm === "ed25519" &&
    receiptParsed?.policy?.id === "pci-dss-readiness" &&
    receiptParsed?.policy?.hash;

  return {
    packageSpec,
    status: passed ? "PASS" : "BLOCKED",
    signedPolicyManifest: manifestParsed?.signature?.status === "SIGNED",
    signatureAlgorithm: manifestParsed?.signature?.algorithm ?? null,
    receiptPolicyId: receiptParsed?.policy?.id ?? null,
    receiptPolicyHash: receiptParsed?.policy?.hash ?? null,
    commands: [
      `npx -y ${packageSpec} policy-publish --policy soc2-readiness --out ./policy-registry --json`,
      `npx -y ${packageSpec} compile --out ./policy-eval --json`,
      `npx -y ${packageSpec} evaluate --out ./policy-eval --policy pci-dss-readiness --json`,
      `npx -y ${packageSpec} receipt --out ./policy-eval --json`
    ],
    error: passed
      ? null
      : safeError(
          publish.stderr ||
            publish.message ||
            compile.stderr ||
            compile.message ||
            evaluate.stderr ||
            evaluate.message ||
            receipt.stderr ||
            receipt.message ||
            "published policy registry proof did not return signed policy identity"
        )
  };
};

try {
  const versionsResult = run("npm", ["view", packageJson.name, "versions", "--json"], { timeoutMs: 30_000 });
  const latestResult = run("npm", ["view", packageJson.name, "version", "--json"], { timeoutMs: 30_000 });
  const latestGitHeadResult = run("npm", ["view", `${packageJson.name}@latest`, "gitHead", "--json"], { timeoutMs: 30_000 });
  const packageInputGitHeadResult = run("git", ["log", "-n", "1", "--format=%H", "--", ...packageInputPaths], {
    timeoutMs: 5_000
  });
  const dirtyPackageInputsResult = run("git", ["diff", "--name-only", "--", ...packageInputPaths], { timeoutMs: 5_000 });
  const failures = [];

  let versions = [];
  let latestVersion = null;
  let latestGitHead = null;
  let packageInputGitHead = null;
  let dirtyPackageInputs = [];

  if (versionsResult.ok) {
    const parsed = parseJson(versionsResult.stdout, []);
    versions = Array.isArray(parsed) ? parsed.filter((version) => typeof version === "string") : [String(parsed)];
  } else {
    failures.push(`npm versions lookup failed: ${safeError(versionsResult.stderr || versionsResult.message)}`);
  }

  if (latestResult.ok) {
    const parsed = parseJson(latestResult.stdout, null);
    latestVersion = typeof parsed === "string" ? parsed : String(parsed ?? "").replace(/^"|"$/g, "");
  } else {
    failures.push(`npm latest lookup failed: ${safeError(latestResult.stderr || latestResult.message)}`);
  }

  if (latestGitHeadResult.ok) {
    const parsed = parseJson(latestGitHeadResult.stdout, null);
    latestGitHead = typeof parsed === "string" && parsed.length > 0 ? parsed : null;
  }

  if (packageInputGitHeadResult.ok) {
    packageInputGitHead = packageInputGitHeadResult.stdout.trim() || null;
  }

  if (dirtyPackageInputsResult.ok) {
    dirtyPackageInputs = dirtyPackageInputsResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const localVersion = packageJson.version;
  const latestMatchesLocal = latestVersion === localVersion;
  const localVersionPublished = versions.includes(localVersion);
  const gitHeadMatchesLocal =
    typeof latestGitHead === "string" && typeof packageInputGitHead === "string"
      ? latestGitHead === packageInputGitHead
      : null;
  const packageSpec = latestVersion ? `${packageJson.name}@${latestVersion}` : `${packageJson.name}@latest`;

  const proofDir = join(tempRoot, "judge-proof");
  let publishedJudgeProof = {
    packageSpec,
    status: "BLOCKED",
    mutation: null,
    command: `npx -y ${packageSpec} judge-proof --out ./judge-proof --json`,
    error: null
  };
  let publishedMcp = {
    packageSpec,
    status: "BLOCKED",
    initialized: false,
    requiredToolsPresent: false,
    error: null
  };
  let publishedLiveMockProof = {
    packageSpec,
    status: "BLOCKED",
    mutation: null,
    mode: null,
    failToPass: null,
    error: null
  };
  let publishedRecorder = {
    packageSpec,
    status: "BLOCKED",
    initialized: false,
    capabilitiesPresent: false,
    requiredToolsPresent: false,
    flushStatus: null,
    flushContentPresent: false,
    error: null
  };
  let publishedPolicyRegistry = {
    packageSpec,
    status: "BLOCKED",
    signedPolicyManifest: false,
    signatureAlgorithm: null,
    receiptPolicyId: null,
    receiptPolicyHash: null,
    error: null
  };

  if (latestVersion) {
    const judgeProofResult = run("npx", ["-y", packageSpec, "judge-proof", "--out", proofDir, "--json"], {
      cwd: tempRoot,
      timeoutMs: 120_000
    });

    if (judgeProofResult.ok) {
      const parsed = parseJson(judgeProofResult.stdout, {});
      const summary = run(
        "node",
        [
          "-e",
          "const fs=require('fs'); const p=process.argv[1]; console.log(fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '{}')",
          join(proofDir, "judge-proof-summary.json")
        ],
        {
          cwd: tempRoot,
          timeoutMs: 5_000
        }
      );
      const summaryJson = parseJson(summary.stdout, {});

      publishedJudgeProof = {
        ...publishedJudgeProof,
        status: parsed.status === "PASS" && summaryJson.mutation === false ? "PASS" : "BLOCKED",
        mutation: summaryJson.mutation ?? null,
        error:
          parsed.status === "PASS" && summaryJson.mutation === false
            ? null
            : "published judge-proof did not return PASS with mutation=false"
      };
    } else {
      publishedJudgeProof = {
        ...publishedJudgeProof,
        error: safeError(judgeProofResult.stderr || judgeProofResult.message)
      };
    }

    publishedMcp = {
      packageSpec,
      ...(await readPublishedMcpProbe(packageSpec))
    };
    publishedLiveMockProof = runPublishedLiveMockProof(packageSpec);
    publishedRecorder = await readPublishedRecorderProbe(packageSpec);
    publishedPolicyRegistry = runPublishedPolicyRegistryProof(packageSpec);
  }

  const registry = {
    packageName: packageJson.name,
    versions,
    latestVersion,
    localVersion,
    localVersionPublished,
    latestMatchesLocal,
    latestGitHead,
    packageInputGitHead,
    packageInputPaths,
    dirtyPackageInputs,
    gitHeadMatchesPackageInputs: gitHeadMatchesLocal
  };
  const sourceHeadMismatch = gitHeadMatchesLocal === false;
  const packageInputsDirty = dirtyPackageInputs.length > 0;
  const publishedSmokePassed =
    publishedJudgeProof.status === "PASS" &&
    publishedMcp.status === "PASS" &&
    publishedLiveMockProof.status === "PASS" &&
    publishedRecorder.status === "PASS" &&
    publishedPolicyRegistry.status === "PASS";
  const status =
    failures.length > 0
      ? "FAIL"
      : !latestMatchesLocal || sourceHeadMismatch || packageInputsDirty
        ? "STALE"
        : !publishedSmokePassed
        ? "FAIL"
        : publishedSmokePassed
          ? "CURRENT"
          : "STALE";
  const recommendedAction =
    status === "CURRENT"
      ? "No registry action required."
      : localVersionPublished
        ? `Bump ${packageJson.name} above ${localVersion}, run npm-authenticated release preflight, publish the new version, then rerun this audit.`
        : `Publish ${packageJson.name}@${localVersion} after npm-authenticated release preflight passes, then rerun this audit.`;
  const report = {
    source: "splunkready-public-package-currentness",
    status,
    registry,
    publishedJudgeProof,
    publishedMcp,
    publishedLiveMockProof,
    publishedRecorder,
    publishedPolicyRegistry,
    recommendedAction,
    mutation: false,
    failures
  };

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "public-package-currentness.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report, null, 2));

  if (status === "FAIL" || (requireCurrent && status !== "CURRENT")) {
    process.exitCode = 1;
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
