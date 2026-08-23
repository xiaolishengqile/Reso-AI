import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import {
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  IcebreakerServiceError,
  generateIcebreaker,
} from "./icebreakerService.js";

const MAX_BODY_BYTES = 32 * 1024;
const DEFAULT_RATE_LIMIT = Object.freeze({
  maxRequests: 5,
  windowMs: 60_000,
  maxEntries: 10_000,
});
const DEFAULT_MAX_CONCURRENT_GENERATIONS = 2;

const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
});

function parseByteRange(header, size) {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return false;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return false;
    const length = Math.min(suffixLength, size);
    return { start: size - length, end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start >= size
    || requestedEnd < start
  ) return false;
  return { start, end: Math.min(requestedEnd, size - 1) };
}

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(value));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new IcebreakerServiceError("REQUEST_TOO_LARGE", "请求内容过大", 413);
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new IcebreakerServiceError("INVALID_REQUEST", "请求格式无效", 400);
  }
}

async function handleIcebreaker(request, response, env, generateIcebreakerFn, controls) {
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" });
    response.end();
    return;
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) {
    sendJson(response, 415, { code: "UNSUPPORTED_MEDIA_TYPE", message: "请求需要使用 JSON 格式" });
    return;
  }
  if (!env.TOKENDANCE_API_KEY) {
    sendJson(response, 503, { code: "SERVICE_NOT_CONFIGURED", message: "破冰生成服务尚未配置" });
    return;
  }
  const rate = controls.takeRateLimit(request);
  if (!rate.allowed) {
    sendJson(response, 429, { code: "RATE_LIMITED", message: "请求过于频繁，请稍后重试" }, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
    return;
  }
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  const abortClosedResponse = () => {
    if (!response.writableEnded) controller.abort();
  };
  request.once("aborted", abortRequest);
  response.once("close", abortClosedResponse);
  let acquired = false;
  try {
    const body = await readJsonBody(request);
    if (controller.signal.aborted) return;
    acquired = controls.acquireGeneration();
    if (!acquired) {
      sendJson(response, 429, { code: "SERVER_BUSY", message: "生成请求繁忙，请稍后重试" }, {
        "Retry-After": "1",
      });
      return;
    }
    const result = await generateIcebreakerFn(body, {
      apiKey: env.TOKENDANCE_API_KEY,
      apiUrl: env.TOKENDANCE_API_URL || DEFAULT_API_URL,
      model: env.TOKENDANCE_MODEL || DEFAULT_MODEL,
      signal: controller.signal,
    });
    if (!controller.signal.aborted && !response.destroyed && !response.writableEnded) {
      sendJson(response, 200, result);
    }
  } finally {
    request.removeListener("aborted", abortRequest);
    response.removeListener("close", abortClosedResponse);
    if (acquired) controls.releaseGeneration();
  }
}

async function serveStatic(request, response, pathname, distDir) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  const root = resolve(distDir);
  let relativePath;
  try {
    relativePath = pathname === "/"
      ? "index.html"
      : decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  let filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }
  let info;
  try {
    info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    if (extname(relativePath)) {
      response.writeHead(404);
      response.end();
      return;
    }
    filePath = resolve(root, "index.html");
  }
  try {
    info = await stat(filePath);
  } catch {
    response.writeHead(404);
    response.end();
    return;
  }
  const extension = extname(filePath);
  if (!info.isFile() || !CONTENT_TYPES[extension]) {
    response.writeHead(404);
    response.end();
    return;
  }
  const headers = {
    "Content-Type": CONTENT_TYPES[extension],
    "Content-Length": info.size,
  };
  let status = 200;
  let streamOptions;
  if (extension === ".mp4") {
    headers["Accept-Ranges"] = "bytes";
    const range = parseByteRange(request.headers.range, info.size);
    if (range === false) {
      response.writeHead(416, {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes */${info.size}`,
        "Content-Length": 0,
      });
      response.end();
      return;
    }
    if (range) {
      status = 206;
      headers["Content-Range"] = `bytes ${range.start}-${range.end}/${info.size}`;
      headers["Content-Length"] = range.end - range.start + 1;
      streamOptions = range;
    }
  }
  response.writeHead(status, headers);
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath, streamOptions).pipe(response);
}

export function createAppHandler({
  env = process.env,
  generateIcebreakerFn = generateIcebreaker,
  viteMiddleware = null,
  distDir = resolve(process.cwd(), "dist"),
  rateLimit = {},
  maxConcurrentGenerations = null,
  getSourceId = (request) => request.socket?.remoteAddress ?? "unknown",
} = {}) {
  const maxRequests = positiveInteger(
    rateLimit.maxRequests ?? env.ICEBREAKER_RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT.maxRequests,
  );
  const windowMs = positiveInteger(
    rateLimit.windowMs ?? env.ICEBREAKER_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT.windowMs,
  );
  const maxEntries = positiveInteger(
    rateLimit.maxEntries ?? env.ICEBREAKER_RATE_LIMIT_MAX_ENTRIES,
    DEFAULT_RATE_LIMIT.maxEntries,
  );
  const concurrencyLimit = positiveInteger(
    maxConcurrentGenerations ?? env.ICEBREAKER_MAX_CONCURRENT_GENERATIONS,
    DEFAULT_MAX_CONCURRENT_GENERATIONS,
  );
  const now = typeof rateLimit.now === "function" ? rateLimit.now : Date.now;
  const sourceWindows = new Map();
  const cleanupIntervalMs = Math.min(windowMs, 60_000);
  let nextCleanupAt = 0;
  let activeGenerations = 0;
  const controls = {
    takeRateLimit(request) {
      const sourceId = String(getSourceId(request) || "unknown");
      const currentTime = now();
      if (currentTime >= nextCleanupAt || sourceWindows.size >= maxEntries) {
        for (const [key, value] of sourceWindows) {
          if (currentTime >= value.resetAt) sourceWindows.delete(key);
        }
        nextCleanupAt = currentTime + cleanupIntervalMs;
      }
      let window = sourceWindows.get(sourceId);
      if (!window || currentTime >= window.resetAt) {
        if (sourceWindows.size >= maxEntries) {
          sourceWindows.delete(sourceWindows.keys().next().value);
        }
        window = { count: 0, resetAt: currentTime + windowMs };
        sourceWindows.set(sourceId, window);
      }
      window.count += 1;
      return {
        allowed: window.count <= maxRequests,
        retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - currentTime) / 1000)),
      };
    },
    acquireGeneration() {
      if (activeGenerations >= concurrencyLimit) return false;
      activeGenerations += 1;
      return true;
    },
    releaseGeneration() {
      activeGenerations -= 1;
    },
  };
  return async function appHandler(request, response) {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/api/icebreaker") {
        await handleIcebreaker(request, response, env, generateIcebreakerFn, controls);
      } else if (viteMiddleware) {
        viteMiddleware(request, response, (error) => {
          if (error) sendJson(response, 500, { code: "INTERNAL_ERROR", message: "页面服务暂时不可用" });
        });
      } else {
        await serveStatic(request, response, pathname, distDir);
      }
    } catch (error) {
      if (
        response.destroyed
        || response.writableEnded
        || error?.name === "AbortError"
      ) return;
      const safe = error instanceof IcebreakerServiceError
        ? error
        : new IcebreakerServiceError("INTERNAL_ERROR", "破冰生成暂时失败，请重试", 500);
      if (!response.headersSent) sendJson(response, safe.status, { code: safe.code, message: safe.publicMessage });
      else response.end();
    }
  };
}
