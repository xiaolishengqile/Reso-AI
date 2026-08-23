import test from "node:test";
import assert from "node:assert/strict";
import {
  ModelGatewayError,
  createModelGateway,
} from "../server/modelGateway.js";

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() { return body; },
  };
}

test("共享网关使用服务端授权、配置模型并抽取回复文本", async () => {
  const calls = [];
  const gateway = createModelGateway({
    apiKey: "test-secret",
    apiUrl: "https://model.example/chat",
    model: "glm-5.3",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ choices: [{ message: { content: "模型回复" } }] });
    },
  });

  assert.equal(await gateway.complete([{ role: "user", content: "测试" }]), "模型回复");
  assert.equal(calls[0].url, "https://model.example/chat");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-secret");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: "glm-5.3",
    messages: [{ role: "user", content: "测试" }],
    reasoning_effort: "high",
  });
  assert.equal(gateway.model, "glm-5.3");
});

test("默认等待窗口不会在十五秒时提前中止模型请求", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let finishRequest;
  const gateway = createModelGateway({
    apiKey: "test-secret",
    fetchImpl: async () => new Promise((resolve) => {
      finishRequest = resolve;
    }),
  });

  const pending = gateway.complete([]);
  await Promise.resolve();
  context.mock.timers.tick(15_000);
  finishRequest(response({ choices: [{ message: { content: "模型回复" } }] }));

  assert.equal(await pending, "模型回复");
});

test("缺少密钥时返回稳定的未配置错误且不发请求", async () => {
  let called = false;
  const gateway = createModelGateway({
    apiKey: "",
    fetchImpl: async () => { called = true; },
  });
  await assert.rejects(gateway.complete([]), (error) => (
    error instanceof ModelGatewayError
    && error.code === "SERVICE_NOT_CONFIGURED"
    && error.publicMessage === "模型生成服务尚未配置。"
  ));
  assert.equal(called, false);
});

test("上游失败和异常结构不会暴露响应正文", async () => {
  const failing = createModelGateway({
    apiKey: "test-secret",
    fetchImpl: async () => response({ secret: "upstream-private" }, { ok: false, status: 500 }),
  });
  await assert.rejects(failing.complete([]), (error) => (
    error.code === "MODEL_UNAVAILABLE"
    && !JSON.stringify(error).includes("upstream-private")
    && !error.message.includes("test-secret")
  ));

  const malformed = createModelGateway({
    apiKey: "test-secret",
    fetchImpl: async () => response({ choices: [] }),
  });
  await assert.rejects(malformed.complete([]), { code: "MODEL_INVALID_RESPONSE" });
});

test("请求超时会中止上游并返回稳定错误", async () => {
  let aborted = false;
  const gateway = createModelGateway({
    apiKey: "test-secret",
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    }),
  });
  await assert.rejects(gateway.complete([]), { code: "MODEL_TIMEOUT" });
  assert.equal(aborted, true);
});

test("下游取消会原样中止上游而不是误报超时", async () => {
  const controller = new AbortController();
  let upstreamSignal;
  const gateway = createModelGateway({
    apiKey: "test-secret",
    timeoutMs: 10_000,
    fetchImpl: async (_url, { signal }) => {
      upstreamSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });
  const pending = gateway.complete([], { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error?.name === "AbortError");
  assert.equal(upstreamSignal.aborted, true);
});
