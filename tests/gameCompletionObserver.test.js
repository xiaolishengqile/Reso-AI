import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game/createGame.js";
import { createMountainScene } from "../src/scenes/mountain/createMountainScene.js";
import {
  advanceMountainProgress,
  createMountainProgress,
  MOUNTAIN_PROGRESS_KEY,
} from "../src/scenes/mountain/progress.js";

function createContext(canvas) {
  const gradient = { addColorStop() {} };
  return new Proxy({
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    setTransform() { canvas.frameScales = []; },
    scale(value) { canvas.frameScales.push(value); },
  }, {
    get(target, key) { return key in target ? target[key] : () => {}; },
  });
}

function createCanvas() {
  const listeners = new Map();
  const canvas = {
    width: 1200,
    height: 800,
    clientWidth: 1200,
    clientHeight: 800,
    classList: { toggle() {} },
    frameScales: [],
    getContext() { return context; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800 }; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    click(x, y) { listeners.get("click")?.({ clientX: x, clientY: y }); },
    setPointerCapture() {},
    releasePointerCapture() {},
  };
  const context = createContext(canvas);
  return canvas;
}

function createWindow() {
  let time = 0;
  let nextFrameId = 1;
  const frames = new Map();
  class FakeImage {
    addEventListener() {}
    removeEventListener() {}
    set src(value) { this.currentSrc = value; }
  }
  return {
    Image: FakeImage,
    devicePixelRatio: 1,
    innerWidth: 1200,
    innerHeight: 800,
    performance: { now: () => time },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(callback) {
      const frameId = nextFrameId++;
      frames.set(frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(frameId) { frames.delete(frameId); },
    step(milliseconds = 16) {
      const entry = frames.entries().next().value;
      if (!entry) return false;
      frames.delete(entry[0]);
      time += milliseconds;
      entry[1](time);
      return true;
    },
  };
}

function createButton() {
  return Object.assign(new EventTarget(), {
    classList: { toggle() {} },
    setAttribute() {},
    hidden: true,
    textContent: "",
  });
}

function createDialog() {
  return {
    open: false,
    style: { setProperty() {} },
    showModal() { this.open = true; },
    close() { this.open = false; },
    setAttribute(name) { if (name === "open") this.open = true; },
    removeAttribute(name) { if (name === "open") this.open = false; },
  };
}

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.textContent = "";
  }

  addEventListener(type, listener) {
    this.listeners ??= new Map();
    this.listeners.set(type, listener);
  }

  removeEventListener(type) { this.listeners?.delete(type); }

  click() {
    this.listeners?.get("click")?.({ currentTarget: this, target: this });
  }
  load() {}
  pause() {}
  play() { return Promise.resolve(); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, value); }
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function createMountainController(windowTarget) {
  const elements = {
    root: new FakeElement(),
    video: new FakeElement(),
    image: new FakeElement(),
    panel: new FakeElement(),
    mediaControls: new FakeElement(),
    title: new FakeElement(),
    text: new FakeElement(),
    choices: new FakeElement(),
    continueButton: new FakeElement(),
    closeButton: new FakeElement(),
    startButton: new FakeElement(),
    playButton: new FakeElement(),
    speedButton: new FakeElement(),
    skipButton: new FakeElement(),
    saveWarning: new FakeElement(),
    progress: new FakeElement(),
  };
  const completedProgress = advanceMountainProgress(
    createMountainProgress("girl"),
    "complete",
  );
  const storage = createMemoryStorage({
    [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(completedProgress),
  });
  return {
    elements,
    scene: createMountainScene({
      characterId: "girl",
      elements,
      storage,
      documentTarget: { createElement: () => new FakeElement() },
      windowTarget,
    }),
  };
}

function createFixture(onSceneComplete) {
  const canvas = createCanvas();
  const windowTarget = createWindow();
  const status = { textContent: "" };
  const mountain = createMountainController(windowTarget);
  const game = createGame({
    canvas,
    characterId: "girl",
    windowTarget,
    initialUnlockedOrder: 1,
    ui: {
      legendItems: [],
      status,
      overviewButton: createButton(),
      dialog: createDialog(),
      dialogTitle: { textContent: "" },
      dialogLabel: { textContent: "" },
      dialogDescription: { textContent: "" },
      primaryButton: createButton(),
      closeButton: createButton(),
    },
    onSceneComplete,
    onEnterScene(scene, callbacks) {
      if (scene.id === "mountain") mountain.scene.open(callbacks);
    },
  });
  game.start();
  return { game, mountain, status };
}

function openCompletedMountain(fixture) {
  assert.equal(fixture.game.enterScene({ id: "mountain" }), true);
  fixture.mountain.elements.startButton.click();
  assert.equal(fixture.mountain.elements.continueButton.hidden, false);
}

test("关闭真实爬山场景不会通知完成观察者", () => {
  const completed = [];
  const fixture = createFixture((scene) => completed.push(scene.id));

  assert.equal(fixture.game.enterScene({ id: "mountain" }), true);
  fixture.mountain.elements.closeButton.click();

  assert.deepEqual(completed, []);
  assert.equal(fixture.mountain.elements.root.hidden, true);
  fixture.game.dispose();
  fixture.mountain.scene.dispose();
});

test("真实爬山完成后更新地图并且仅通知观察者一次", () => {
  const completed = [];
  const fixture = createFixture((scene) => {
    assert.match(fixture.status.textContent, /桥已解锁|爬山已完成/);
    completed.push(scene.id);
  });

  openCompletedMountain(fixture);
  fixture.mountain.elements.continueButton.click();
  fixture.mountain.elements.continueButton.click();

  assert.deepEqual(completed, ["mountain"]);
  assert.match(fixture.status.textContent, /桥已解锁|爬山已完成/);
  assert.equal(fixture.mountain.elements.root.hidden, true);
  fixture.game.dispose();
  fixture.mountain.scene.dispose();
});

test("完成观察者抛错后真实爬山场景仍会完成并返回地图", () => {
  const fixture = createFixture(() => {
    throw new Error("observer failed");
  });

  openCompletedMountain(fixture);
  assert.doesNotThrow(() => fixture.mountain.elements.continueButton.click());

  assert.equal(fixture.mountain.elements.root.hidden, true);
  assert.match(fixture.status.textContent, /桥已解锁|爬山已完成/);
  fixture.game.dispose();
  fixture.mountain.scene.dispose();
});
