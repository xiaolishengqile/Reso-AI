import test from "node:test";
import assert from "node:assert/strict";
import { LOCATIONS, MAP_SIZE } from "../src/config/world.js";
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

test("外部场景完成后更新地图并通知可选观察者", () => {
  const canvas = createCanvas();
  const windowTarget = createWindow();
  const status = { textContent: "" };
  const dialog = createDialog();
  const primaryButton = createButton();
  const completed = [];
  let sceneCallbacks;
  const game = createGame({
    canvas,
    characterId: "girl",
    windowTarget,
    initialUnlockedOrder: 1,
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
    onSceneComplete(scene) {
      assert.match(status.textContent, /桥已解锁|爬山已完成/);
      completed.push(scene.id);
    },
    onEnterScene(scene, callbacks) {
      if (scene.id === "mountain") sceneCallbacks = callbacks;
    },
  });
  game.start();
  const mountain = LOCATIONS.find(({ id }) => id === "mountain");
  const screenPoint = overviewScreenPoint(mountain);
  canvas.click(screenPoint.x, screenPoint.y);
  for (let frame = 0; frame < 600 && !dialog.open; frame += 1) windowTarget.step();
  primaryButton.dispatchEvent(new Event("click"));
  assert.ok(sceneCallbacks);
  sceneCallbacks.complete();
  assert.deepEqual(completed, ["mountain"]);
  assert.match(status.textContent, /桥已解锁|爬山已完成/);
  game.dispose();
});
