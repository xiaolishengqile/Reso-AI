import test from "node:test";
import assert from "node:assert/strict";
import { ISLANDS, WORLD_DECORATIONS } from "../src/config/world.js";
import * as renderer from "../src/game/mapRenderer.js";

test("初始渲染会直接显示十张独立岛图且没有云层", () => {
  assert.equal(typeof renderer.getIslandRenderState, "function");

  const state = renderer.getIslandRenderState(ISLANDS, 1);

  assert.deepEqual(
    state.filter(({ showAsset }) => showAsset).map(({ id }) => id),
    [
      "home",
      "mountain",
      "office",
      "dining",
      "cohabitation",
      "money",
      "social",
      "travel",
      "future",
      "wish",
    ],
  );
  assert.deepEqual(state.filter(({ showCloud }) => showCloud), []);
  assert.deepEqual(
    state.filter(({ showGenerated }) => showGenerated).map(({ id }) => id),
    [],
  );
});

test("完成进度不会重新给任何岛屿增加遮挡", () => {
  assert.equal(typeof renderer.getIslandRenderState, "function");

  const state = renderer.getIslandRenderState(ISLANDS, 2);

  assert.deepEqual(state.filter(({ showCloud }) => showCloud), []);
});

test("雾层使用多层半透明渐变并随时间缓慢漂移", () => {
  assert.equal(typeof renderer.drawWorldFog, "function");

  function renderFog(elapsedSeconds) {
    const ellipses = [];
    const colorStops = [];
    const gradient = {
      addColorStop(offset, color) { colorStops.push([offset, color]); },
    };
    const context = {
      save() {}, restore() {}, beginPath() {}, fill() {}, fillRect() {},
      createLinearGradient() { return gradient; },
      createRadialGradient() { return gradient; },
      ellipse(x, z, radiusX, radiusZ) {
        ellipses.push({ x, z, radiusX, radiusZ });
      },
    };

    renderer.drawWorldFog(context, { width: 6500, height: 4000 }, elapsedSeconds);
    return { ellipses, colorStops };
  }

  const start = renderFog(0);
  const later = renderFog(4);

  assert.ok(start.ellipses.length >= 5);
  assert.ok(start.colorStops.some(([, color]) => color.includes("rgba")));
  assert.notDeepEqual(
    later.ellipses.map(({ x, z }) => ({ x, z })),
    start.ellipses.map(({ x, z }) => ({ x, z })),
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

test("雾谷入口声明老人木椅装饰", () => {
  const elder = WORLD_DECORATIONS.find(({ id }) => id === "fog-valley-elder");
  assert.equal(elder.sceneId, "home");
  assert.match(elder.assetUrl, /elder-bench\.png$/);
  assert.ok(elder.width > 0 && elder.height > 0);
});

test("老人素材未加载时仍绘制程序轮廓", () => {
  const operations = [];
  const context = new Proxy({}, {
    get(_target, key) {
      return (...args) => operations.push([key, ...args]);
    },
    set() { return true; },
  });
  const elder = WORLD_DECORATIONS.find(({ id }) => id === "fog-valley-elder");

  renderer.drawWorldDecorations(context, [elder], { get() { return null; } });

  assert.ok(operations.some(([name]) => name === "fillRect"));
  assert.ok(operations.some(([name]) => name === "arc"));
});

test("老人素材加载完成后按地图锚点绘制透明图片", () => {
  const draws = [];
  const context = {
    save() {}, restore() {},
    drawImage(...args) { draws.push(args); },
  };
  const elder = WORLD_DECORATIONS.find(({ id }) => id === "fog-valley-elder");
  const image = { complete: true, naturalWidth: 450 };

  renderer.drawWorldDecorations(context, [elder], { get() { return image; } });

  assert.deepEqual(draws, [[
    image,
    elder.x - elder.width / 2,
    elder.z - elder.height,
    elder.width,
    elder.height,
  ]]);
});
