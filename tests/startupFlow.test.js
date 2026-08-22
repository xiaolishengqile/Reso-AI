import test from "node:test";
import assert from "node:assert/strict";
import { resolveInitialScene } from "../src/startup.js";

test("没有旅人画像时启动雾谷序章", () => {
  assert.equal(resolveInitialScene(null)?.id, "home");
});

test("画像未完成时仍启动雾谷序章", () => {
  assert.equal(resolveInitialScene({ completed: false })?.id, "home");
});

test("已有正式旅人画像时直接进入自由探索", () => {
  assert.equal(resolveInitialScene({ completed: true }), null);
});
