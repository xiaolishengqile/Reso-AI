import test from "node:test";
import assert from "node:assert/strict";
import {
  applyEnvText,
  readServerConfig,
} from "../server/env.js";

test("服务端配置使用公开默认值并规范端口", () => {
  assert.deepEqual(readServerConfig({}), {
    apiKey: "",
    apiUrl: "https://tokendance.space/gateway/v1/chat/completions",
    model: "glm-5.3",
    port: 5173,
    nodeEnv: "development",
    rateLimitMaxRequests: 5,
    rateLimitWindowMs: 60_000,
    rateLimitMaxEntries: 10_000,
    maxConcurrentGenerations: 2,
  });
  assert.equal(readServerConfig({ PORT: "8088" }).port, 8088);
  assert.equal(readServerConfig({ PORT: "70000" }).port, 5173);
});

test("环境文件解析引号和注释且不覆盖已有值", () => {
  const target = { TOKENDANCE_MODEL: "existing-model" };
  applyEnvText([
    "# 本地模型配置",
    "TOKENDANCE_API_KEY='secret-value'",
    "TOKENDANCE_MODEL=glm-5.3 # 行尾注释",
    "PORT=6000",
    "INVALID LINE",
    "COMMAND=$(echo forbidden)",
  ].join("\n"), target);

  assert.deepEqual(target, {
    TOKENDANCE_API_KEY: "secret-value",
    TOKENDANCE_MODEL: "existing-model",
    PORT: "6000",
    COMMAND: "$(echo forbidden)",
  });
});

test("配置读取模型字段但不附带无关环境变量", () => {
  const config = readServerConfig({
    TOKENDANCE_API_KEY: "server-only",
    TOKENDANCE_API_URL: "https://example.test/chat",
    TOKENDANCE_MODEL: "custom-model",
    NODE_ENV: "production",
    ICEBREAKER_RATE_LIMIT_MAX_REQUESTS: "8",
    ICEBREAKER_RATE_LIMIT_WINDOW_MS: "30000",
    ICEBREAKER_RATE_LIMIT_MAX_ENTRIES: "2000",
    ICEBREAKER_MAX_CONCURRENT_GENERATIONS: "4",
    UNRELATED_SECRET: "must-not-copy",
  });
  assert.deepEqual(config, {
    apiKey: "server-only",
    apiUrl: "https://example.test/chat",
    model: "custom-model",
    port: 5173,
    nodeEnv: "production",
    rateLimitMaxRequests: 8,
    rateLimitWindowMs: 30_000,
    rateLimitMaxEntries: 2_000,
    maxConcurrentGenerations: 4,
  });
  assert.equal("UNRELATED_SECRET" in config, false);
});

test("限流和并发配置仅接受正整数", () => {
  const config = readServerConfig({
    ICEBREAKER_RATE_LIMIT_MAX_REQUESTS: "0",
    ICEBREAKER_RATE_LIMIT_WINDOW_MS: "invalid",
    ICEBREAKER_RATE_LIMIT_MAX_ENTRIES: "-1",
    ICEBREAKER_MAX_CONCURRENT_GENERATIONS: "0",
  });

  assert.deepEqual({
    rateLimitMaxRequests: config.rateLimitMaxRequests,
    rateLimitWindowMs: config.rateLimitWindowMs,
    rateLimitMaxEntries: config.rateLimitMaxEntries,
    maxConcurrentGenerations: config.maxConcurrentGenerations,
  }, {
    rateLimitMaxRequests: 5,
    rateLimitWindowMs: 60_000,
    rateLimitMaxEntries: 10_000,
    maxConcurrentGenerations: 2,
  });
});
