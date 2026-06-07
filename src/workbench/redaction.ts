const secretNamePattern = /(token|secret|password|credential|api[_-]?key)/i;
const bearerPattern = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const assignmentPattern = /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL)[A-Z0-9_]*=)([^\s,;]+)/gi;
const urlPattern = /\bhttps?:\/\/[^\s"')\]}]+/gi;

export const secretEnvValues = (env: NodeJS.ProcessEnv = process.env): string[] =>
  Object.entries(env)
    .filter(([key, value]) => secretNamePattern.test(key) && typeof value === "string" && value.length >= 8)
    .map(([, value]) => value as string);

export const redactText = (input: string, env: NodeJS.ProcessEnv = process.env): string => {
  let redacted = input
    .replace(bearerPattern, "$1[REDACTED]")
    .replace(assignmentPattern, "$1[REDACTED]")
    .replace(urlPattern, "[REDACTED_URL]");

  for (const secret of secretEnvValues(env)) {
    redacted = redacted.replaceAll(secret, "[REDACTED]");
  }

  return redacted;
};

export const redactUnknownError = (error: unknown, env: NodeJS.ProcessEnv = process.env): string => {
  if (error instanceof Error) {
    return redactText(error.message, env);
  }

  if (error && typeof error === "object") {
    const input = error as {
      name?: unknown;
      code?: unknown;
      message?: unknown;
      context?: { toolName?: unknown };
      cause?: unknown;
    };

    if (input.name === "SplunkAdapterError") {
      const code = typeof input.code === "string" ? input.code : "SPLUNK_ADAPTER_ERROR";
      const message = typeof input.message === "string" ? input.message : "Splunk adapter failed.";
      const toolName = typeof input.context?.toolName === "string" ? input.context.toolName : "unknown_tool";
      const causeMessage =
        input.cause instanceof Error
          ? ` Cause: ${input.cause.message}`
          : input.cause && typeof input.cause === "object" && "message" in input.cause
            ? ` Cause: ${String((input.cause as { message: unknown }).message)}`
            : "";

      return redactText(`${code} while calling ${toolName}: ${message}${causeMessage}`, env);
    }

    if (typeof input.message === "string") {
      return redactText(input.message, env);
    }
  }

  return redactText(String(error), env);
};
