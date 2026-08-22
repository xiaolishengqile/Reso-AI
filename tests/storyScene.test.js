import test from "node:test";
import assert from "node:assert/strict";
import { createStoryScene } from "../src/scenes/story/createStoryScene.js";
import { getStoryFrameState } from "../src/scenes/story/storyRenderer.js";
import { createChoice } from "../src/scenes/story/story.js";
import {
  advanceStoryProgress,
  completeStoryProgress,
  createStoryProgress,
  saveStoryProgress,
} from "../src/scenes/story/progress.js";

class FakeElement {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.attributes = new Map();
    this.listeners = new Map();
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  click() {
    this.listeners.get("click")?.({ currentTarget: this });
  }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function story() {
  const ids = ["one", "two", "three", "four", "five", "six"];
  return {
    id: "office",
    title: "工作岛",
    unlockOrder: 2,
    unlocksOrder: 3,
    initialStageId: "one",
    theme: { sky: "#9ccad1", ground: "#526a67", accent: "#f0c98d", prop: "office" },
    contextTags: ["工作"],
    stages: [
      ...ids.map((id, index) => ({
        id,
        kind: "choice",
        title: `阶段${index + 1}`,
        narration: index === 0 ? "{companion}在等你。" : "上一段选择带来了新的情况。",
        prompt: "现在怎么办？",
        recordsEvidence: true,
        pressure: "medium",
        nextStageId: ids[index + 1] ?? "complete",
        choices: ["a", "b", "c"].map((choiceId) => createChoice(
          choiceId,
          `选择${choiceId}`,
          "对应的局部反馈让下一件事自然发生。",
          {
            target: "self",
            summary: "中性摘要",
            signals: [{ dimension: "communication", value: choiceId, weight: 1 }],
            companionMood: "安心",
          },
        )),
      })),
      {
        id: "complete",
        kind: "complete",
        title: "工作岛尾声",
        narration: "你们约好一起吃顿晚饭。",
        prompt: "",
        recordsEvidence: false,
        nextStageId: null,
        choices: [],
      },
    ],
  };
}

function fixture(storage = memoryStorage(), options = {}) {
  const elements = {
    root: new FakeElement(),
    canvas: options.canvas ?? null,
    progress: new FakeElement(),
    title: new FakeElement(),
    text: new FakeElement(),
    choices: new FakeElement(),
    continueButton: new FakeElement(),
    closeButton: new FakeElement(),
    saveWarning: new FakeElement(),
  };
  const scene = createStoryScene({
    characterId: "boy",
    elements,
    storage,
    documentTarget: { createElement: () => new FakeElement() },
    windowTarget: { performance: { now: () => 500 }, addEventListener() {}, removeEventListener() {} },
    drawFrame: options.drawFrame,
  });
  return { elements, scene, storage };
}

test("选择后先展示局部反馈，再进入下一阶段", () => {
  const currentStory = story();
  const { elements, scene } = fixture();
  scene.open(currentStory, { complete() {}, close() {} });

  assert.match(elements.text.textContent, /她在等你/);
  elements.choices.children[0].click();
  assert.match(elements.text.textContent, /对应的局部反馈/);
  assert.equal(elements.continueButton.hidden, false);
  elements.continueButton.click();
  assert.equal(elements.title.textContent, "阶段2");
  scene.dispose();
});

test("刷新后恢复已保存阶段", () => {
  const currentStory = story();
  const storage = memoryStorage();
  saveStoryProgress(storage, advanceStoryProgress(
    createStoryProgress("boy", "office", "one"),
    "three",
  ));
  const { elements, scene } = fixture(storage);

  scene.open(currentStory, { complete() {}, close() {} });
  assert.equal(elements.title.textContent, "阶段3");
  scene.dispose();
});

test("重玩已完成剧情时不会把上一轮结尾情绪带回序幕", () => {
  const storage = memoryStorage();
  saveStoryProgress(storage, {
    ...completeStoryProgress(createStoryProgress("boy", "office", "one"), 1000),
    companionMood: "疏离",
  });
  const frames = [];
  const canvas = {
    width: 600,
    height: 400,
    clientWidth: 600,
    clientHeight: 400,
    getContext() { return { setTransform() {} }; },
    getBoundingClientRect() { return { width: 600, height: 400 }; },
  };
  const { scene } = fixture(storage, {
    canvas,
    drawFrame(_context, frame) { frames.push(frame); },
  });

  scene.open(story(), { complete() {}, close() {} });

  assert.equal(frames.at(-1).companionMood, "");
  scene.dispose();
});

test("完成六组选择后只通知地图一次", () => {
  const currentStory = story();
  const { elements, scene } = fixture();
  let completed = 0;
  scene.open(currentStory, { complete() { completed += 1; }, close() {} });

  for (let index = 0; index < 6; index += 1) {
    elements.choices.children[0].click();
    elements.continueButton.click();
  }
  assert.equal(elements.title.textContent, "工作岛尾声");
  elements.continueButton.click();
  elements.continueButton.click();
  assert.equal(completed, 1);
  scene.dispose();
});

test("完成存档失败时不解锁，允许原地重试", () => {
  let allowCompletion = false;
  const base = memoryStorage();
  const storage = {
    getItem: base.getItem,
    setItem(key, value) {
      const parsed = JSON.parse(value);
      if (parsed.players?.boy?.office?.completed && !allowCompletion) throw new Error("quota");
      base.setItem(key, value);
    },
  };
  const { elements, scene } = fixture(storage);
  let completed = 0;
  scene.open(story(), { complete() { completed += 1; }, close() {} });
  for (let index = 0; index < 6; index += 1) {
    elements.choices.children[0].click();
    elements.continueButton.click();
  }

  elements.continueButton.click();
  assert.equal(completed, 0);
  assert.equal(elements.root.hidden, false);
  assert.equal(elements.saveWarning.hidden, false);
  assert.equal(elements.continueButton.disabled, false);

  allowCompletion = true;
  elements.continueButton.click();
  assert.equal(completed, 1);
  assert.equal(elements.root.hidden, true);
  scene.dispose();
});

test("关闭剧情只通知返回而不完成", () => {
  const { elements, scene } = fixture();
  let closed = 0;
  let completed = 0;
  scene.open(story(), { close() { closed += 1; }, complete() { completed += 1; } });
  elements.closeButton.click();
  assert.equal(closed, 1);
  assert.equal(completed, 0);
  scene.dispose();
});

test("画面状态根据主题和伴侣情绪调整双方距离", () => {
  const calm = getStoryFrameState(story(), story().stages[0], "安心");
  const distant = getStoryFrameState(story(), story().stages[0], "疏离");
  assert.equal(calm.prop, "office");
  assert.ok(distant.companionX > calm.companionX);
});
