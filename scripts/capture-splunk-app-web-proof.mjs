#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = "splunkready-installed-splunk-web-app-render-proof";
const defaultOutDir = "submission-evidence/splunk-app-web-proof";
const defaultScreenshot = "submission-evidence/screenshots/splunk-app-web-proof.png";
const appId = "SplunkReady";

const usage = `Usage:
  SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF=1 npx --yes --package playwright node scripts/capture-splunk-app-web-proof.mjs --env-file ./.splunkready-live.env --confirm-browser true [options]

Options:
  --env-file <path>          Operator-owned env file. Default: ./.splunkready-live.env
  --out <dir>                Evidence output directory. Default: ${defaultOutDir}
  --screenshot <path>        Screenshot path. Default: ${defaultScreenshot}
  --confirm-browser <true>   Required explicit browser-proof confirmation.
  --headed                   Show the browser while capturing.
  --json                     Print the public-safe proof JSON.
  --help                     Show this help text.

This command logs into operator-owned Splunk Web and captures a screenshot of
the installed SplunkReady app. It does not write to Splunk and refuses to run
unless SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF=1 and --confirm-browser true are set.`;

const webUrlEnvNames = ["SPLUNKREADY_SPLUNK_WEB_URL", "SPLUNK_WEB_URL"];
const mcpUrlEnvNames = ["SPLUNKREADY_SPLUNK_MCP_URL", "SPLUNK_MCP_URL"];
const usernameEnvNames = ["SPLUNKREADY_SPLUNK_USERNAME", "SPLUNK_USERNAME"];
const passwordEnvNames = ["SPLUNKREADY_SPLUNK_PASSWORD", "SPLUNK_PASSWORD"];
const staticWorkbenchPath = `/en-US/static/app/${appId}/splunkready/index.html?artifacts=artifacts%2Fpublic-proof-export#receipt`;

export const parseArgs = (argv) => {
  const options = {
    envFile: "./.splunkready-live.env",
    outDir: defaultOutDir,
    screenshotPath: defaultScreenshot,
    confirmBrowser: false,
    headed: false,
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      index += 1;
      return value;
    };

    if (arg === "--help") options.help = true;
    else if (arg === "--env-file") options.envFile = next();
    else if (arg === "--out") options.outDir = next();
    else if (arg === "--screenshot") options.screenshotPath = next();
    else if (arg === "--confirm-browser") options.confirmBrowser = next() === "true";
    else if (arg === "--headed") options.headed = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
};

const unquote = (value) => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const parseEnvFileContent = (content) => {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    parsed[match[1]] = unquote(match[2]);
  }

  return parsed;
};

const firstValue = (env, names) => names.map((name) => env[name]?.trim()).find((value) => Boolean(value));

const hostForUrl = (parsedUrl) => (parsedUrl.hostname.includes(":") ? `[${parsedUrl.hostname}]` : parsedUrl.hostname);

export const deriveSplunkWebUrl = (env) => {
  const explicit = firstValue(env, webUrlEnvNames);
  if (explicit) {
    return { url: explicit.replace(/\/+$/, ""), source: "explicit-web-url" };
  }

  const mcpUrl = firstValue(env, mcpUrlEnvNames);
  if (!mcpUrl) {
    return { url: undefined, source: "missing" };
  }

  try {
    const parsed = new URL(mcpUrl);
    return { url: `http://${hostForUrl(parsed)}:8000`, source: "derived-from-mcp-url" };
  } catch {
    return { url: undefined, source: "invalid-mcp-url" };
  }
};

const publicSafePath = (path) => {
  const resolved = resolve(path);
  const relativePath = relative(process.cwd(), resolved);
  return relativePath.startsWith("..") ? path.split(/[\\/]/).pop() : relativePath;
};

const appRoute = (path) => `/en-US/app/${appId}/${path}`;

const writeProof = async (outDir, proof) => {
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, "splunk-app-web-proof.json");
  const markdownPath = join(outDir, "splunk-app-web-proof.md");
  await writeFile(jsonPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  await writeFile(
    markdownPath,
    [
      "# Splunk App Web Proof",
      "",
      `Status: ${proof.status}`,
      `Source: ${proof.source}`,
      `App route rendered: ${proof.browser?.appRoute?.rendered ?? false}`,
      `Workbench launcher text detected: ${proof.browser?.appRoute?.workbenchLauncherTextDetected ?? false}`,
      `Static workbench rendered: ${proof.browser?.staticWorkbenchRoute?.rendered ?? false}`,
      `Overview route rendered: ${proof.browser?.overviewRoute?.rendered ?? false}`,
      `Screenshot: ${proof.screenshot?.path ?? "none"}`,
      "",
      "No endpoint, username, password, token, cookie, or raw deployment inventory values are written by this artifact."
    ].join("\n"),
    "utf8"
  );
  return [jsonPath, markdownPath, ...(proof.screenshot?.captured && proof.screenshot?.path ? [proof.screenshot.path] : [])];
};

const baseProof = (input) => ({
  source,
  status: "SKIP",
  generatedAt: new Date().toISOString(),
  appId,
  mutation: false,
  splunkMutation: "none",
  operatorApproved: input.confirmBrowser,
  config: {
    envFileUsed: Boolean(input.envFile),
    browserConfirmation: input.confirmBrowser,
    allowEnvSet: process.env.SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF === "1",
    webUrlSource: input.webUrlSource,
    webUrlConfigured: Boolean(input.webUrl),
    usernameConfigured: Boolean(input.username),
    passwordConfigured: Boolean(input.password),
    missing: input.missing
  },
  routes: {
    app: appRoute("splunkready"),
    overview: appRoute("splunkready_overview"),
    staticWorkbench: staticWorkbenchPath
  },
  screenshot: input.screenshotPath
    ? {
        path: publicSafePath(input.screenshotPath),
        captured: false
      }
    : undefined,
  redaction: {
    endpointValueWritten: false,
    usernameValueWritten: false,
    secretValuesWritten: false,
    cookieValuesWritten: false
  }
});

const gotoRoute = async (page, webUrl, routePath) => {
  const url = new URL(routePath, webUrl);
  try {
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes("ERR_ABORTED")) {
      throw error;
    }
  }
};

const loginIfNeeded = async (page, webUrl, username, password) => {
  const loginUrl = new URL("/en-US/account/login", webUrl);
  loginUrl.searchParams.set("return_to", appRoute("splunkready"));
  try {
    await page.goto(loginUrl.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes("ERR_ABORTED")) {
      throw error;
    }
  }

  const usernameField = page.locator('input[name="username"], input#username').first();
  if ((await usernameField.count()) === 0) {
    return "already-authenticated-or-custom-login";
  }

  await usernameField.fill(username);
  await page.locator('input[name="password"], input#password').first().fill(password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 45_000 }).catch(() => undefined),
    page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign In")').first().click()
  ]);
  return "submitted-login-form";
};

const textIncludes = (text, pattern) => pattern.test(text || "");

const inspectAppRoute = async (page) => {
  await page.waitForTimeout(2000);
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const workbenchLauncherTextDetected = textIncludes(bodyText, /Open SplunkReady artifact workbench/i);

  return {
    path: appRoute("splunkready"),
    rendered: textIncludes(bodyText, /SplunkReady Agent Readiness Compiler|Readiness Receipt|Mutation: false/i),
    workbenchLauncherTextDetected
  };
};

const inspectStaticWorkbenchRoute = async (page) => {
  await page.waitForTimeout(2000);
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  return {
    path: staticWorkbenchPath,
    rendered: textIncludes(bodyText, /SplunkReady|Readiness Receipt|READY \/ 100\/100|Agent Readiness/i),
    containsProofSignal: textIncludes(bodyText, /READY \/ 100\/100|Readiness Receipt|fixture \/ contract-acme-soc-dev/i),
    artifactLoadFailed: textIncludes(bodyText, /Artifact load failed|Artifact bundle incomplete/i)
  };
};

const inspectOverviewRoute = async (page) => {
  await page.waitForTimeout(1500);
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  return {
    path: appRoute("splunkready_overview"),
    rendered: textIncludes(bodyText, /SplunkReady Receipt Overview|Bundled Proof Evidence|Operator-Owned Receipt Store/i),
    containsBundledEvidencePanel: textIncludes(bodyText, /Bundled Proof Evidence/i),
    containsReceiptStorePanel: textIncludes(bodyText, /Operator-Owned Receipt Store/i)
  };
};

export const runSplunkAppWebProof = async (options, env = process.env) => {
  const envFileContent = options.envFile ? await readFile(options.envFile, "utf8").catch(() => "") : "";
  const fileEnv = parseEnvFileContent(envFileContent);
  const mergedEnv = { ...env, ...fileEnv };
  const web = deriveSplunkWebUrl(mergedEnv);
  const username = firstValue(mergedEnv, usernameEnvNames);
  const password = firstValue(mergedEnv, passwordEnvNames);
  const missing = [];

  if (env.SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF !== "1") missing.push("SPLUNKREADY_ALLOW_SPLUNK_WEB_PROOF=1");
  if (!options.confirmBrowser) missing.push("--confirm-browser true");
  if (!web.url) missing.push(`${webUrlEnvNames[0]} or ${mcpUrlEnvNames[0]}`);
  if (!username) missing.push(usernameEnvNames[0]);
  if (!password) missing.push(passwordEnvNames[0]);

  const base = baseProof({
    ...options,
    webUrl: web.url,
    webUrlSource: web.source,
    username,
    password,
    missing
  });

  if (missing.length > 0) {
    const proof = {
      ...base,
      status: "SKIP",
      messages: ["Browser proof skipped before opening Splunk Web because required operator inputs were missing."]
    };
    const artifacts = await writeProof(options.outDir, proof);
    return { status: proof.status, artifacts, proof };
  }

  const redactError = (error) =>
    String(error instanceof Error ? error.message : error)
      .split(/\r?\n/)[0]
      .replace(/https?:\/\/[^\s"'<>]+/g, "[REDACTED_URL]");

  const { chromium } = await import("playwright");
  await mkdir(dirname(options.screenshotPath), { recursive: true });
  await rm(options.screenshotPath, { force: true });
  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 }
  });
  const page = await context.newPage();

  try {
    const loginStatus = await loginIfNeeded(page, web.url, username, password);
    await gotoRoute(page, web.url, appRoute("splunkready"));
    const appRouteResult = await inspectAppRoute(page);
    await gotoRoute(page, web.url, staticWorkbenchPath);
    const staticWorkbenchRouteResult = await inspectStaticWorkbenchRoute(page);
    const workbenchScreenshotSafe = staticWorkbenchRouteResult.rendered && !staticWorkbenchRouteResult.artifactLoadFailed;
    if (workbenchScreenshotSafe) await page.screenshot({ path: options.screenshotPath, fullPage: true });
    await gotoRoute(page, web.url, appRoute("splunkready_overview"));
    const overviewRouteResult = await inspectOverviewRoute(page);
    const status =
      appRouteResult.rendered &&
      appRouteResult.workbenchLauncherTextDetected &&
      staticWorkbenchRouteResult.rendered &&
      !staticWorkbenchRouteResult.artifactLoadFailed &&
      overviewRouteResult.rendered
        ? "PASS"
        : "BLOCKED";
    const proof = {
      ...base,
      status,
      browser: {
        loginStatus,
        appRoute: appRouteResult,
        staticWorkbenchRoute: staticWorkbenchRouteResult,
        overviewRoute: overviewRouteResult
      },
      screenshot: {
        path: publicSafePath(options.screenshotPath),
        captured: workbenchScreenshotSafe
      },
      messages: [
        status === "PASS"
          ? "PASS splunk-app-web-proof: installed SplunkReady app routes rendered in Splunk Web."
          : "BLOCKED splunk-app-web-proof: one or more installed SplunkReady routes did not render expected public-safe signals."
      ]
    };
    const artifacts = await writeProof(options.outDir, proof);
    return { status: proof.status, artifacts, proof };
  } catch (error) {
    const proof = {
      ...base,
      status: "BLOCKED",
      browser: {
        error: redactError(error)
      },
      messages: [
        "BLOCKED splunk-app-web-proof: browser proof could not render the installed SplunkReady route. Public artifact redacts endpoint and credential values."
      ]
    };
    const artifacts = await writeProof(options.outDir, proof);
    return { status: proof.status, artifacts, proof };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage);
      process.exit(0);
    }
    const result = await runSplunkAppWebProof(options);
    if (options.json) {
      console.log(JSON.stringify({ status: result.status, artifacts: result.artifacts }, null, 2));
    } else {
      console.log(result.proof.messages.join("\n"));
    }
    process.exit(result.status === "PASS" || result.status === "SKIP" ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
