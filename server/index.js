import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { loadEnvFile, readServerConfig } from "./env.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

export async function createHttpServer({
  env = process.env,
  development = null,
  createViteServer = null,
  projectRoot = rootDir,
} = {}) {
  const config = readServerConfig(env);
  const useDevelopmentServer = development ?? config.nodeEnv === "development";
  let vite = null;
  if (useDevelopmentServer) {
    const createVite = createViteServer ?? (await import("vite")).createServer;
    vite = await createVite({
      root: projectRoot,
      appType: "spa",
      server: { middlewareMode: true },
    });
  }
  const server = createServer(createApp({
    config,
    vite,
    distDirectory: useDevelopmentServer ? null : resolve(projectRoot, "dist"),
  }));
  if (vite) server.once("close", () => void vite.close());
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadEnvFile(resolve(rootDir, ".env"));
  const config = readServerConfig();
  const server = await createHttpServer({ env: process.env });
  server.listen(config.port, "0.0.0.0", () => {
    console.log(`人生群岛服务已启动：http://localhost:${config.port}`);
  });
  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
