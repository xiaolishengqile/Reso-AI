import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import { createTravelerProfile, saveTravelerProfile } from "../src/profile/travelerProfile.js";
import { createMountainProgress, saveMountainProgress } from "../src/scenes/mountain/progress.js";
import { MOUNTAIN_STAGES } from "../src/scenes/mountain/storyContent.js";
import { loadIcebreakerCache, saveIcebreakerCache } from "../src/icebreaker/icebreakerData.js";
import { createIcebreakerFeature } from "../src/icebreaker/createIcebreakerFeature.js";

class FakeElement {
  constructor() {
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.textContent = "";
    this.listeners = new Map();
    this.attributes = new Map();
    this.focused = false;
  }

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  click() { this.listeners.get("click")?.({ currentTarget: this }); }
  dispatch(type, event = {}) { this.listeners.get(type)?.(event); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() { this.focused = true; }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function evidence(stage, index) {
  const option = stage.choices[index % stage.choices.length];
  return createEvidence({
    islandId: "mountain",
    stageId: stage.id,
    optionId: option.id,
    optionText: option.text,
    target: option.target ?? "self",
    summary: option.summary ?? `中性摘要 ${index}`,
    signals: option.signals ?? [{ dimension: "communication", value: "calm", weight: 2 }],
    contextTags: ["mountain"],
    pressure: "medium",
    answeredAt: 1000 + index,
  });
}

function completeStorage() {
  const storage = memoryStorage();
  saveTravelerProfile(storage, createTravelerProfile({
    nickname: "小雾", message: "去看看答案", mbtiType: "INFJ", choiceId: "B",
    analysis: "礼貌接收帮助，同时保持自己的节奏与边界",
  }, 500));
  saveMountainProgress(storage, {
    ...createMountainProgress("girl"),
    officialEvidence: MOUNTAIN_STAGES.filter(({ recordsEvidence }) => recordsEvidence)
      .map(evidence),
    completed: true,
    firstCompletedAt: 2000,
    completedAt: 2000,
  });
  return storage;
}

const validResult = {
  virtualMatchName: "云舟",
  icebreaker: "你们在暴雨和计划变化中仍愿意先确认彼此感受，再一起寻找安全的下一步。".repeat(6).slice(0, 180),
};

function fixture({ storage = completeStorage(), requestIcebreakerFn } = {}) {
  const elements = Object.fromEntries([
    "button", "buttonLabel", "dialog", "status", "matchName", "text", "retryButton", "closeButton",
  ].map((name) => [name, new FakeElement()]));
  elements.button.hidden = true;
  elements.retryButton.hidden = true;
  const feature = createIcebreakerFeature({
    characterId: "girl", elements, storage, requestIcebreakerFn,
  });
  return { feature, elements, storage };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test("未完成爬山岛时隐藏破冰入口", () => {
  const { feature, elements } = fixture({ storage: memoryStorage() });
  assert.equal(feature.refresh(), null);
  assert.equal(elements.button.hidden, true);
  feature.dispose();
});

test("七组证据完整后显示生成入口", () => {
  const { feature, elements } = fixture();
  feature.refresh();
  assert.equal(elements.button.hidden, false);
  assert.equal(elements.buttonLabel.textContent, "生成破冰话术");
  feature.dispose();
});

test("有效缓存直接展示且不请求服务", () => {
  let requests = 0;
  const { feature, elements, storage } = fixture({
    requestIcebreakerFn: async () => { requests += 1; },
  });
  const context = feature.refresh();
  saveIcebreakerCache(storage, context.signature, validResult, 3000);
  feature.refresh();
  elements.button.click();
  assert.equal(requests, 0);
  assert.equal(elements.dialog.open, true);
  assert.equal(elements.matchName.textContent, "为你推演：云舟");
  feature.dispose();
});

test("首次生成会请求服务并缓存结果", async () => {
  let request;
  const { feature, elements } = fixture({
    requestIcebreakerFn: async (value) => { request = value; return validResult; },
  });
  feature.refresh();
  elements.button.click();
  await flushPromises();
  assert.equal(request.evidence.length, 7);
  assert.equal(elements.buttonLabel.textContent, "查看破冰话术");
  assert.match(elements.status.textContent, /已经生成/);
  feature.dispose();
});

test("请求失败后保留重试入口", async () => {
  let attempts = 0;
  const { feature, elements } = fixture({
    requestIcebreakerFn: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("破冰生成服务暂时不可用");
      return validResult;
    },
  });
  feature.refresh();
  elements.button.click();
  await flushPromises();
  assert.match(elements.status.textContent, /暂时不可用/);
  assert.equal(elements.retryButton.hidden, false);
  elements.retryButton.click();
  await flushPromises();
  assert.equal(attempts, 2);
  assert.equal(elements.retryButton.hidden, true);
  feature.dispose();
});

test("加载期间连续点击只发起一次请求", async () => {
  let requests = 0;
  let resolveRequest;
  const { feature, elements } = fixture({
    requestIcebreakerFn: () => {
      requests += 1;
      return new Promise((resolve) => { resolveRequest = resolve; });
    },
  });
  feature.refresh();
  elements.button.click();
  elements.button.click();
  assert.equal(requests, 1);
  resolveRequest(validResult);
  await flushPromises();
  feature.dispose();
});

test("关闭后终止请求并忽略过期结果，且恢复入口焦点", async () => {
  let resolveRequest;
  let signal;
  const { feature, elements } = fixture({
    requestIcebreakerFn: (_request, options) => {
      signal = options.signal;
      return new Promise((resolve) => { resolveRequest = resolve; });
    },
  });
  feature.refresh();
  elements.button.click();
  elements.closeButton.click();
  assert.equal(signal.aborted, true);
  assert.equal(elements.dialog.open, false);
  assert.equal(elements.button.focused, true);
  resolveRequest(validResult);
  await flushPromises();
  assert.equal(elements.matchName.textContent, "");
  feature.dispose();
});

test("原生取消事件终止请求并忽略过期结果", async () => {
  let resolveRequest;
  let signal;
  const { feature, elements, storage } = fixture({
    requestIcebreakerFn: (_request, options) => {
      signal = options.signal;
      return new Promise((resolve) => { resolveRequest = resolve; });
    },
  });
  const context = feature.refresh();
  elements.button.click();
  let defaultPrevented = false;
  elements.dialog.dispatch("cancel", {
    preventDefault() { defaultPrevented = true; },
  });
  assert.equal(defaultPrevented, true);
  assert.equal(signal.aborted, true);
  resolveRequest(validResult);
  await flushPromises();
  assert.equal(elements.matchName.textContent, "");
  assert.equal(loadIcebreakerCache(storage, context.signature), null);
  feature.dispose();
});

test("销毁时解绑事件并清理进行中的 AbortController", () => {
  let signal;
  const { feature, elements } = fixture({
    requestIcebreakerFn: (_request, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  assert.equal(elements.dialog.listeners.has("cancel"), true);
  feature.refresh();
  elements.button.click();
  feature.dispose();
  assert.equal(signal.aborted, true);
  assert.equal(elements.button.listeners.has("click"), false);
  assert.equal(elements.retryButton.listeners.has("click"), false);
  assert.equal(elements.closeButton.listeners.has("click"), false);
  assert.equal(elements.dialog.listeners.has("cancel"), false);
});
