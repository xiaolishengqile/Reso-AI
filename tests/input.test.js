import test from "node:test";
import assert from "node:assert/strict";
import { createInput } from "../src/systems/createInput.js";

function keyboardEvent(type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "code", { value: code });
  return event;
}

test("键盘按下和抬起会更新移动方向", () => {
  const target = new EventTarget();
  const input = createInput(target);

  target.dispatchEvent(keyboardEvent("keydown", "KeyW"));
  target.dispatchEvent(keyboardEvent("keydown", "ArrowRight"));
  assert.deepEqual(input.getDirection(), { x: 1, z: -1 });

  target.dispatchEvent(keyboardEvent("keyup", "KeyW"));
  assert.deepEqual(input.getDirection(), { x: 1, z: 0 });
  input.dispose();
});

test("窗口失焦会清空按键，销毁后不再接收事件", () => {
  const target = new EventTarget();
  const input = createInput(target);

  target.dispatchEvent(keyboardEvent("keydown", "KeyA"));
  target.dispatchEvent(new Event("blur"));
  assert.deepEqual(input.getDirection(), { x: 0, z: 0 });

  input.dispose();
  target.dispatchEvent(keyboardEvent("keydown", "KeyD"));
  assert.deepEqual(input.getDirection(), { x: 0, z: 0 });
});

test("方向键会阻止页面滚动，其他按键不会", () => {
  const target = new EventTarget();
  const input = createInput(target);
  const arrowEvent = keyboardEvent("keydown", "ArrowDown");
  const otherEvent = keyboardEvent("keydown", "Space");

  target.dispatchEvent(arrowEvent);
  target.dispatchEvent(otherEvent);

  assert.equal(arrowEvent.defaultPrevented, true);
  assert.equal(otherEvent.defaultPrevented, false);
  input.dispose();
});
