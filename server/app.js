import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createModelGateway } from "./modelGateway.js";
import { generateIcebreaker } from "./icebreakerService.js";
import { generatePersonalManual } from "./personalManualService.js";

const BODY_LIMIT = 64 * 1024;
const ROUTES = new Map([
  ["/api/icebreaker", "icebreaker"],
  ["/api/personal-manual", "personalManual"],
]);
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

function sendJson(response, status, payload) {
  if (response.writableEnded) return;
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function publicError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  return {
    status,
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
      } else if (!tooLarge) {
        chunks.push(chunk);
      }
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

async function handleApi(request, response, route, services, gateway) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "该接口只接受 POST 请求。" },
    });
    return;
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
    sendJson(response, 415, {
      ok: false,
      error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "请求需要使用 JSON 格式。" },
    });
    return;
  }
  try {
    const body = await readJsonBody(request);
    if (body.tooLarge) {
      sendJson(response, 413, {
        ok: false,
        error: { code: "REQUEST_TOO_LARGE", message: "请求内容过大。" },
      });
      return;
    }
    const data = await services[route](body.value, { gateway });
    sendJson(response, 200, { ok: true, data });
  } catch (error) {
    const safe = publicError(error);
    sendJson(response, safe.status, {
      ok: false,
      error: { code: safe.code, message: safe.message },
    });
  }
}

function safePathname(rawUrl) {
  const rawPath = String(rawUrl ?? "/").split("?", 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.split("/").includes("..")) return null;
  return decoded;
}

async function serveProduction(request, response, distDirectory) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "该资源不支持当前请求方式。" },
    });
    return;
  }
  const pathname = safePathname(request.url);
  if (pathname === null) {
    sendJson(response, 403, {
      ok: false,
      error: { code: "FORBIDDEN_PATH", message: "资源路径无效。" },
    });
    return;
  }
  const root = resolve(distDirectory);
  const requested = resolve(root, `.${pathname}`);
  if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
    sendJson(response, 403, {
      ok: false,
      error: { code: "FORBIDDEN_PATH", message: "资源路径无效。" },
    });
    return;
  }
  let path = pathname === "/" ? resolve(root, "index.html") : requested;
  let content;
  try {
    content = await readFile(path);
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "EISDIR") throw error;
    if (extname(pathname)) {
      sendJson(response, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "没有找到请求的资源。" },
      });
      return;
    }
    path = resolve(root, "index.html");
    content = await readFile(path);
  }
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": content.length,
    "Cache-Control": path.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
  });
  response.end(request.method === "HEAD" ? undefined : content);
}

export function createApp({
  config = {},
  gateway = createModelGateway(config),
  icebreakerService = generateIcebreaker,
  personalManualService = generatePersonalManual,
  vite = null,
  distDirectory = null,
} = {}) {
  const services = { icebreaker: icebreakerService, personalManual: personalManualService };
  return async function app(request, response) {
    const pathname = safePathname(request.url);
    const route = ROUTES.get(pathname);
    if (route) {
      await handleApi(request, response, route, services, gateway);
      return;
    }
    if (pathname?.startsWith("/api/")) {
      sendJson(response, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "没有找到请求的接口。" },
      });
      return;
    }
    if (vite?.middlewares) {
      vite.middlewares(request, response, () => {
        if (!response.writableEnded) {
          sendJson(response, 404, {
            ok: false,
            error: { code: "NOT_FOUND", message: "没有找到请求的资源。" },
          });
        }
      });
      return;
    }
    if (distDirectory) {
      try {
        await serveProduction(request, response, distDirectory);
      } catch {
        sendJson(response, 500, {
          ok: false,
          error: { code: "STATIC_ERROR", message: "页面资源暂时无法读取。" },
        });
      }
      return;
    }
    sendJson(response, pathname === null ? 403 : 404, {
      ok: false,
      error: pathname === null
        ? { code: "FORBIDDEN_PATH", message: "资源路径无效。" }
        : { code: "NOT_FOUND", message: "没有找到请求的资源。" },
    });
  };
}
