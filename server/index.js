import http from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createAppHandler } from "./app.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const envPath = resolve(rootDir, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const development = process.argv.includes("--dev");
let viteMiddleware = null;
if (development) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: rootDir,
    appType: "spa",
    server: { middlewareMode: true },
  });
  viteMiddleware = vite.middlewares;
}

const port = Number.parseInt(process.env.PORT ?? "5173", 10);
const listeningPort = Number.isFinite(port) ? port : 5173;
const server = http.createServer(createAppHandler({
  env: process.env,
  viteMiddleware,
  distDir: resolve(rootDir, "dist"),
}));
server.listen(listeningPort, () => {
  console.log(`人生群岛已启动：http://localhost:${listeningPort}`);
});
