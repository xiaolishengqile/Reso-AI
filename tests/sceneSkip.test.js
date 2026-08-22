import test from "node:test";
import assert from "node:assert/strict";

const sceneSkipModule = await import("../src/app/sceneSkip.js").catch(() => ({}));
const createSceneSkip = sceneSkipModule.createSceneSkip ?? (() => null);

class FakeButton {
  constructor() {
    this.disabled = false;
    this.hidden = true;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  click() {
    if (!this.disabled) this.listeners.get("click")?.();
  }
}

test("全局跳过按钮只把点击交给当前剧情控制器", () => {
  const button = new FakeButton();
  const sceneSkip = createSceneSkip({ button });
  let skipped = 0;
  let closed = 0;
  const controller = {
    skipCurrentSegment() {
      skipped += 1;
      return true;
    },
  };

  assert.ok(sceneSkip);
  sceneSkip.show();
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, true);

  const callbacks = sceneSkip.activate(controller, {
    close() { closed += 1; },
  });
  assert.equal(button.disabled, false);
  button.click();
  assert.equal(skipped, 1);

  callbacks.close();
  assert.equal(closed, 1);
  assert.equal(button.disabled, true);
  button.click();
  assert.equal(skipped, 1);
  sceneSkip.dispose();
});

test("不支持跳过的岛屿仍显示按钮但保持不可用", () => {
  const button = new FakeButton();
  const sceneSkip = createSceneSkip({ button });

  sceneSkip.show();
  sceneSkip.activate({}, {});

  assert.equal(button.hidden, false);
  assert.equal(button.disabled, true);
  sceneSkip.dispose();
});
