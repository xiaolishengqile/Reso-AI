import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../src/game/createGame.js";

function createContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({
    createLinearGradient() { return gradient; },
  }, {
    get(target, key) {
      return key in target ? target[key] : () => {};
    },
  });
}

function createCanvas() {
  const listeners = new Map();
  return {
    width: 1200,
    height: 800,
    clientWidth: 1200,
    clientHeight: 800,
    classList: { toggle() {} },
    getContext() { return createContext(); },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1200, height: 800 };
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    click(x, y) { listeners.get("click")?.({ clientX: x, clientY: y }); },
  };
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

  // 初始全景中爬山岛地标的手工换算屏幕坐标。
  canvas.click(342, 443);
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
