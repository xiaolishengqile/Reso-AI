import test from "node:test";
import assert from "node:assert/strict";
import {
  drawHomeFrame,
  resolveHomeFrameState,
} from "../src/scenes/home/homeRenderer.js";

function createRecordingContext() {
  const calls = [];
  const gradient = { addColorStop(...args) { calls.push(["addColorStop", ...args]); } };
  return {
    calls,
    context: new Proxy({
      createLinearGradient(...args) {
        calls.push(["createLinearGradient", ...args]);
        return gradient;
      },
    }, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => calls.push([key, ...args]);
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    }),
  };
}

test("雾谷阶段会映射玩家、老人、雾气和镜头焦点", () => {
  assert.deepEqual(resolveHomeFrameState("arrival"), {
    scene: "fog-valley",
    playerAction: "walking",
    elderAction: "seated",
    fogStrength: 0.45,
    focus: "road",
  });
  assert.equal(resolveHomeFrameState("elder-intro").elderAction, "calling");
  assert.equal(resolveHomeFrameState("traveler-record").focus, "record");
  assert.equal(resolveHomeFrameState("elder-response", "A").elderAction, "offering-tea");
  assert.equal(resolveHomeFrameState("elder-response", "C").elderAction, "giving-map");
});

test("雾谷画面会绘制清晨、道路、旧桥、小屋、老人和玩家", () => {
  const recording = createRecordingContext();
  drawHomeFrame(recording.context, {
    width: 1000,
    height: 700,
    elapsedSeconds: 1,
    characterId: "girl",
    ...resolveHomeFrameState("elder-intro"),
  });

  const operationNames = new Set(recording.calls.map(([name]) => name));
  for (const required of ["fillRect", "bezierCurveTo", "ellipse", "arc", "stroke", "fillText"]) {
    assert.equal(operationNames.has(required), true, `缺少绘制操作：${required}`);
  }
});
