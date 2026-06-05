const secretNamePattern = /(token|secret|password|credential|api[_-]?key)/i;
const bearerPattern = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const assignmentPattern = /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL)[A-Z0-9_]*=)([^\s,;]+)/gi;

export const secretEnvValues = (env: NodeJS.ProcessEnv = process.env): string[] =>
  Object.entries(env)
    .filter(([key, value]) => secretNamePattern.test(key) && typeof value === "string" && value.length >= 8)
    .map(([, value]) => value as string);

export const redactText = (input: string, env: NodeJS.ProcessEnv = process.env): string => {
  let redacted = input.replace(bearerPattern, "$1[REDACTED]").replace(assignmentPattern, "$1[REDACTED]");

  for (const secret of secretEnvValues(env)) {
    redacted = redacted.replaceAll(secret, "[REDACTED]");
  }

  return redacted;
};

export const redactUnknownError = (error: unknown, env: NodeJS.ProcessEnv = process.env): string => {
  if (error instanceof Error) {
    return redactText(error.message, env);
  }

  return redactText(String(error), env);
};
