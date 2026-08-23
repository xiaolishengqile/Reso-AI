import http from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createAppHandler } from "./app.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const envPath = resolve(rootDir, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

export async function createHttpServer({
  env = process.env,
  development = false,
  createViteServer = null,
  projectRoot = rootDir,
} = {}) {
  let vite = null;
  if (development) {
    const createServer = createViteServer ?? (await import("vite")).createServer;
    vite = await createServer({
      root: projectRoot,
      appType: "spa",
      server: { middlewareMode: true },
    });
  }

  const server = http.createServer(createAppHandler({
    env,
    viteMiddleware: vite?.middlewares ?? null,
    distDir: resolve(projectRoot, "dist"),
  }));
  if (vite) {
    server.once("close", () => {
      void vite.close();
    });
  }
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT ?? "5173", 10);
  const listeningPort = Number.isFinite(port) ? port : 5173;
  const server = await createHttpServer({ development: process.argv.includes("--dev") });
  server.listen(listeningPort, () => {
    console.log(`人生群岛已启动：http://localhost:${listeningPort}`);
  });
}
