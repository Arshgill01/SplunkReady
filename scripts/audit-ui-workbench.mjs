#!/usr/bin/env node

import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright";

import { createWorkbenchConfig } from "../dist/src/workbench/config.js";
import { startWorkbenchServer } from "../dist/src/workbench/server.js";

const repoRoot = process.cwd();

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

const options = {
  out: argValue("--out", "submission-evidence/ui-workbench-audit/ui-workbench-audit.json")
};

const routes = [
  { id: "default", path: "/" },
  { id: "fixture-receipt", path: "/?artifacts=artifacts/fixture-demo#receipt" },
  { id: "mcp-proof", path: "/?artifacts=artifacts/mcp-proof#mcp-proof" },
  { id: "live-connect", path: "/#live-connect" }
];

const viewports = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "mobile", width: 390, height: 900 }
];

const getOpenPort = async () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close((error) => {
        if (error) reject(error);
        else if (port) resolvePort(port);
        else reject(new Error("Unable to allocate a local workbench audit port."));
      });
    });
  });

const writeJson = async (path, value) => {
  const absolutePath = resolve(repoRoot, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const auditPage = async (page) =>
  page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const rgb = (value) => {
      const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)$/.exec(value);
      if (!match) return null;
      const alpha = match[4] === undefined ? 1 : Number(match[4]);
      return alpha === 0 ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
    };

    const backgroundFor = (element) => {
      let current = element;
      while (current) {
        const color = rgb(window.getComputedStyle(current).backgroundColor);
        if (color) return color;
        current = current.parentElement;
      }
      return [255, 255, 255];
    };

    const luminance = ([red, green, blue]) => {
      const channel = [red, green, blue].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
    };

    const contrast = (foreground, background) => {
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    };

    const selectorFor = (element) => {
      const id = element.id ? `#${element.id}` : "";
      const className = [...element.classList].slice(0, 3).map((name) => `.${name}`).join("");
      return `${element.tagName.toLowerCase()}${id}${className}`;
    };

    const horizontalOverflow =
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ||
      document.body.scrollWidth > document.body.clientWidth + 1;

    const internalOverflow = [...document.querySelectorAll("body *")]
      .filter((element) => visible(element))
      .flatMap((element) => {
        const style = window.getComputedStyle(element);
        const scrollsByDesign = ["auto", "scroll"].includes(style.overflowX);
        const tag = element.tagName.toLowerCase();
        const ignored = ["html", "body", "svg", "path", "pre", "code"].includes(tag);
        const overflow = element.scrollWidth > element.clientWidth + 2;
        return overflow && !scrollsByDesign && !ignored
          ? [{ selector: selectorFor(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }]
          : [];
      });

    const touchTargets = [
      ...document.querySelectorAll("a[href], button, select, textarea, input:not([type='hidden'])")
    ]
      .filter((element) => visible(element) && !element.disabled)
      .flatMap((element) => {
        const type = element.getAttribute("type");
        if (type === "checkbox" || type === "radio") return [];
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44
          ? [{ selector: selectorFor(element), width: Math.round(rect.width), height: Math.round(rect.height) }]
          : [];
      });

    const contrastIssues = [...document.querySelectorAll("[class*='status'], [class*='verdict'], [class*='pill']")]
      .filter((element) => visible(element) && (element.textContent ?? "").trim().length > 0)
      .flatMap((element) => {
        const foreground = rgb(window.getComputedStyle(element).color);
        if (!foreground) return [];
        const ratio = contrast(foreground, backgroundFor(element));
        return ratio < 4.5
          ? [{ selector: selectorFor(element), text: (element.textContent ?? "").trim(), ratio: Number(ratio.toFixed(2)) }]
          : [];
      });

    return {
      horizontalOverflow,
      internalOverflow,
      touchTargets,
      contrastIssues
    };
  });

const run = async () => {
  const port = await getOpenPort();
  const config = createWorkbenchConfig({ ...process.env, SPLUNKREADY_WORKBENCH_PORT: String(port) }, repoRoot);
  const server = await startWorkbenchServer(config, { devUi: true });
  const browser = await chromium.launch();
  const checks = [];

  try {
    for (const viewport of viewports) {
      for (const route of routes) {
        const page = await browser.newPage({ viewport });
        const consoleErrors = [];
        const pageErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        const url = new URL(route.path, server.url).toString();
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.locator("#app .app-frame, #app .error").waitFor({ state: "visible", timeout: 10_000 });
        const audit = await auditPage(page);
        await page.close();

        const failures = [
          ...consoleErrors.map((message) => ({ type: "console-error", message })),
          ...pageErrors.map((message) => ({ type: "page-error", message })),
          ...(audit.horizontalOverflow ? [{ type: "horizontal-overflow" }] : []),
          ...audit.internalOverflow.map((issue) => ({ type: "internal-overflow", ...issue })),
          ...audit.touchTargets.map((issue) => ({ type: "touch-target", ...issue })),
          ...audit.contrastIssues.map((issue) => ({ type: "contrast", ...issue }))
        ];

        checks.push({
          route: route.id,
          viewport: viewport.id,
          path: route.path,
          status: failures.length === 0 ? "PASS" : "FAIL",
          failures
        });
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const failures = checks.flatMap((check) => check.failures.map((failure) => ({ route: check.route, viewport: check.viewport, ...failure })));
  const summary = {
    source: "splunkready-ui-workbench-audit",
    status: failures.length === 0 ? "PASS" : "FAIL",
    mutation: false,
    routes: routes.map((route) => route.id),
    viewports: viewports.map((viewport) => viewport.id),
    checks,
    failures
  };

  await writeJson(options.out, summary);
  console.log(JSON.stringify(summary, null, 2));

  if (summary.status !== "PASS") {
    process.exitCode = 1;
  }
};

await run();
