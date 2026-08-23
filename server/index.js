import { createServer } from "node:http";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { loadEnvFile, readServerConfig } from "./env.js";

loadEnvFile(resolve(".env"));
const config = readServerConfig();
const vite = config.nodeEnv === "development"
  ? await import("vite").then(({ createServer: createViteServer }) => createViteServer({
      appType: "spa",
      server: { middlewareMode: true },
    }))
  : null;
const app = createApp({
  config,
  vite,
  distDirectory: config.nodeEnv === "production" ? resolve("dist") : null,
});
const server = createServer(app);

server.listen(config.port, "0.0.0.0", () => {
  console.log(`人生群岛服务已启动：http://localhost:${config.port}`);
});

async function close() {
  await vite?.close?.();
  server.close(() => process.exit(0));
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
