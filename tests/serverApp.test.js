import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";

async function withServer(app, run) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function json(body, options = {}) {
  const { headers = {}, ...rest } = options;
  return {
    ...rest,
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

function rawStatus(origin, path) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: url.hostname,
      port: url.port,
      path,
      method: "GET",
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
}

test("关系反馈接口只接受 POST JSON 并设置方法提示", async () => {
  const app = createApp({
    icebreakerService: async () => ({ ok: "ice" }),
    personalManualService: async () => ({ ok: "manual" }),
  });
  await withServer(app, async (base) => {
    const method = await fetch(`${base}/api/icebreaker`);
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "POST");

    const contentType = await fetch(`${base}/api/icebreaker`, {
      method: "POST",
      body: "{}",
    });
    assert.equal(contentType.status, 415);

    const malformed = await fetch(`${base}/api/personal-manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
  });
});

test("两条接口调用各自服务并返回统一成功结构", async () => {
  const calls = [];
  const app = createApp({
    gateway: { model: "glm-5.3", complete() {} },
    icebreakerService: async (body, options) => {
      calls.push(["icebreaker", body, options.gateway.model, Boolean(options.signal)]);
      return { virtualMatchName: "云舟", icebreaker: "生成结果" };
    },
    personalManualService: async (body, options) => {
      calls.push(["manual", body, options.gateway.model, Boolean(options.signal)]);
      return { variables: [], sections: [] };
    },
  });
  await withServer(app, async (base) => {
    const ice = await fetch(`${base}/api/icebreaker`, json({ request: 1 }));
    assert.deepEqual(await ice.json(), {
      ok: true,
      data: { virtualMatchName: "云舟", icebreaker: "生成结果" },
    });
    const manual = await fetch(`${base}/api/personal-manual`, json({ request: 2 }));
    assert.equal((await manual.json()).ok, true);
  });
  assert.deepEqual(calls, [
    ["icebreaker", { request: 1 }, "glm-5.3", true],
    ["manual", { request: 2 }, "glm-5.3", true],
  ]);
});

test("请求体超过三十二 KiB 时拒绝且不调用业务服务", async () => {
  let calls = 0;
  const app = createApp({
    icebreakerService: async () => { calls += 1; },
    personalManualService: async () => { calls += 1; },
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/personal-manual`, json({ text: "长".repeat(33_000) }));
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, "REQUEST_TOO_LARGE");
  });
  assert.equal(calls, 0);
});

test("公开错误只使用稳定码和中文消息", async () => {
  const app = createApp({
    icebreakerService: async () => {
      const error = new Error("test-secret and upstream-body");
      error.code = "SERVICE_NOT_CONFIGURED";
      error.publicMessage = "模型生成服务尚未配置。";
      error.status = 503;
      throw error;
    },
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/icebreaker`, json({}));
    const text = await response.text();
    assert.equal(response.status, 503);
    assert.match(text, /模型生成服务尚未配置/);
    assert.doesNotMatch(text, /test-secret|upstream-body|stack|Bearer/);
  });
});

test("生产模式提供静态资源、单页回退并阻止目录穿越", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reso-server-"));
  try {
    await mkdir(join(directory, "assets"));
    await writeFile(join(directory, "index.html"), "<h1>人生群岛</h1>");
    await writeFile(join(directory, "assets", "app.js"), "export const ready = true;");
    await writeFile(join(directory, "assets", "scene.mp4"), "0123456789");
    await writeFile(join(directory, "payload.exe"), "blocked");
    const app = createApp({ distDirectory: directory });
    await withServer(app, async (base) => {
      const asset = await fetch(`${base}/assets/app.js`);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type"), /javascript/);
      const fallback = await fetch(`${base}/some/client/route`);
      assert.match(await fallback.text(), /人生群岛/);
      assert.equal(await rawStatus(base, "/%2e%2e%2fpackage.json"), 403);
      assert.equal((await fetch(`${base}/payload.exe`)).status, 404);
      assert.equal((await fetch(`${base}/%`)).status, 400);

      const partial = await fetch(`${base}/assets/scene.mp4`, { headers: { Range: "Bytes=2-5" } });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get("content-range"), "bytes 2-5/10");
      assert.equal(await partial.text(), "2345");
      const head = await fetch(`${base}/assets/scene.mp4`, {
        method: "HEAD",
        headers: { Range: "Bytes=0-1" },
      });
      assert.equal(head.status, 206);
      assert.equal(head.headers.get("content-length"), "2");
      const invalid = await fetch(`${base}/assets/scene.mp4`, { headers: { Range: "bytes=20-30" } });
      assert.equal(invalid.status, 416);
      assert.equal(invalid.headers.get("content-range"), "bytes */10");
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("真实连接来源受固定窗口限制且伪造转发地址不能绕过", async () => {
  let calls = 0;
  const app = createApp({
    rateLimit: { maxRequests: 1, windowMs: 60_000, now: () => 1_000 },
    icebreakerService: async () => { calls += 1; return {}; },
  });
  await withServer(app, async (base) => {
    assert.equal((await fetch(`${base}/api/icebreaker`, json({}, {
      headers: { "X-Forwarded-For": "198.51.100.1" },
    }))).status, 200);
    const limited = await fetch(`${base}/api/icebreaker`, json({}, {
      headers: { "X-Forwarded-For": "203.0.113.2" },
    }));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal((await limited.json()).error.code, "RATE_LIMITED");
  });
  assert.equal(calls, 1);
});

test("来源窗口过期清理并在容量满时淘汰最旧项", async () => {
  let now = 0;
  const app = createApp({
    rateLimit: { maxRequests: 1, windowMs: 1_000, maxEntries: 2, now: () => now },
    getSourceId: (request) => request.headers["x-test-source"],
    icebreakerService: async () => ({}),
  });
  await withServer(app, async (base) => {
    const send = (source) => fetch(`${base}/api/icebreaker`, json({}, {
      headers: { "X-Test-Source": source },
    }));
    assert.equal((await send("oldest")).status, 200);
    now = 100;
    assert.equal((await send("second")).status, 200);
    now = 200;
    assert.equal((await send("third")).status, 200);
    now = 300;
    assert.equal((await send("oldest")).status, 200);
    now = 1_500;
    assert.equal((await send("expired")).status, 200);
    assert.equal((await send("expired")).status, 429);
  });
});

test("并发满载返回 429，客户端断开会取消并释放槽位", async () => {
  let calls = 0;
  let releaseFirst;
  let receivedSignal;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const app = createApp({
    rateLimit: { maxRequests: 20 },
    maxConcurrentGenerations: 1,
    icebreakerService: async (_body, { signal }) => {
      calls += 1;
      receivedSignal = signal;
      markStarted();
      if (calls > 2) return {};
      return new Promise((resolve, reject) => {
        if (calls === 1) releaseFirst = resolve;
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });
  await withServer(app, async (base) => {
    const pending = fetch(`${base}/api/icebreaker`, json({}));
    await started;
    const busy = await fetch(`${base}/api/icebreaker`, json({}));
    assert.equal(busy.status, 429);
    assert.equal((await busy.json()).error.code, "SERVER_BUSY");
    releaseFirst({});
    assert.equal((await pending).status, 200);

    const request = httpRequest(`${base}/api/icebreaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    request.on("error", () => {});
    request.end("{}");
    await new Promise((resolve) => setTimeout(resolve, 10));
    request.destroy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(receivedSignal.aborted, true);
    assert.equal((await fetch(`${base}/api/icebreaker`, json({}))).status, 200);
  });
});

test("开发服务器关闭时会关闭 Vite 实例", async () => {
  const script = `
    import { once } from "node:events";
    import { createHttpServer } from "./server/index.js";
    let closeCalls = 0;
    const server = await createHttpServer({
      development: true,
      createViteServer: async () => ({
        middlewares: (_request, response) => response.end(),
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
