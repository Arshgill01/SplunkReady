import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { WorkbenchArtifactStore } from "./artifacts.js";
import { createWorkbenchConfig, type WorkbenchConfig } from "./config.js";
import { WorkbenchJobRunner } from "./jobs.js";
import { createWorkbenchApiHandler } from "./routes.js";

interface ViteDevServerLike {
  middlewares: (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void;
  close(): Promise<void>;
}

export interface StartedWorkbenchServer {
  url: string;
  close(): Promise<void>;
}

export interface WorkbenchServerOptions {
  devUi?: boolean;
  staticUiRoot?: string;
}

const startViteMiddleware = async (): Promise<ViteDevServerLike> => {
  const vite = (await import("vite")) as typeof import("vite");

  return vite.createServer({
    configFile: "vite.config.ts",
    server: { middlewareMode: true },
    appType: "spa"
  }) as Promise<ViteDevServerLike>;
};

const staticContentTypeFor = (path: string): string => {
  if (extname(path) === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extname(path) === ".js") {
    return "text/javascript; charset=utf-8";
  }

  if (extname(path) === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extname(path) === ".woff2") {
    return "font/woff2";
  }

  if (extname(path) === ".svg") {
    return "image/svg+xml";
  }

  if (extname(path) === ".png") {
    return "image/png";
  }

  return "application/octet-stream";
};

const serveStaticUi = async (root: string, request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const relativePath = decodeURIComponent(url.pathname)
    .replace(/^\/+/, "")
    .replaceAll("\\", "/");
  const requestedPath = relativePath.length === 0 ? "index.html" : relativePath;
  const candidate = resolve(root, requestedPath);
  const target = candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : resolve(root, "index.html");
  const fallback = resolve(root, "index.html");

  try {
    const file = await stat(target);

    if (file.isFile()) {
      response.statusCode = 200;
      response.setHeader("content-type", staticContentTypeFor(target));
      createReadStream(target).pipe(response);
      return;
    }
  } catch {
    // Fall through to the SPA fallback.
  }

  if (extname(requestedPath)) {
    response.statusCode = 404;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("Not found");
    return;
  }

  try {
    const file = await stat(fallback);

    if (!file.isFile()) {
      throw new Error("Missing index.html.");
    }

    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    createReadStream(fallback).pipe(response);
  } catch {
    response.statusCode = 404;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("Built UI not found. Run `npm run ui:build` before `npm run workbench`.");
  }
};

const closeHttpServer = async (server: ReturnType<typeof createServer>): Promise<void> => {
  let forceClose: NodeJS.Timeout | undefined;

  await new Promise<void>((resolve, reject) => {
    forceClose = setTimeout(() => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    }, 1_000);
    forceClose.unref();

    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections?.();
  });

  if (forceClose) {
    clearTimeout(forceClose);
  }
};

export const startWorkbenchServer = async (
  config: WorkbenchConfig = createWorkbenchConfig(),
  options: WorkbenchServerOptions = {}
): Promise<StartedWorkbenchServer> => {
  const artifactStore = new WorkbenchArtifactStore(config.artifactRoot);
  const jobRunner = new WorkbenchJobRunner({ config, artifactStore });
  const apiHandler = createWorkbenchApiHandler({ config, artifactStore, jobRunner });
  const viteServer = options.devUi ? await startViteMiddleware() : undefined;
  const staticUiRoot = resolve(options.staticUiRoot ?? "dist-ui");
  const server = createServer((request, response) => {
    void (async () => {
      const handled = await apiHandler(request, response);

      if (handled) {
        return;
      }

      if (viteServer) {
        viteServer.middlewares(request, response, (error?: unknown) => {
          if (error) {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
            return;
          }

          response.statusCode = 404;
          response.end("Not found");
        });
        return;
      }

      await serveStaticUi(staticUiRoot, request, response);
    })().catch((error: unknown) => {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : String(error));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo | null;
  const port = address?.port ?? config.port;

  return {
    url: `http://${config.host}:${port}`,
    async close() {
      await closeHttpServer(server);
      await viteServer?.close();
    }
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const devUi = process.argv.includes("--dev-ui");
  const config = createWorkbenchConfig();

  try {
    const server = await startWorkbenchServer(config, { devUi });

    console.log(`SplunkReady Workbench listening on ${server.url}`);
    console.log(`Artifact root: ${config.artifactRoot}`);
    console.log("Fixture certification: available");
    console.log(`Live mode: ${config.liveAvailable ? "available" : `disabled (${config.liveMissing.join(", ")})`}`);
    console.log(`SAIA assistance: ${config.saiaAvailable ? "available" : "disabled"}`);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    const message =
      code === "EADDRINUSE"
        ? `Port ${config.port} is already in use on ${config.host}. Set SPLUNKREADY_WORKBENCH_PORT to another local port.`
        : error instanceof Error
          ? error.message
          : String(error);

    console.error(`Unable to start SplunkReady Workbench: ${message}`);
    process.exitCode = 1;
  }
}
