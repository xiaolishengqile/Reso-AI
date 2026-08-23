import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCATIONS,
  MAP_SIZE,
  WORLD_DECORATIONS,
} from "../src/config/world.js";
import { createGame } from "../src/game/createGame.js";

function overviewScreenPoint(point) {
  const scale = Math.min(1200 / MAP_SIZE.width, 800 / MAP_SIZE.height);
  return {
    x: point.x * scale + (1200 - MAP_SIZE.width * scale) / 2,
    y: point.z * scale + (800 - MAP_SIZE.height * scale) / 2,
  };
}

function createContext(canvas) {
  const gradient = { addColorStop() {} };
  return new Proxy({
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    setTransform() { canvas.frameScales = []; },
    scale(x) {
      canvas.frameScales.push(x);
      if (canvas.frameScales.length === 1) canvas.worldScale = x;
    },
  }, {
    get(target, key) {
      return key in target ? target[key] : () => {};
    },
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
    worldScale: 0,
    getContext() { return context; },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1200, height: 800 };
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    click(x, y) { listeners.get("click")?.({ clientX: x, clientY: y }); },
    pointer(type, x, y, pointerId = 1) {
      listeners.get(type)?.({
        clientX: x,
        clientY: y,
        pointerId,
        preventDefault() {},
      });
    },
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

test("抵达爬山岛后先显示入口，确认后才进入剧情", () => {
  const canvas = createCanvas();
  const windowTarget = createWindow();
  const status = { textContent: "" };
  const dialog = createDialog();
  const primaryButton = createButton();
  let openedScene = null;
  const game = createGame({
    canvas,
    characterId: "girl",
    windowTarget,
    ui: {
      legendItems: [],
      status,
      overviewButton: createButton(),
      dialog,
      dialogTitle: { textContent: "" },
      dialogLabel: { textContent: "" },
      dialogDescription: { textContent: "" },
      primaryButton,
      closeButton: createButton(),
    },
    onEnterScene(scene) { openedScene = scene; },
  });
  game.start();

  const mountain = LOCATIONS.find(({ id }) => id === "mountain");
  const mountainScreenPoint = overviewScreenPoint(mountain);
  canvas.click(mountainScreenPoint.x, mountainScreenPoint.y);
  assert.match(status.textContent, /正在前往「爬山岛」/);
  for (let frame = 0; frame < 600 && !dialog.open; frame += 1) {
    windowTarget.step();
  }

  assert.equal(openedScene, null);
  assert.equal(dialog.open, true, status.textContent);
  assert.equal(primaryButton.textContent, "进入爬山剧情");
  primaryButton.dispatchEvent(new Event("click"));
  assert.equal(openedScene?.id, "mountain", status.textContent);
  assert.equal(dialog.open, false);
  game.dispose();
});

test("走近老人后自动触发雾谷序章且离开剧情后不会重复触发", () => {
  const canvas = createCanvas();
  const windowTarget = createWindow();
  const status = { textContent: "" };
  let openedCount = 0;
  let sceneCallbacks = null;
  const game = createGame({
    canvas,
    characterId: "girl",
    windowTarget,
    proximityScene: { id: "home", entryMode: "external" },
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
    onEnterScene(scene, callbacks) {
      openedCount += 1;
      sceneCallbacks = callbacks;
      assert.equal(scene.id, "home");
    },
  });
  game.start();

  for (let frame = 0; frame < 10; frame += 1) windowTarget.step();
  assert.equal(openedCount, 0);
  assert.match(status.textContent, /走近.*老人/);

  const elder = WORLD_DECORATIONS.find(({ id }) => id === "fog-valley-elder");
  const elderScreenPoint = overviewScreenPoint(elder);
  canvas.click(elderScreenPoint.x, elderScreenPoint.y);
  for (let frame = 0; frame < 300 && openedCount === 0; frame += 1) {
    windowTarget.step();
  }
  assert.equal(openedCount, 1);

  sceneCallbacks.close();
  for (let frame = 0; frame < 30; frame += 1) windowTarget.step();
  assert.equal(openedCount, 1);
  game.dispose();
});

test("序章待触发时点击雾谷地标会先走向老人而不是立即开场", () => {
  const canvas = createCanvas();
  const windowTarget = createWindow();
  let openedCount = 0;
  const game = createGame({
    canvas,
    characterId: "girl",
    windowTarget,
    proximityScene: { id: "home", entryMode: "external" },
    ui: {
      legendItems: [],
      status: { textContent: "" },
      overviewButton: createButton(),
      dialog: createDialog(),
      dialogTitle: { textContent: "" },
      dialogLabel: { textContent: "" },
      dialogDescription: { textContent: "" },
      primaryButton: createButton(),
      closeButton: createButton(),
    },
    onEnterScene() { openedCount += 1; },
  });
  game.start();
  windowTarget.step();

  const home = LOCATIONS.find(({ id }) => id === "home");
  const homeScreenPoint = overviewScreenPoint(home);
  canvas.click(homeScreenPoint.x, homeScreenPoint.y);
  assert.equal(openedCount, 0);
  for (let frame = 0; frame < 300 && openedCount === 0; frame += 1) {
    windowTarget.step();
  }
  assert.equal(openedCount, 1);
  game.dispose();
});

test("拖动云海只平移地图，不会误触地点或移动人物", () => {
  const canvas = createCanvas();
  const windowTarget = createWindow();
  const status = { textContent: "" };
  let openedCount = 0;
  const overviewButton = createButton();
  const game = createGame({
    canvas,
    characterId: "girl",
    windowTarget,
    ui: {
      legendItems: [],
      status,
      overviewButton,
      dialog: createDialog(),
      dialogTitle: { textContent: "" },
      dialogLabel: { textContent: "" },
      dialogDescription: { textContent: "" },
      primaryButton: createButton(),
      closeButton: createButton(),
    },
    onEnterScene() { openedCount += 1; },
  });
  game.start();
  windowTarget.step(1400);
  overviewButton.dispatchEvent(new Event("click"));
  for (let frame = 0; frame < 120; frame += 1) windowTarget.step();
  const overviewScale = canvas.worldScale;

  canvas.pointer("pointerdown", 20, 20);
  canvas.pointer("pointermove", 180, 120);
  windowTarget.step();
  canvas.pointer("pointerup", 180, 120);
  canvas.click(180, 120);
  for (let frame = 0; frame < 30; frame += 1) windowTarget.step();

  assert.equal(openedCount, 0);
  assert.ok(canvas.worldScale > overviewScale);
  assert.doesNotMatch(status.textContent, /正在前往|沿着地图/);
  game.dispose();
});
