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

function postIcebreaker(origin, headers = {}) {
  return fetch(`${origin}/api/icebreaker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ protocolVersion: 1, evidence: [] }),
  });
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

test("固定窗口按真实连接来源限流且默认忽略转发地址", async () => {
  let calls = 0;
  const handler = createAppHandler({
    env: { TOKENDANCE_API_KEY: "test-key" },
    rateLimit: { maxRequests: 1, windowMs: 60_000, now: () => 1_000 },
    generateIcebreakerFn: async () => {
      calls += 1;
      return { virtualMatchName: "云舟", icebreaker: "话".repeat(180) };
    },
  });
  await withServer(handler, async (origin) => {
    assert.equal((await postIcebreaker(origin, { "X-Forwarded-For": "198.51.100.1" })).status, 200);
    const limited = await postIcebreaker(origin, { "X-Forwarded-For": "203.0.113.2" });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal((await limited.json()).code, "RATE_LIMITED");
  });
  assert.equal(calls, 1);
});

test("来源窗口清理过期项并在容量满时淘汰最旧项", async () => {
  let now = 0;
  const handler = createAppHandler({
    env: { TOKENDANCE_API_KEY: "test-key" },
    rateLimit: { maxRequests: 1, windowMs: 1_000, maxEntries: 2, now: () => now },
    getSourceId: (request) => request.headers["x-test-source"],
    generateIcebreakerFn: async () => ({ virtualMatchName: "云舟", icebreaker: "话".repeat(180) }),
  });
  await withServer(handler, async (origin) => {
    assert.equal((await postIcebreaker(origin, { "X-Test-Source": "oldest" })).status, 200);
    now = 100;
    assert.equal((await postIcebreaker(origin, { "X-Test-Source": "second" })).status, 200);
    now = 200;
    assert.equal((await postIcebreaker(origin, { "X-Test-Source": "third" })).status, 200);
    now = 300;
    assert.equal((await postIcebreaker(origin, { "X-Test-Source": "oldest" })).status, 200);

    now = 1_500;
    assert.equal((await postIcebreaker(origin, { "X-Test-Source": "expired" })).status, 200);
    assert.equal((await postIcebreaker(origin, { "X-Test-Source": "expired" })).status, 429);
  });
});

test("受信任来源策略可显式注入", async () => {
  const handler = createAppHandler({
    env: { TOKENDANCE_API_KEY: "test-key" },
    rateLimit: { maxRequests: 1, windowMs: 60_000, now: () => 1_000 },
    getSourceId: (request) => request.headers["x-forwarded-for"],
    generateIcebreakerFn: async () => ({ virtualMatchName: "云舟", icebreaker: "话".repeat(180) }),
  });
  await withServer(handler, async (origin) => {
    assert.equal((await postIcebreaker(origin, { "X-Forwarded-For": "198.51.100.1" })).status, 200);
    assert.equal((await postIcebreaker(origin, { "X-Forwarded-For": "203.0.113.2" })).status, 200);
  });
});

test("全局上游并发满载时稳定返回 429", async () => {
  let releaseFirst;
  let startedFirst;
  const firstStarted = new Promise((resolve) => { startedFirst = resolve; });
  const handler = createAppHandler({
    env: { TOKENDANCE_API_KEY: "test-key" },
    rateLimit: { maxRequests: 10, windowMs: 60_000, now: () => 1_000 },
    maxConcurrentGenerations: 1,
    generateIcebreakerFn: async () => {
      startedFirst();
      return new Promise((resolve) => { releaseFirst = resolve; });
    },
  });
  await withServer(handler, async (origin) => {
    const first = postIcebreaker(origin);
    await firstStarted;
    const busy = await postIcebreaker(origin);
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get("retry-after"), "1");
    assert.equal((await busy.json()).code, "SERVER_BUSY");
    releaseFirst({ virtualMatchName: "云舟", icebreaker: "话".repeat(180) });
    assert.equal((await first).status, 200);
  });
});

test("客户端断开会取消生成并释放并发槽位", async () => {
  let receivedSignal;
  let calls = 0;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const handler = createAppHandler({
    env: { TOKENDANCE_API_KEY: "test-key" },
    rateLimit: { maxRequests: 10, windowMs: 60_000 },
    maxConcurrentGenerations: 1,
    generateIcebreakerFn: async (_body, { signal } = {}) => {
      calls += 1;
      receivedSignal = signal;
      markStarted();
      if (calls > 1) return { virtualMatchName: "云舟", icebreaker: "话".repeat(180) };
      if (!signal) return { virtualMatchName: "云舟", icebreaker: "话".repeat(180) };
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });
  await withServer(handler, async (origin) => {
    const request = http.request(`${origin}/api/icebreaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    request.on("error", () => {});
    request.end(JSON.stringify({ protocolVersion: 1, evidence: [] }));
    await started;
    request.destroy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(receivedSignal?.aborted, true);

    const response = await postIcebreaker(origin);
    assert.equal(response.status, 200);
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

test("生产视频支持单段字节范围与 HEAD", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "reso-server-"));
  await mkdir(join(distDir, "assets"));
  await writeFile(join(distDir, "index.html"), "<h1>人生群岛</h1>");
  await writeFile(join(distDir, "assets", "scene.mp4"), "0123456789");
  try {
    await withServer(createAppHandler({ env: {}, distDir }), async (origin) => {
      const partial = await fetch(`${origin}/assets/scene.mp4`, {
        headers: { Range: "bytes=2-5" },
      });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get("accept-ranges"), "bytes");
      assert.equal(partial.headers.get("content-range"), "bytes 2-5/10");
      assert.equal(partial.headers.get("content-length"), "4");
      assert.equal(await partial.text(), "2345");

      const uppercaseUnit = await fetch(`${origin}/assets/scene.mp4`, {
        headers: { Range: "Bytes=0-1" },
      });
      assert.equal(uppercaseUnit.status, 206);
      assert.equal(uppercaseUnit.headers.get("content-range"), "bytes 0-1/10");
      assert.equal(await uppercaseUnit.text(), "01");

      const head = await fetch(`${origin}/assets/scene.mp4`, {
        method: "HEAD",
        headers: { Range: "Bytes=0-1" },
      });
      assert.equal(head.status, 206);
      assert.equal(head.headers.get("content-range"), "bytes 0-1/10");
      assert.equal(head.headers.get("content-length"), "2");
      assert.equal(await head.text(), "");
    });
  } finally {
    await rm(distDir, { recursive: true, force: true });
  }
});

test("生产视频拒绝无效、越界和多段字节范围", async () => {
  const distDir = await mkdtemp(join(tmpdir(), "reso-server-"));
  await mkdir(join(distDir, "assets"));
  await writeFile(join(distDir, "index.html"), "<h1>人生群岛</h1>");
  await writeFile(join(distDir, "assets", "scene.mp4"), "0123456789");
  try {
    await withServer(createAppHandler({ env: {}, distDir }), async (origin) => {
      for (const range of ["bytes=20-30", "bytes=5-2", "bytes=0-1,4-5", "items=0-1"]) {
        const response = await fetch(`${origin}/assets/scene.mp4`, { headers: { Range: range } });
        assert.equal(response.status, 416);
        assert.equal(response.headers.get("accept-ranges"), "bytes");
        assert.equal(response.headers.get("content-range"), "bytes */10");
      }
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
