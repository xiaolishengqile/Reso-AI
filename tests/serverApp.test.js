import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppHandler } from "../server/app.js";

async function withServer(handler, run) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("破冰接口只接受带大小限制的 POST JSON", async () => {
  await withServer(createAppHandler({
    env: { TOKENDANCE_API_KEY: "test-key" },
    generateIcebreakerFn: async () => ({ virtualMatchName: "云舟", icebreaker: "话".repeat(180) }),
  }), async (origin) => {
    assert.equal((await fetch(`${origin}/api/icebreaker`)).status, 405);
    assert.equal((await fetch(`${origin}/api/icebreaker`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not-json",
    })).status, 415);
    const oversized = await fetch(`${origin}/api/icebreaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "大".repeat(33000) }),
    });
    assert.equal(oversized.status, 413);
  });
});

test("未配置密钥时返回稳定中文错误且不调用生成器", async () => {
  let calls = 0;
  await withServer(createAppHandler({
    env: {},
    generateIcebreakerFn: async () => { calls += 1; },
  }), async (origin) => {
    const response = await fetch(`${origin}/api/icebreaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolVersion: 1, evidence: [] }),
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.code, "SERVICE_NOT_CONFIGURED");
    assert.equal(calls, 0);
  });
});

test("成功结果以同源 JSON 返回且密钥只传给服务函数", async () => {
  let receivedOptions;
  await withServer(createAppHandler({
    env: { TOKENDANCE_API_KEY: "server-only-key" },
    generateIcebreakerFn: async (request, options) => {
      receivedOptions = options;
      return { virtualMatchName: "云舟", icebreaker: "话".repeat(180) };
    },
  }), async (origin) => {
    const response = await fetch(`${origin}/api/icebreaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolVersion: 1, evidence: [] }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).virtualMatchName, "云舟");
    assert.equal(receivedOptions.apiKey, "server-only-key");
  });
});

test("生产模式提供构建文件并阻止目录穿越", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "reso-server-"));
  await writeFile(join(distDir, "index.html"), "<h1>人生群岛</h1>");
  try {
    await withServer(createAppHandler({ env: {}, distDir }), async (origin) => {
      assert.match(await (await fetch(`${origin}/`)).text(), /人生群岛/);
      assert.equal((await fetch(`${origin}/..%2Fsecret.txt`)).status, 403);
      assert.equal((await fetch(`${origin}/missing.js`)).status, 404);
    });
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("生产静态目录缺少首页时稳定返回 404", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "reso-server-"));
  await mkdir(join(distDir, "assets"));
  try {
    await withServer(createAppHandler({ env: {}, distDir }), async (origin) => {
      assert.equal((await fetch(`${origin}/assets`)).status, 404);
    });
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("生产静态服务拒绝未知扩展名", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "reso-server-"));
  await writeFile(join(distDir, "index.html"), "<h1>人生群岛</h1>");
  await writeFile(join(distDir, "payload.exe"), "blocked");
  try {
    await withServer(createAppHandler({ env: {}, distDir }), async (origin) => {
      assert.equal((await fetch(`${origin}/payload.exe`)).status, 404);
    });
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("生产静态服务拒绝畸形百分号路径", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "reso-server-"));
  await writeFile(join(distDir, "index.html"), "<h1>人生群岛</h1>");
  try {
    await withServer(createAppHandler({ env: {}, distDir }), async (origin) => {
      assert.equal((await fetch(`${origin}/%`)).status, 400);
    });
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("开发服务器关闭时会关闭 Vite 实例", async () => {
  const script = `
    import { once } from "node:events";
    import { createHttpServer } from "./server/index.js";
    let closeCalls = 0;
    const server = await createHttpServer({
      development: true,
      createViteServer: async () => ({
        middlewares: (request, response) => response.end(),
        close: async () => { closeCalls += 1; },
      }),
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    server.close();
    await once(server, "close");
    if (closeCalls !== 1) throw new Error("Vite 未关闭");
  `;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    stdio: "ignore",
  });
  const [code] = await once(child, "close");
  assert.equal(code, 0);
});
