import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: Record<string, unknown>;
}

export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export interface McpClientSessionRecord {
  direction: "request" | "notification" | "response";
  sequence: number;
  method?: string;
  id?: string | number | null;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

export const isJsonRpcError = (response: JsonRpcResponse): response is JsonRpcError => "error" in response;

export class McpStdioClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending: Array<(response: JsonRpcResponse) => void> = [];
  private readonly sessionRecords: McpClientSessionRecord[] = [];
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private sequence = 0;

  constructor(serverPath: string, serverArgs: string[] = []) {
    this.child = spawn(process.execPath, [serverPath, ...serverArgs], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.acceptStdout(chunk));
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
    });
  }

  async request(method: string, params?: unknown): Promise<Record<string, unknown>> {
    const id = this.pending.length + 1;
    const response = await this.send({ jsonrpc: "2.0", id, method, params });

    if (isJsonRpcError(response)) {
      throw new Error(`MCP ${method} failed: ${response.error.message}`);
    }

    return response.result;
  }

  notify(method: string, params?: unknown): void {
    const message = { jsonrpc: "2.0", method, params };

    this.sessionRecords.push({
      direction: "notification",
      sequence: ++this.sequence,
      method,
      params
    });
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  close(): void {
    this.child.stdin.end();
    this.child.kill();
  }

  session(): McpClientSessionRecord[] {
    return [...this.sessionRecords];
  }

  private async send(message: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = typeof message.id === "string" || typeof message.id === "number" || message.id === null ? message.id : null;
    const method = typeof message.method === "string" ? message.method : undefined;

    this.sessionRecords.push({
      direction: "request",
      sequence: ++this.sequence,
      id,
      method,
      params: message.params
    });

    const response = new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for MCP response. ${this.stderrBuffer.trim()}`.trim()));
      }, 60_000);

      this.pending.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });

    this.child.stdin.write(`${JSON.stringify(message)}\n`);

    return response;
  }

  private acceptStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    while (this.stdoutBuffer.includes("\n")) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      const resolve = this.pending.shift();

      if (resolve) {
        const parsed = JSON.parse(line) as JsonRpcResponse;

        this.sessionRecords.push({
          direction: "response",
          sequence: ++this.sequence,
          id: parsed.id,
          result: "result" in parsed ? parsed.result : undefined,
          error: "error" in parsed ? parsed.error : undefined
        });
        resolve(parsed);
      }
    }
  }
}
