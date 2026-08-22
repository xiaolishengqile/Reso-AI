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

test("未解锁岛屿只显示柔和云雾而不在云层中央写字", () => {
  let textCount = 0;
  const context = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    fill() {},
    ellipse() {},
    fillText() { textCount += 1; },
  };

  renderer.drawCloudCover(context, ISLANDS[3], 0);

  assert.equal(textCount, 0);
});

test("透明手绘云素材加载完成后会替代程序圆形云层", () => {
  let imageCount = 0;
  let ellipseCount = 0;
  const context = {
    save() {},
    restore() {},
    translate() {},
    drawImage() { imageCount += 1; },
    beginPath() {},
    ellipse() { ellipseCount += 1; },
    fill() {},
  };
  const cloudImage = { complete: true, naturalWidth: 1664 };

  renderer.drawCloudCover(context, ISLANDS[3], 0, cloudImage);

  assert.equal(imageCount, 1);
  assert.equal(ellipseCount, 0);
});

test("爬山岛会围绕自身中心旋转使道路朝向前后桥梁", () => {
  const transforms = [];
  const draws = [];
  const context = {
    save() {},
    restore() {},
    translate(x, z) { transforms.push(["translate", x, z]); },
    rotate(angle) { transforms.push(["rotate", angle]); },
    drawImage(...args) { draws.push(args); },
  };
  const island = {
    id: "mountain",
    unlockOrder: 1,
    assetUrl: "mountain.png",
    bounds: { x: 600, z: 560, width: 760, height: 590 },
    rotation: -0.72,
  };
  const image = { complete: true, naturalWidth: 1347 };

  renderer.drawIslandLayers(
    context,
    [island],
    { get: () => image },
    1,
    0,
  );

  assert.deepEqual(transforms, [
    ["translate", 980, 855],
    ["rotate", -0.72],
  ]);
  assert.deepEqual(draws, [[image, -380, -295, 760, 590]]);
});
