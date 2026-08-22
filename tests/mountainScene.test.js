import test from "node:test";
import assert from "node:assert/strict";
import { createMountainScene } from "../src/scenes/mountain/createMountainScene.js";
import {
  advanceMountainProgress,
  createMountainProgress,
} from "../src/scenes/mountain/progress.js";
import { MOUNTAIN_PROGRESS_KEY } from "../src/scenes/mountain/progress.js";

class FakeElement {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { toggle() {} };
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

  click() {
    this.listeners.get("click")?.({ currentTarget: this });
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
}

function createMemoryStorage(initial = {}) {
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

function createSceneFixture(storage = createMemoryStorage()) {
  const elements = {
    root: new FakeElement(),
    canvas: null,
    title: new FakeElement(),
    text: new FakeElement(),
    choices: new FakeElement(),
    continueButton: new FakeElement(),
    closeButton: new FakeElement(),
    saveWarning: new FakeElement(),
    progress: new FakeElement(),
  };
  const scene = createMountainScene({
    characterId: "boy",
    elements,
    storage,
    documentTarget: { createElement: () => new FakeElement() },
  });
  return { elements, scene, storage };
}

test("打开剧情会恢复到保存的阶段并匹配异性同行者", () => {
  const progress = advanceMountainProgress(createMountainProgress("boy"), "fatigue");
  const fixture = createSceneFixture(createMemoryStorage({
    [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(progress),
  }));

  fixture.scene.open({ complete() {}, close() {} });

  assert.equal(fixture.elements.title.textContent, "疲惫与抱怨");
  assert.match(fixture.elements.text.textContent, /她/);
  fixture.scene.dispose();
});

test("画像选择只记录一次证据并进入下一阶段", () => {
  const fixture = createSceneFixture();
  fixture.scene.open({ complete() {}, close() {} });

  assert.equal(fixture.elements.choices.children.length, 3);
  const firstOption = fixture.elements.choices.children[0];
  firstOption.click();
  firstOption.click();

  const progress = JSON.parse(fixture.storage.getItem(MOUNTAIN_PROGRESS_KEY));
  assert.equal(progress.officialEvidence.length, 1);
  assert.equal(progress.currentStageId, "fatigue");
  fixture.scene.dispose();
});

test("暴雨行动只保存行动决定，不生成画像证据", () => {
  const progress = advanceMountainProgress(
    createMountainProgress("boy"),
    "storm-action",
  );
  const fixture = createSceneFixture(createMemoryStorage({
    [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(progress),
  }));
  fixture.scene.open({ complete() {}, close() {} });

  fixture.elements.choices.children[0].click();

  const saved = JSON.parse(fixture.storage.getItem(MOUNTAIN_PROGRESS_KEY));
  assert.equal(saved.actionId, "summit");
  assert.equal(saved.officialEvidence.length, 0);
  assert.equal(saved.currentStageId, "cave-repair");
  fixture.scene.dispose();
});

test("完成阶段只通知世界地图一次", () => {
  const progress = advanceMountainProgress(createMountainProgress("boy"), "complete");
  const fixture = createSceneFixture(createMemoryStorage({
    [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(progress),
  }));
  let completed = 0;
  fixture.scene.open({ complete() { completed += 1; }, close() {} });

  fixture.elements.continueButton.click();
  fixture.elements.continueButton.click();

  assert.equal(completed, 1);
  fixture.scene.dispose();
});
