import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
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

const startViteMiddleware = async (): Promise<ViteDevServerLike> => {
  const vite = (await import("vite")) as typeof import("vite");

  return vite.createServer({
    configFile: "vite.config.ts",
    server: { middlewareMode: true },
    appType: "spa"
  }) as Promise<ViteDevServerLike>;
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
  options: { devUi?: boolean } = {}
): Promise<StartedWorkbenchServer> => {
  const artifactStore = new WorkbenchArtifactStore(config.artifactRoot);
  const jobRunner = new WorkbenchJobRunner({ config, artifactStore });
  const apiHandler = createWorkbenchApiHandler({ config, artifactStore, jobRunner });
  const viteServer = options.devUi ? await startViteMiddleware() : undefined;
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

      response.statusCode = 404;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(`${JSON.stringify({ error: { code: "WORKBENCH_ROUTE_NOT_FOUND", message: "Route was not found." } })}\n`);
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
  const server = await startWorkbenchServer(createWorkbenchConfig(), { devUi });

  console.log(`SplunkReady Workbench listening on ${server.url}`);
}
