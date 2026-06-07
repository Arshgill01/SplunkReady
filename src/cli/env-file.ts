import { readFile } from "node:fs/promises";

export const parseEnvFileContent = (content: string): Record<string, string> => {
  const parsed: Record<string, string> = {};

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equalsIndex = normalized.indexOf("=");

    if (equalsIndex <= 0) {
      throw new Error(`Invalid env file line ${index + 1}; expected KEY=value syntax.`);
    }

    const key = normalized.slice(0, equalsIndex).trim();
    const rawValue = normalized.slice(equalsIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env file key on line ${index + 1}.`);
    }

    parsed[key] = parseEnvValue(rawValue);
  }

  return parsed;
};

const parseEnvValue = (value: string): string => {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  const hashIndex = value.indexOf("#");
  return (hashIndex >= 0 ? value.slice(0, hashIndex) : value).trim();
};

export const loadEnvFile = async (envFile: string): Promise<Record<string, string>> =>
  parseEnvFileContent(await readFile(envFile, "utf8"));

export const mergeEnvFile = async (
  baseEnv: NodeJS.ProcessEnv,
  envFile: string
): Promise<NodeJS.ProcessEnv> => {
  if (!envFile) {
    return baseEnv;
  }

  const fileEnv = await loadEnvFile(envFile);
  return { ...baseEnv, ...fileEnv };
};
