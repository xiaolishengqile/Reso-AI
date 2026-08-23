import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence, normalizeTravelerEvidence } from "../src/profile/evidence.js";
import {
  createPartnerPreferences,
  loadPartnerPreferences,
  savePartnerPreferences,
} from "../src/profile/partnerPreferences.js";
import { collectOfficialEvidence, generateLocalPortrait } from "../src/profile/portrait.js";
import {
  createTravelerProfile,
  loadTravelerProfile,
  saveTravelerProfile,
} from "../src/profile/travelerProfile.js";
import { createMountainProgress, saveMountainProgress } from "../src/scenes/mountain/progress.js";
import { MOUNTAIN_STAGES } from "../src/scenes/mountain/storyContent.js";
import { getAllStories } from "../src/scenes/story/catalog.js";
import {
  createStoryProgress,
  loadStoryProgress,
  saveStoryProgress,
} from "../src/scenes/story/progress.js";
import { createWishScene } from "../src/scenes/wish/createWishScene.js";

class FakeElement {
  constructor() {
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.className = "";
    this.value = "";
    this.checked = false;
    this.listeners = new Map();
    this.attributes = new Map();
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  click() { this.listeners.get("click")?.({ currentTarget: this }); }
  submit() { this.listeners.get("submit")?.({ preventDefault() {} }); }
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

function completeStorage({ withPreferences = true } = {}) {
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
  if (withPreferences) {
    savePartnerPreferences(storage, createPartnerPreferences({
      characterId: "girl",
      city: "杭州",
      minAge: 25,
      maxAge: 32,
      relationshipGoal: "steady",
      distancePreference: "same-city",
      priorities: ["stable-work", "financially-independent", "no-smoking"],
      note: "遇到问题愿意沟通",
    }, 4000));
  }
  return storage;
}

function portraitSource(storage) {
  const profile = loadTravelerProfile(storage);
  const storyProgress = Object.fromEntries(getAllStories().map((story) => [
    story.id,
    loadStoryProgress(storage, "girl", story.id, story.initialStageId),
  ]));
  return {
    profile,
    evidence: collectOfficialEvidence({ storyProgress }),
    baselineEvidence: normalizeTravelerEvidence(profile),
  };
}

function fixture({ storage = completeStorage(), requestPortrait } = {}) {
  const priorityInputs = [
    "stable-work",
    "financially-independent",
    "no-smoking",
    "light-drinking",
    "regular-schedule",
    "family-plan-compatible",
    "responsible",
    "none",
  ].map((value) => {
    const input = new FakeElement();
    input.value = value;
    return input;
  });
  const elements = {
    root: new FakeElement(),
    status: new FakeElement(),
    progress: new FakeElement(),
    summary: new FakeElement(),
    confidence: new FakeElement(),
    result: new FakeElement(),
    retryButton: new FakeElement(),
    editButton: new FakeElement(),
    closeButton: new FakeElement(),
    preferenceForm: new FakeElement(),
    cityInput: new FakeElement(),
    minAgeInput: new FakeElement(),
    maxAgeInput: new FakeElement(),
    relationshipInput: new FakeElement(),
    distanceInput: new FakeElement(),
    priorityInputs,
    noteInput: new FakeElement(),
    formError: new FakeElement(),
  };
  elements.root.hidden = true;
  elements.preferenceForm.hidden = true;
  elements.editButton.hidden = true;
  const scene = createWishScene({
    characterId: "girl",
    elements,
    storage,
    requestPortrait,
    documentTarget: { createElement: () => new FakeElement() },
  });
  return { scene, elements, storage };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test("证据不足时仍可先填写并保存现实期待", async () => {
  let requestCount = 0;
  const { scene, elements, storage } = fixture({
    storage: memoryStorage(),
    requestPortrait: async () => { requestCount += 1; },
  });

  scene.open({ close() {} });
  await flushPromises();

  assert.equal(requestCount, 0);
  assert.equal(elements.preferenceForm.hidden, false);
  assert.match(elements.status.textContent, /现实期待|补充/);
  assert.match(elements.progress.textContent, /0 \/ 42/);

  elements.cityInput.value = "杭州";
  elements.relationshipInput.value = "steady";
  elements.distanceInput.value = "same-city";
  elements.preferenceForm.submit();
  await flushPromises();

  assert.equal(loadPartnerPreferences(storage, "girl").city, "杭州");
  assert.match(elements.status.textContent, /现实期待已保存.*完成.*旅程/);
  assert.equal(elements.preferenceForm.hidden, true);
  assert.equal(elements.retryButton.hidden, true);
  assert.equal(requestCount, 0);
  scene.dispose();
});

test("完整证据首次进入先填写轻量表单，提交后融合生成异性画像", async () => {
  const { scene, elements, storage } = fixture({
    storage: completeStorage({ withPreferences: false }),
  });

  scene.open({ close() {} });
  await flushPromises();

  assert.equal(elements.preferenceForm.hidden, false);
  assert.equal(elements.result.children.length, 0);
  assert.match(elements.status.textContent, /现实期待|补充/);

  elements.cityInput.value = "杭州";
  elements.minAgeInput.value = "25";
  elements.maxAgeInput.value = "32";
  elements.relationshipInput.value = "steady";
  elements.distanceInput.value = "same-city";
  elements.priorityInputs.slice(0, 3).forEach((input) => { input.checked = true; });
  elements.noteInput.value = "遇到问题愿意沟通";
  elements.preferenceForm.submit();
  await flushPromises();

  assert.equal(elements.preferenceForm.hidden, true);
  assert.match(elements.summary.textContent, /男性/);
  assert.match(elements.summary.textContent, /杭州/);
  assert.equal(elements.result.children.length, 12);
  assert.equal(loadPartnerPreferences(storage, "girl").city, "杭州");
  scene.dispose();
});

test("表单拒绝无效年龄和超过三项现实条件且保留填写内容", async () => {
  const { scene, elements, storage } = fixture({
    storage: completeStorage({ withPreferences: false }),
  });
  scene.open({ close() {} });
  elements.minAgeInput.value = "17";
  elements.maxAgeInput.value = "15";
  elements.relationshipInput.value = "steady";
  elements.distanceInput.value = "same-city";
  elements.priorityInputs.slice(0, 4).forEach((input) => { input.checked = true; });

  elements.preferenceForm.submit();
  await flushPromises();

  assert.equal(elements.preferenceForm.hidden, false);
  assert.match(elements.formError.textContent, /年龄/);
  assert.match(elements.formError.textContent, /三项/);
  assert.equal(elements.minAgeInput.value, "17");
  assert.equal(elements.minAgeInput.attributes.get("aria-invalid"), "true");
  assert.equal(elements.priorityInputs[0].attributes.get("aria-invalid"), "true");
  assert.equal(elements.relationshipInput.attributes.get("aria-invalid"), "false");
  assert.equal(loadPartnerPreferences(storage, "girl"), null);
  scene.dispose();
});

test("完整证据默认在本地生成十二章节画像", async () => {
  const { scene, elements } = fixture();

  scene.open({ close() {} });
  assert.equal(elements.preferenceForm.hidden, false);
  elements.preferenceForm.submit();
  await flushPromises();

  assert.match(elements.status.textContent, /已经生成/);
  assert.match(elements.progress.textContent, /42/);
  assert.match(elements.summary.textContent, /关系|伴侣|相处/);
  assert.equal(elements.result.children.length, 12);
  assert.equal(elements.retryButton.hidden, true);
  scene.dispose();
});

test("已有现实期待再次进入时先带出原内容，提交后生成画像", async () => {
  const { scene, elements } = fixture();

  scene.open({ close() {} });
  assert.equal(elements.preferenceForm.hidden, false);
  assert.equal(elements.cityInput.value, "杭州");
  assert.equal(elements.minAgeInput.value, "25");
  assert.equal(elements.priorityInputs[0].checked, true);
  assert.equal(elements.result.children.length, 0);

  elements.preferenceForm.submit();
  await flushPromises();

  assert.equal(elements.preferenceForm.hidden, true);
  assert.equal(elements.editButton.hidden, false);
  assert.equal(elements.result.children.length, 12);
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
  elements.preferenceForm.submit();
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
  elements.preferenceForm.submit();
  await flushPromises();

  assert.match(elements.status.textContent, /未通过安全校验.*本地安全画像/);
  assert.equal(elements.result.children.length, 12);
  scene.dispose();
});

test("远程结果使用旧现实期待时回退到当前期待的本地画像", async () => {
  const storage = completeStorage();
  const source = portraitSource(storage);
  const stalePreferences = createPartnerPreferences({
    characterId: "girl",
    city: "上海",
    minAge: 30,
    maxAge: 38,
    relationshipGoal: "marriage",
    distancePreference: "long-term",
    priorities: ["responsible"],
    note: "",
  }, 1000);
  const staleResult = generateLocalPortrait({
    characterId: "girl",
    preferences: stalePreferences,
    ...source,
  });
  const { scene, elements } = fixture({
    storage,
    requestPortrait: async () => staleResult,
  });

  scene.open({ close() {} });
  elements.preferenceForm.submit();
  await flushPromises();

  assert.match(elements.status.textContent, /未通过安全校验.*本地安全画像/);
  assert.match(elements.summary.textContent, /杭州/);
  assert.doesNotMatch(elements.summary.textContent, /上海/);
  scene.dispose();
});

test("关闭结果页只返回地图且异步结果不会再写入页面", async () => {
  let resolveRequest;
  let closed = 0;
  const { scene, elements } = fixture({
    requestPortrait: () => new Promise((resolve) => { resolveRequest = resolve; }),
  });
  scene.open({ close() { closed += 1; } });
  elements.preferenceForm.submit();
  elements.closeButton.click();
  resolveRequest?.({});
  await flushPromises();

  assert.equal(closed, 1);
  assert.equal(elements.root.hidden, true);
  assert.equal(elements.result.children.length, 0);
  scene.dispose();
});
