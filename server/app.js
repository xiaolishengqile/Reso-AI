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

const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
});

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
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

async function handleIcebreaker(request, response, env, generateIcebreakerFn) {
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
  const body = await readJsonBody(request);
  const result = await generateIcebreakerFn(body, {
    apiKey: env.TOKENDANCE_API_KEY,
    apiUrl: env.TOKENDANCE_API_URL || DEFAULT_API_URL,
    model: env.TOKENDANCE_MODEL || DEFAULT_MODEL,
  });
  sendJson(response, 200, result);
}

async function serveStatic(request, response, pathname, distDir) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  const root = resolve(distDir);
  const relativePath = pathname === "/"
    ? "index.html"
    : decodeURIComponent(pathname).replace(/^\/+/, "");
  let filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    if (extname(relativePath)) {
      response.writeHead(404);
      response.end();
      return;
    }
    filePath = resolve(root, "index.html");
  }
  const info = await stat(filePath);
  if (!info.isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
    "Content-Length": info.size,
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
}

export function createAppHandler({
  env = process.env,
  generateIcebreakerFn = generateIcebreaker,
  viteMiddleware = null,
  distDir = resolve(process.cwd(), "dist"),
} = {}) {
  return async function appHandler(request, response) {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/api/icebreaker") {
        await handleIcebreaker(request, response, env, generateIcebreakerFn);
      } else if (viteMiddleware) {
        viteMiddleware(request, response, (error) => {
          if (error) sendJson(response, 500, { code: "INTERNAL_ERROR", message: "页面服务暂时不可用" });
        });
      } else {
        await serveStatic(request, response, pathname, distDir);
      }
    } catch (error) {
      const safe = error instanceof IcebreakerServiceError
        ? error
        : new IcebreakerServiceError("INTERNAL_ERROR", "破冰生成暂时失败，请重试", 500);
      if (!response.headersSent) sendJson(response, safe.status, { code: safe.code, message: safe.publicMessage });
      else response.end();
    }
  };
}
