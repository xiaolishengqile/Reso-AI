import { readFileSync } from "node:fs";

const DEFAULT_API_URL = "https://tokendance.space/gateway/v1/chat/completions";

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) return trimmed.slice(1, -1);
  return trimmed.replace(/\s+#.*$/, "").trim();
}

export function applyEnvText(source, target = process.env) {
  for (const line of String(source).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || target[match[1]] !== undefined) continue;
    target[match[1]] = unquote(match[2]);
  }
  return target;
}

export function loadEnvFile(path, target = process.env) {
  try {
    applyEnvText(readFileSync(path, "utf8"), target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export function readServerConfig(env = process.env) {
  const requestedPort = Number.parseInt(env.PORT, 10);
  const positiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  return Object.freeze({
    apiKey: typeof env.TOKENDANCE_API_KEY === "string"
      ? env.TOKENDANCE_API_KEY.trim()
      : "",
    apiUrl: typeof env.TOKENDANCE_API_URL === "string" && env.TOKENDANCE_API_URL.trim()
      ? env.TOKENDANCE_API_URL.trim()
      : DEFAULT_API_URL,
    model: typeof env.TOKENDANCE_MODEL === "string" && env.TOKENDANCE_MODEL.trim()
      ? env.TOKENDANCE_MODEL.trim()
      : "glm-5.3",
    port: Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort <= 65_535
      ? requestedPort
      : 5173,
    nodeEnv: env.NODE_ENV === "production" ? "production" : "development",
    rateLimitMaxRequests: positiveInteger(env.ICEBREAKER_RATE_LIMIT_MAX_REQUESTS, 5),
    rateLimitWindowMs: positiveInteger(env.ICEBREAKER_RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMaxEntries: positiveInteger(env.ICEBREAKER_RATE_LIMIT_MAX_ENTRIES, 10_000),
    maxConcurrentGenerations: positiveInteger(env.ICEBREAKER_MAX_CONCURRENT_GENERATIONS, 2),
  });
}
