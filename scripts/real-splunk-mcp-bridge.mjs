#!/usr/bin/env node

import { appendFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname } from "node:path";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const splunkUrl = new URL(requiredEnv("SPLUNK_MANAGEMENT_URL"));
const username = requiredEnv("SPLUNK_USERNAME");
const password = requiredEnv("SPLUNK_PASSWORD");
const token = process.env.SPLUNKREADY_REAL_MCP_TOKEN ?? "splunkready-real-stress";
const port = Number(process.env.SPLUNKREADY_REAL_MCP_PORT ?? "18789");
const recordingPath = process.env.SPLUNKREADY_REAL_MCP_RECORDING;

const readOnlyTools = [
  "splunk_get_info",
  "splunk_get_user_info",
  "splunk_get_indexes",
  "splunk_get_metadata",
  "splunk_get_knowledge_objects",
  "splunk_run_query",
  "splunk_run_saved_search"
];

const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

const buildSplunkUrl = (path, params = {}) => {
  const url = new URL(path, splunkUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
};

const splunkRequest = async (path, { method = "GET", params, body } = {}) => {
  const response = await fetch(buildSplunkUrl(path, params), {
    method,
    headers: {
      authorization: authHeader,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body ? new URLSearchParams(body).toString() : undefined
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Splunk REST ${method} ${path} returned HTTP ${response.status}: ${text.slice(0, 240)}`);
  }

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
};

const entriesFrom = (payload) => (Array.isArray(payload?.entry) ? payload.entry : []);

const contentRowsFrom = (payload) =>
  entriesFrom(payload).map((entry) => ({
    name: entry.name,
    app: entry.acl?.app,
    owner: entry.acl?.owner,
    sharing: entry.acl?.sharing,
    ...entry.content
  }));

const parseExportRows = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return undefined;
      }
    })
    .filter(Boolean)
    .map((event) => event.result)
    .filter((result) => result && typeof result === "object");

const exportedSearchRows = async ({ query, earliest_time, latest_time, maxRows }) => {
  const search = query.trim().startsWith("|") ? query.trim() : `search ${query.trim()}`;
  const response = await fetch(buildSplunkUrl("/services/search/jobs/export"), {
    method: "POST",
    headers: {
      authorization: authHeader,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      search,
      output_mode: "json",
      earliest_time: earliest_time ?? "-24h",
      latest_time: latest_time ?? "now",
      count: String(maxRows ?? 20)
    }).toString()
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Splunk export search returned HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  return parseExportRows(text).slice(0, maxRows ?? 20);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dispatchSavedSearchRows = async ({ app, name, maxRows }) => {
  const dispatch = await splunkRequest(
    `/servicesNS/nobody/${encodeURIComponent(app)}/saved/searches/${encodeURIComponent(name)}/dispatch`,
    {
      method: "POST",
      body: {
        output_mode: "json"
      }
    }
  );
  const sid = dispatch.sid;
  if (!sid) {
    throw new Error(`Saved search ${app}::${name} did not return a search id.`);
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const job = await splunkRequest(`/services/search/jobs/${encodeURIComponent(sid)}`, {
      params: { output_mode: "json" }
    });
    const row = contentRowsFrom(job)[0];
    if (row?.isDone === "1" || row?.isDone === 1 || row?.dispatchState === "DONE") {
      const results = await splunkRequest(`/services/search/jobs/${encodeURIComponent(sid)}/results`, {
        params: { output_mode: "json", count: maxRows ?? 20 }
      });
      return Array.isArray(results.results) ? results.results : [];
    }
    await sleep(500);
  }

  throw new Error(`Saved search ${app}::${name} did not finish within 30 seconds.`);
};

const listKnowledgeObjects = async ({ type, app, query }) => {
  if (type !== "saved_searches") {
    return [];
  }

  const payload = await splunkRequest("/servicesNS/-/-/saved/searches", {
    params: { output_mode: "json", count: 0 }
  });
  const needle = query?.toLowerCase();
  return contentRowsFrom(payload)
    .map((row) => ({
      name: row.name,
      app: row.app,
      description: row.description,
      disabled: row.disabled,
      search: row.search,
      sharing: row.sharing
    }))
    .filter((row) => (app ? row.app === app : true))
    .filter((row) =>
      needle
        ? `${row.app} ${row.name} ${row.description ?? ""} ${row.search ?? ""}`.toLowerCase().includes(needle)
        : true
    );
};

const callTool = async (name, args = {}) => {
  if (name === "splunk_get_info") {
    const info = contentRowsFrom(
      await splunkRequest("/services/server/info", {
        params: { output_mode: "json" }
      })
    )[0];
    return {
      deploymentName: "real-docker-splunk",
      serverName: info?.serverName,
      serverVersion: info?.version,
      version: info?.version,
      readOnlyTools
    };
  }

  if (name === "splunk_get_user_info") {
    const current = contentRowsFrom(
      await splunkRequest("/services/authentication/current-context", {
        params: { output_mode: "json" }
      })
    )[0];
    return {
      username: current?.username ?? username,
      roles: Array.isArray(current?.roles) ? current.roles.join(",") : String(current?.roles ?? "admin"),
      capabilitiesCount: Array.isArray(current?.capabilities) ? String(current.capabilities.length) : undefined,
      defaultApp: "search"
    };
  }

  if (name === "splunk_get_indexes") {
    return contentRowsFrom(
      await splunkRequest("/services/data/indexes", {
        params: { output_mode: "json", count: 0 }
      })
    ).map((row) => ({
      name: row.name,
      title: row.name,
      description: row["eai:acl.app"] ? `app=${row["eai:acl.app"]}` : undefined
    }));
  }

  if (name === "splunk_get_metadata") {
    const rows = await exportedSearchRows({
      query: "| metadata type=sourcetypes index=* | table sourcetype totalCount recentTime",
      earliest_time: args.earliest_time,
      latest_time: args.latest_time,
      maxRows: args.row_limit ?? 100
    });
    return { rows, results: rows };
  }

  if (name === "splunk_get_knowledge_objects") {
    const types = Array.isArray(args.types) ? args.types : [args.type ?? "saved_searches"];
    const objects = (
      await Promise.all(types.map((type) => listKnowledgeObjects({ type, app: args.app, query: args.query })))
    ).flat();
    return { objects, rows: objects, resultCount: objects.length };
  }

  if (name === "splunk_run_query") {
    const rows = await exportedSearchRows({
      query: args.query,
      earliest_time: args.earliest_time ?? args.timeWindow?.earliest,
      latest_time: args.latest_time ?? args.timeWindow?.latest,
      maxRows: args.maxRows ?? args.max_rows ?? 20
    });
    return { rows, results: rows, resultCount: rows.length };
  }

  if (name === "splunk_run_saved_search") {
    const rows = await dispatchSavedSearchRows({
      app: args.app,
      name: args.saved_search_name ?? args.name,
      maxRows: args.maxRows ?? args.max_rows ?? 20
    });
    return { rows, results: rows, resultCount: rows.length };
  }

  throw new Error(`Unsupported real Splunk bridge tool: ${name}`);
};

const recordFrame = async (frame) => {
  if (!recordingPath) {
    return;
  }
  await mkdir(dirname(recordingPath), { recursive: true });
  await appendFile(recordingPath, `${JSON.stringify({ ...frame, recordedAt: new Date().toISOString() })}\n`);
};

const sendJson = (response, status, payload) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

const server = createServer(async (request, response) => {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "POST only" });
    return;
  }

  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", async () => {
    let payload;
    try {
      payload = JSON.parse(body);
      const toolName = payload?.params?.name;
      const args = payload?.params?.arguments ?? {};
      await recordFrame({ direction: "request", id: payload.id, method: payload.method, toolName, args });
      const output = await callTool(toolName, args);
      const result = {
        jsonrpc: "2.0",
        id: payload.id,
        result: {
          structuredContent: output,
          content: [{ type: "text", text: JSON.stringify(output) }]
        }
      };
      await recordFrame({
        direction: "response",
        id: payload.id,
        toolName,
        resultCount: output?.resultCount ?? output?.rows?.length ?? output?.objects?.length
      });
      sendJson(response, 200, result);
    } catch (error) {
      const toolName = payload?.params?.name;
      await recordFrame({
        direction: "error",
        id: payload?.id,
        toolName,
        message: error instanceof Error ? error.message : String(error)
      });
      sendJson(response, 200, {
        jsonrpc: "2.0",
        id: payload?.id ?? null,
        result: {
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }]
        }
      });
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.error(`real-splunk-mcp-bridge listening on http://127.0.0.1:${port}`);
});
