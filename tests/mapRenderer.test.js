import test from "node:test";
import assert from "node:assert/strict";
import { ISLANDS } from "../src/config/world.js";
import * as renderer from "../src/game/mapRenderer.js";

test("初始渲染会显示三张独立素材并用云层覆盖工作岛和未来岛", () => {
  assert.equal(typeof renderer.getIslandRenderState, "function");

  const state = renderer.getIslandRenderState(ISLANDS, 1);

  assert.deepEqual(
    state.filter(({ showAsset }) => showAsset).map(({ id }) => id),
    ["home", "mountain", "office"],
  );
  assert.deepEqual(
    state.filter(({ showCloud }) => showCloud).map(({ id }) => id),
    [
      "office",
      "future-3",
      "future-4",
      "future-5",
      "future-6",
      "future-7",
      "future-8",
      "future-9",
    ],
  );
});

test("完成爬山后只移除工作岛云层，七座未来岛仍保持遮挡", () => {
  assert.equal(typeof renderer.getIslandRenderState, "function");

  const state = renderer.getIslandRenderState(ISLANDS, 2);

  assert.deepEqual(
    state.filter(({ showCloud }) => showCloud).map(({ id }) => id),
    [
      "future-3",
      "future-4",
      "future-5",
      "future-6",
      "future-7",
      "future-8",
      "future-9",
    ],
  );
});

test("岛屿图片存储器释放后不再触发在途错误回调", () => {
  class FakeImage extends EventTarget {
    src = "";
  }
  const failures = [];
  const store = renderer.createIslandImageStore(
    { Image: FakeImage },
    [{ id: "home", assetUrl: "./assets/islands/home.png" }],
    (island) => failures.push(island.id),
  );
  const image = store.get("home");

  image.dispatchEvent(new Event("error"));
  assert.deepEqual(failures, ["home"]);

  assert.equal(typeof store.dispose, "function");
  store.dispose();
  image.dispatchEvent(new Event("error"));
  assert.deepEqual(failures, ["home"]);
  assert.equal(image.src, "");
});
