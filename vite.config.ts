import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import { defineConfig, type Plugin } from "vite";

const artifactRoot = (): string => resolve(process.env.SPLUNKREADY_UI_ARTIFACT_DIR ?? "artifacts/fixture-demo");

const contentTypeFor = (path: string): string => {
  if (extname(path) === ".json") {
    return "application/json; charset=utf-8";
  }

  if (extname(path) === ".md") {
    return "text/markdown; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
};

const artifactServerPlugin = (): Plugin => ({
  name: "splunkready-artifact-server",
  configureServer(server) {
    server.middlewares.use("/artifacts", async (request, response, next) => {
      const root = resolve("artifacts");
      const rawUrl = request.url ?? "/";
      const relativePath = decodeURIComponent(rawUrl.split("?", 1)[0] ?? "")
        .replace(/^\/+/, "")
        .replaceAll("\\", "/");
      const target = resolve(root, relativePath);

      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        response.statusCode = 403;
        response.end("Forbidden artifact path");
        return;
      }

      try {
        const file = await stat(target);

        if (!file.isFile()) {
          response.statusCode = 204;
          response.end();
          return;
        }

        response.setHeader("content-type", contentTypeFor(target));
        createReadStream(target).pipe(response);
      } catch {
        response.statusCode = 204;
        response.end();
      }
    });

    server.middlewares.use("/__splunkready_artifacts", async (request, response, next) => {
      const root = artifactRoot();
      const rawUrl = request.url ?? "/";
      const relativePath = decodeURIComponent(rawUrl.split("?", 1)[0] ?? "")
        .replace(/^\/+/, "")
        .replaceAll("\\", "/");
      const target = resolve(root, relativePath);

      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        response.statusCode = 403;
        response.end("Forbidden artifact path");
        return;
      }

      try {
        const file = await stat(target);

        if (!file.isFile()) {
          response.statusCode = 204;
          response.end();
          return;
        }

        response.setHeader("content-type", contentTypeFor(target));
        createReadStream(target).pipe(response);
      } catch {
        response.statusCode = 204;
        response.end();
      }
    });
  }
});

export default defineConfig({
  root: "ui",
  base: "./",
  plugins: [artifactServerPlugin()],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: "../dist-ui",
    emptyOutDir: true
  }
});
