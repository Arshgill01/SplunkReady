import { lstat, mkdir, readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

export interface ArtifactRun {
  runId: string;
  path: string;
}

const isContained = (root: string, target: string): boolean => {
  const relativePath = relative(root, target);

  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes(`..${sep}`));
};

export class WorkbenchArtifactStore {
  readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async createRunDirectory(): Promise<ArtifactRun> {
    await this.ensureRoot();
    const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const path = this.resolveRun(runId);

    await mkdir(path, { recursive: true });

    return { runId, path };
  }

  resolveRun(runId: string): string {
    if (!/^run-[A-Za-z0-9._-]+$/.test(runId)) {
      throw new Error("Invalid artifact run id.");
    }

    const target = resolve(this.root, runId);

    if (!isContained(this.root, target)) {
      throw new Error("Artifact run path escapes managed root.");
    }

    return target;
  }

  resolveFile(runId: string, fileName: string): string {
    if (fileName.length === 0 || fileName.includes("\0")) {
      throw new Error("Invalid artifact file path.");
    }

    const runRoot = this.resolveRun(runId);
    const target = resolve(runRoot, fileName.replaceAll("\\", "/"));

    if (!isContained(runRoot, target)) {
      throw new Error("Artifact file path escapes run root.");
    }

    return target;
  }

  async readFile(runId: string, fileName: string): Promise<Buffer | undefined> {
    const target = this.resolveFile(runId, fileName);

    try {
      const info = await lstat(target);

      if (!info.isFile()) {
        return undefined;
      }

      return readFile(target);
    } catch {
      return undefined;
    }
  }

  async listRuns(): Promise<Array<{ runId: string; files: number }>> {
    await this.ensureRoot();
    const entries = await readdir(this.root, { withFileTypes: true });
    const runs = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
        .map(async (entry) => {
          const files = await readdir(resolve(this.root, entry.name)).catch(() => []);

          return { runId: basename(entry.name), files: files.length };
        })
    );

    return runs.sort((left, right) => right.runId.localeCompare(left.runId));
  }

  async listRunFiles(runId: string): Promise<string[]> {
    const runRoot = this.resolveRun(runId);
    const collect = async (currentDir: string): Promise<string[]> => {
      const entries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);
      const files = await Promise.all(
        entries.map(async (entry) => {
          const target = resolve(currentDir, entry.name);

          if (entry.isDirectory()) {
            return collect(target);
          }

          if (!entry.isFile()) {
            return [];
          }

          return [relative(runRoot, target).split(sep).join("/")];
        })
      );

      return files.flat();
    };

    return (await collect(runRoot)).sort();
  }
}
