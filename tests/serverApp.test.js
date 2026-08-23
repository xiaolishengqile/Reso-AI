import test from "node:test";
import assert from "node:assert/strict";
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
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: JSON.stringify(body),
    ...options,
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
      calls.push(["icebreaker", body, options.gateway.model]);
      return { virtualMatchName: "云舟", icebreaker: "生成结果" };
    },
    personalManualService: async (body, options) => {
      calls.push(["manual", body, options.gateway.model]);
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
    ["icebreaker", { request: 1 }, "glm-5.3"],
    ["manual", { request: 2 }, "glm-5.3"],
  ]);
});

test("请求体超过六十四 KiB 时拒绝且不调用业务服务", async () => {
  let calls = 0;
  const app = createApp({
    icebreakerService: async () => { calls += 1; },
    personalManualService: async () => { calls += 1; },
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/personal-manual`, json({ text: "长".repeat(70_000) }));
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
    const app = createApp({ distDirectory: directory });
    await withServer(app, async (base) => {
      const asset = await fetch(`${base}/assets/app.js`);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type"), /javascript/);
      const fallback = await fetch(`${base}/some/client/route`);
      assert.match(await fallback.text(), /人生群岛/);
      assert.equal(await rawStatus(base, "/%2e%2e%2fpackage.json"), 403);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
