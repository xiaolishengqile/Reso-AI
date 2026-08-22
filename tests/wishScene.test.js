import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import { generateLocalPortrait } from "../src/profile/portrait.js";
import { createTravelerProfile, saveTravelerProfile } from "../src/profile/travelerProfile.js";
import { createMountainProgress, saveMountainProgress } from "../src/scenes/mountain/progress.js";
import { MOUNTAIN_STAGES } from "../src/scenes/mountain/storyContent.js";
import { getAllStories } from "../src/scenes/story/catalog.js";
import { createStoryProgress, saveStoryProgress } from "../src/scenes/story/progress.js";
import { createWishScene } from "../src/scenes/wish/createWishScene.js";

class FakeElement {
  constructor() {
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.className = "";
    this.listeners = new Map();
    this.attributes = new Map();
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  click() { this.listeners.get("click")?.({ currentTarget: this }); }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function makeEvidence(islandId, stage, index) {
  const option = stage.choices[index % stage.choices.length];
  return createEvidence({
    islandId,
    stageId: stage.id,
    optionId: option.id,
    optionText: option.text,
    target: option.target ?? "self",
    summary: option.summary ?? `${islandId}的关系偏好 ${index}`,
    signals: option.signals ?? [{ dimension: "communication", value: index % 2 ? "direct" : "calm", weight: 2 }],
    contextTags: [islandId],
    pressure: "medium",
    answeredAt: 1000 + index,
  });
}

function completeStorage() {
  const storage = memoryStorage();
  saveTravelerProfile(storage, createTravelerProfile({
    nickname: "小雾",
    message: "去看看答案",
    mbtiType: "INFJ",
    choiceId: "B",
    analysis: "礼貌接收帮助，同时保持自己的节奏与边界",
  }, 500));
  saveMountainProgress(storage, {
    ...createMountainProgress("girl"),
    officialEvidence: MOUNTAIN_STAGES
      .filter(({ recordsEvidence }) => recordsEvidence)
      .map((stage, index) => makeEvidence("mountain", stage, index)),
    completed: true,
    firstCompletedAt: 2000,
    completedAt: 2000,
  });
  for (const story of getAllStories()) {
    saveStoryProgress(storage, {
      ...createStoryProgress("girl", story.id, story.initialStageId),
      officialEvidence: story.stages
        .filter(({ recordsEvidence }) => recordsEvidence)
        .map((stage, index) => makeEvidence(story.id, stage, index)),
      completed: true,
      firstCompletedAt: 3000,
      completedAt: 3000,
    });
  }
  return storage;
}

function fixture({ storage = completeStorage(), requestPortrait } = {}) {
  const elements = {
    root: new FakeElement(),
    status: new FakeElement(),
    progress: new FakeElement(),
    summary: new FakeElement(),
    confidence: new FakeElement(),
    result: new FakeElement(),
    retryButton: new FakeElement(),
    closeButton: new FakeElement(),
  };
  elements.root.hidden = true;
  const scene = createWishScene({
    characterId: "girl",
    elements,
    storage,
    requestPortrait,
    documentTarget: { createElement: () => new FakeElement() },
  });
  return { scene, elements };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test("证据不足时显示缺失岛屿而不请求生成", async () => {
  let requestCount = 0;
  const { scene, elements } = fixture({
    storage: memoryStorage(),
    requestPortrait: async () => { requestCount += 1; },
  });

  scene.open({ close() {} });
  await flushPromises();

  assert.equal(requestCount, 0);
  assert.match(elements.status.textContent, /尚未完成/);
  assert.match(elements.status.textContent, /雾谷/);
  assert.equal(elements.retryButton.hidden, true);
  scene.dispose();
});

test("完整证据默认在本地生成十二章节画像", async () => {
  const { scene, elements } = fixture();

  scene.open({ close() {} });
  await flushPromises();

  assert.match(elements.status.textContent, /已经生成/);
  assert.match(elements.progress.textContent, /42/);
  assert.match(elements.summary.textContent, /关系|伴侣|相处/);
  assert.equal(elements.result.children.length, 12);
  assert.equal(elements.retryButton.hidden, true);
  scene.dispose();
});

test("远程生成失败时保留证据并允许重试", async () => {
  let requestCount = 0;
  const { scene, elements } = fixture({
    requestPortrait: async (request) => {
      requestCount += 1;
      if (requestCount === 1) throw new Error("service unavailable");
      return generateLocalPortrait({
        evidence: Object.values(request.aggregated)
          .flatMap(() => []),
      });
    },
  });

  scene.open({ close() {} });
  await flushPromises();
  assert.match(elements.status.textContent, /证据已保存.*生成失败/);
  assert.equal(elements.retryButton.hidden, false);

  elements.retryButton.click();
  await flushPromises();
  assert.equal(requestCount, 2);
  assert.match(elements.status.textContent, /本地安全画像|已经生成/);
  assert.equal(elements.result.children.length, 12);
  scene.dispose();
});

test("远程结果缺少证据引用时不会渲染坏数据，而会回退本地画像", async () => {
  const { scene, elements } = fixture({
    requestPortrait: async () => ({
      summary: "没有结构的远程结果",
      sections: Array.from({ length: 12 }, () => ({ content: "缺少引用" })),
      confidence: "high",
      generatedAt: 1000,
      generatorVersion: 2,
    }),
  });

  scene.open({ close() {} });
  await flushPromises();

  assert.match(elements.status.textContent, /未通过安全校验.*本地安全画像/);
  assert.equal(elements.result.children.length, 12);
  scene.dispose();
});

test("关闭结果页只返回地图且异步结果不会再写入页面", async () => {
  let resolveRequest;
  let closed = 0;
  const { scene, elements } = fixture({
    requestPortrait: () => new Promise((resolve) => { resolveRequest = resolve; }),
  });
  scene.open({ close() { closed += 1; } });
  elements.closeButton.click();
  resolveRequest?.({});
  await flushPromises();

  assert.equal(closed, 1);
  assert.equal(elements.root.hidden, true);
  assert.equal(elements.result.children.length, 0);
  scene.dispose();
});
