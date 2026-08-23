import test from "node:test";
import assert from "node:assert/strict";
import { createStoryScene } from "../src/scenes/story/createStoryScene.js";
import {
  getStoryFrameState,
  getStoryMapViewport,
} from "../src/scenes/story/storyRenderer.js";
import * as storyRenderer from "../src/scenes/story/storyRenderer.js";
import { createChoice } from "../src/scenes/story/story.js";
import {
  STORY_PROGRESS_KEY,
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
    this.value = "";
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
    this.listeners.get("click")?.({
      currentTarget: this,
      target: this,
      stopPropagation() {},
    });
  }

  closest(selector) {
    return this.type === "button" && selector.includes("button") ? this : null;
  }
}

function createWindow() {
  let time = 500;
  let nextFrameId = 1;
  const frames = new Map();
  class FakeImage {
    constructor() {
      this.complete = true;
      this.naturalWidth = 1536;
      this.naturalHeight = 1024;
    }
    set src(value) { this.currentSrc = value; }
  }
  return {
    Image: FakeImage,
    performance: { now: () => time },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(callback) {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    step(milliseconds = 1600) {
      const entry = frames.entries().next().value;
      if (!entry) return false;
      frames.delete(entry[0]);
      time += milliseconds;
      entry[1](time);
      return true;
    },
  };
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
  const windowTarget = options.windowTarget ?? createWindow();
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
    windowTarget,
    drawFrame: options.drawFrame,
  });
  return { elements, scene, storage, windowTarget };
}

test("入场先自动行走，抵达后按剧情、问题、反馈的顺序推进", () => {
  const currentStory = story();
  const { elements, scene, windowTarget } = fixture();
  scene.open(currentStory, { complete() {}, close() {} });

  assert.equal(elements.root.attributes.get("aria-busy"), "true");
  assert.equal(elements.choices.children.length, 0);
  windowTarget.step();
  assert.match(elements.text.textContent, /她在等你/);
  assert.equal(elements.choices.children.length, 0);
  elements.continueButton.click();
  assert.match(elements.text.textContent, /现在怎么办/);
  assert.equal(elements.choices.children.length, 4);
  elements.choices.children[0].click();
  assert.match(elements.text.textContent, /对应的局部反馈/);
  assert.equal(elements.continueButton.hidden, false);
  elements.continueButton.click();
  assert.equal(elements.root.attributes.get("aria-busy"), "true");
  windowTarget.step();
  assert.equal(elements.title.textContent, "阶段2");
  scene.dispose();
});

test("七岛问题可提交键盘自由回答并把原文保存为画像证据", () => {
  const currentStory = story();
  const storage = memoryStorage();
  const { elements, scene, windowTarget } = fixture(storage);
  scene.open(currentStory, { complete() {}, close() {} });
  windowTarget.step();
  elements.continueButton.click();

  const freeResponse = elements.choices.children[3];
  assert.ok(freeResponse, "七岛问题应显示自由回答入口");
  assert.equal(freeResponse.dataset.freeResponse, "true");
  const input = freeResponse.children[0];
  const submit = freeResponse.children[1].children[1];
  input.value = "  我会先说明加班原因，再一起确认今晚的安排。  ";
  submit.click();

  const saved = JSON.parse(storage.getItem(STORY_PROGRESS_KEY));
  const progress = saved.players.boy.office;
  assert.equal(progress.answers[0].optionId, "free-response");
  assert.equal(progress.officialEvidence[0].optionText, "我会先说明加班原因，再一起确认今晚的安排。");
  assert.match(progress.officialEvidence[0].summary, /我会先说明加班原因/);
  assert.match(elements.text.textContent, /真实想法|认真听/);
  scene.dispose();
});

test("语音输入会转写到自由回答框并允许继续编辑", () => {
  class FakeRecognition {
    static latest = null;

    constructor() {
      FakeRecognition.latest = this;
      this.started = false;
      this.aborted = false;
    }

    start() { this.started = true; }
    abort() { this.aborted = true; }
  }

  const windowTarget = createWindow();
  windowTarget.SpeechRecognition = FakeRecognition;
  const { elements, scene } = fixture(memoryStorage(), { windowTarget });
  scene.open(story(), { complete() {}, close() {} });
  windowTarget.step();
  elements.continueButton.click();

  const freeResponse = elements.choices.children[3];
  assert.ok(freeResponse, "七岛问题应显示自由回答入口");
  const input = freeResponse.children[0];
  const voice = freeResponse.children[1].children[0];
  voice.click();
  assert.equal(FakeRecognition.latest.started, true);

  FakeRecognition.latest.onresult({
    resultIndex: 0,
    results: [{ 0: { transcript: "我希望先听听她的想法" } }],
  });
  assert.equal(input.value, "我希望先听听她的想法");
  input.value += "，再决定。";
  assert.equal(input.value, "我希望先听听她的想法，再决定。");
  scene.dispose();
  assert.equal(FakeRecognition.latest.aborted, true);
});

test("全局剧情跳过逐段越过移动、旁白和反馈，但不会替玩家选择", () => {
  const currentStory = story();
  const { elements, scene } = fixture();
  scene.open(currentStory, { complete() {}, close() {} });

  assert.equal(typeof scene.skipCurrentSegment, "function");
  assert.equal(scene.skipCurrentSegment(), true);
  assert.equal(elements.title.textContent, "阶段1");
  assert.equal(elements.root.dataset.storyPhase, "narration");

  assert.equal(scene.skipCurrentSegment(), true);
  assert.equal(elements.choices.children.length, 4);
  const question = elements.text.textContent;
  assert.equal(scene.skipCurrentSegment(), false);
  assert.equal(elements.text.textContent, question);

  elements.choices.children[0].click();
  assert.equal(scene.skipCurrentSegment(), true);
  assert.equal(elements.root.dataset.storyPhase, "moving");
  assert.equal(scene.skipCurrentSegment(), true);
  assert.equal(elements.title.textContent, "阶段2");
  assert.equal(scene.skipCurrentSegment(), true);
  assert.equal(elements.choices.children.length, 4);
  scene.dispose();
});

test("刷新后恢复已保存阶段", () => {
  const currentStory = story();
  const storage = memoryStorage();
  saveStoryProgress(storage, advanceStoryProgress(
    createStoryProgress("boy", "office", "one"),
    "three",
  ));
  const { elements, scene, windowTarget } = fixture(storage);

  scene.open(currentStory, { complete() {}, close() {} });
  windowTarget.step();
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
  const { scene, windowTarget } = fixture(storage, {
    canvas,
    drawFrame(_context, frame) { frames.push(frame); },
  });

  scene.open(story(), { complete() {}, close() {} });
  windowTarget.step();

  assert.equal(frames.at(-1).companionMood, "");
  scene.dispose();
});

test("完成六组选择后只通知地图一次", () => {
  const currentStory = story();
  const { elements, scene, windowTarget } = fixture();
  let completed = 0;
  scene.open(currentStory, { complete() { completed += 1; }, close() {} });

  for (let index = 0; index < 6; index += 1) {
    windowTarget.step();
    elements.continueButton.click();
    elements.choices.children[0].click();
    elements.continueButton.click();
  }
  windowTarget.step();
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
  const { elements, scene, windowTarget } = fixture(storage);
  let completed = 0;
  scene.open(story(), { complete() { completed += 1; }, close() {} });
  for (let index = 0; index < 6; index += 1) {
    windowTarget.step();
    elements.continueButton.click();
    elements.choices.children[0].click();
    elements.continueButton.click();
  }

  windowTarget.step();

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

test("点击选项不会冒泡成下一次剧情推进", () => {
  const { elements, scene, windowTarget } = fixture();
  scene.open(story(), { complete() {}, close() {} });
  windowTarget.step();
  elements.continueButton.click();

  const option = elements.choices.children[0];
  option.click();
  elements.root.listeners.get("click")?.({ target: option });

  assert.match(elements.text.textContent, /对应的局部反馈/);
  assert.equal(elements.title.textContent, "阶段1");
  scene.dispose();
});

test("画面状态根据主题和伴侣情绪调整双方距离", () => {
  const calm = getStoryFrameState(story(), story().stages[0], "安心");
  const distant = getStoryFrameState(story(), story().stages[0], "疏离");
  assert.equal(calm.prop, "office");
  assert.ok(distant.companionX > calm.companionX);
});

test("连续地图镜头会跟随人物，并在地图两端停住", () => {
  const middle = getStoryMapViewport(0.5);
  const left = getStoryMapViewport(0.07);
  const right = getStoryMapViewport(0.95);

  assert.ok(Math.abs(middle.playerX - 0.5) < 0.001);
  assert.equal(left.sourceX, 0);
  assert.ok(left.playerX < 0.2);
  assert.ok(right.sourceX > 0.4);
  assert.ok(right.playerX > 0.85);
});

test("同行时两人朝前行方向迈步，停下后才转身面对彼此", () => {
  assert.equal(typeof storyRenderer.getStoryCharacterDirections, "function");
  assert.deepEqual(storyRenderer.getStoryCharacterDirections(true), {
    player: { x: 1, z: 0 },
    companion: { x: 1, z: 0 },
  });
  assert.deepEqual(storyRenderer.getStoryCharacterDirections(false), {
    player: { x: 1, z: 0 },
    companion: { x: -1, z: 0 },
  });
});
