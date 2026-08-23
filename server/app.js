import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { createModelGateway } from "./modelGateway.js";
import { generateIcebreaker } from "./icebreakerService.js";
import { generatePersonalManual } from "./personalManualService.js";

const BODY_LIMIT = 32 * 1024;
const ROUTES = new Map([
  ["/api/icebreaker", "icebreaker"],
  ["/api/personal-manual", "personalManual"],
]);
const DEFAULT_RATE_LIMIT = Object.freeze({ maxRequests: 5, windowMs: 60_000, maxEntries: 10_000 });
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
});

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sendJson(response, status, payload, headers = {}) {
  if (response.destroyed || response.writableEnded) return;
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}

function publicError(error) {
  return {
    status: Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500,
    code: typeof error?.code === "string" ? error.code : "INTERNAL_ERROR",
    message: typeof error?.publicMessage === "string"
      ? error.publicMessage
      : "请求暂时无法完成，请稍后重试。",
  };
}

function readJsonBody(request) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        resolveBody({ tooLarge: true, value: null });
        return;
      }
      try {
        resolveBody({ tooLarge: false, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
      } catch {
        reject(Object.assign(new Error("invalid json"), {
          code: "INVALID_JSON",
          publicMessage: "请求内容不是有效的 JSON。",
          status: 400,
        }));
      }
    });
    request.on("error", reject);
  });
}

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

function createControls({ config, rateLimit, maxConcurrentGenerations, getSourceId }) {
  const maxRequests = positiveInteger(rateLimit.maxRequests ?? config.rateLimitMaxRequests, 5);
  const windowMs = positiveInteger(rateLimit.windowMs ?? config.rateLimitWindowMs, 60_000);
  const maxEntries = positiveInteger(rateLimit.maxEntries ?? config.rateLimitMaxEntries, 10_000);
  const concurrencyLimit = positiveInteger(
    maxConcurrentGenerations ?? config.maxConcurrentGenerations,
    2,
  );
  const now = typeof rateLimit.now === "function" ? rateLimit.now : Date.now;
  const sourceWindows = new Map();
  const cleanupIntervalMs = Math.min(windowMs, DEFAULT_RATE_LIMIT.windowMs);
  let nextCleanupAt = 0;
  let activeGenerations = 0;
  return {
    take(request) {
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
        if (sourceWindows.size >= maxEntries) sourceWindows.delete(sourceWindows.keys().next().value);
        window = { count: 0, resetAt: currentTime + windowMs };
        sourceWindows.set(sourceId, window);
      }
      window.count += 1;
      return {
        allowed: window.count <= maxRequests,
        retryAfter: Math.max(1, Math.ceil((window.resetAt - currentTime) / 1000)),
      };
    },
    acquire() {
      if (activeGenerations >= concurrencyLimit) return false;
      activeGenerations += 1;
      return true;
    },
    release() {
      activeGenerations = Math.max(0, activeGenerations - 1);
    },
  };
}

async function handleApi(request, response, route, services, gateway, controls) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "该接口只接受 POST 请求。" } });
    return;
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
    sendJson(response, 415, { ok: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "请求需要使用 JSON 格式。" } });
    return;
  }
  const rate = controls.take(request);
  if (!rate.allowed) {
    sendJson(response, 429, {
      ok: false,
      error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后重试。" },
    }, { "Retry-After": String(rate.retryAfter) });
    return;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  const abortClosedResponse = () => {
    if (!response.writableEnded) controller.abort();
  };
  request.once("aborted", abort);
  response.once("close", abortClosedResponse);
  let acquired = false;
  try {
    const body = await readJsonBody(request);
    if (body.tooLarge) {
      sendJson(response, 413, { ok: false, error: { code: "REQUEST_TOO_LARGE", message: "请求内容过大。" } });
      return;
    }
    if (controller.signal.aborted) return;
    acquired = controls.acquire();
    if (!acquired) {
      sendJson(response, 429, {
        ok: false,
        error: { code: "SERVER_BUSY", message: "生成请求繁忙，请稍后重试。" },
      }, { "Retry-After": "1" });
      return;
    }
    const data = await services[route](body.value, { gateway, signal: controller.signal });
    if (!controller.signal.aborted) sendJson(response, 200, { ok: true, data });
  } catch (error) {
    if (controller.signal.aborted || response.destroyed || response.writableEnded) return;
    const safe = publicError(error);
    sendJson(response, safe.status, { ok: false, error: { code: safe.code, message: safe.message } });
  } finally {
    request.removeListener("aborted", abort);
    response.removeListener("close", abortClosedResponse);
    if (acquired) controls.release();
  }
}

async function serveProduction(request, response, distDirectory) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendJson(response, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "该资源不支持当前请求方式。" } });
    return;
  }
  const rawPath = String(request.url ?? "/").split("?", 1)[0];
  let pathname;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    sendJson(response, 400, { ok: false, error: { code: "INVALID_PATH", message: "资源路径格式无效。" } });
    return;
  }
  if (pathname.split("/").includes("..")) {
    sendJson(response, 403, { ok: false, error: { code: "FORBIDDEN_PATH", message: "资源路径无效。" } });
    return;
  }
  const root = resolve(distDirectory);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    sendJson(response, 403, { ok: false, error: { code: "FORBIDDEN_PATH", message: "资源路径无效。" } });
    return;
  }
  let info;
  try {
    info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    if (extname(relativePath)) {
      sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "没有找到请求的资源。" } });
      return;
    }
    filePath = resolve(root, "index.html");
  }
  try {
    info = await stat(filePath);
  } catch {
    sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "没有找到请求的资源。" } });
    return;
  }
  const extension = extname(filePath).toLowerCase();
  if (!info.isFile() || !MIME_TYPES[extension]) {
    sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "没有找到请求的资源。" } });
    return;
  }
  const headers = {
    "Content-Type": MIME_TYPES[extension],
    "Content-Length": info.size,
    "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
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

export function createApp({
  config = {},
  gateway = createModelGateway(config),
  icebreakerService = generateIcebreaker,
  personalManualService = generatePersonalManual,
  vite = null,
  distDirectory = null,
  rateLimit = {},
  maxConcurrentGenerations = null,
  getSourceId = (request) => request.socket?.remoteAddress ?? "unknown",
} = {}) {
  const controls = createControls({ config, rateLimit, maxConcurrentGenerations, getSourceId });
  const services = { icebreaker: icebreakerService, personalManual: personalManualService };
  return async function app(request, response) {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const route = ROUTES.get(pathname);
    if (route) {
      await handleApi(request, response, route, services, gateway, controls);
      return;
    }
    if (pathname.startsWith("/api/")) {
      sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "没有找到请求的接口。" } });
      return;
    }
    if (vite?.middlewares) {
      vite.middlewares(request, response, () => {
        if (!response.writableEnded) sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "没有找到请求的资源。" } });
      });
      return;
    }
    if (distDirectory) {
      try {
        await serveProduction(request, response, distDirectory);
      } catch {
        sendJson(response, 500, { ok: false, error: { code: "STATIC_ERROR", message: "页面资源暂时无法读取。" } });
      }
      return;
    }
    sendJson(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "没有找到请求的资源。" } });
  };
}
