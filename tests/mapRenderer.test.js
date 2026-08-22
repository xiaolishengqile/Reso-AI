import test from "node:test";
import assert from "node:assert/strict";
import { ISLANDS, WORLD_DECORATIONS } from "../src/config/world.js";
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

test("锁定岛屿云层不会遮挡已开放的家庭岛和爬山岛", () => {
  const cloudImage = { complete: true, naturalWidth: 1664 };
  const visibleIslands = ISLANDS.slice(0, 2);
  const lockedIslands = ISLANDS.slice(2);
  const assetBounds = visibleIslands.map((island) => {
    const halfWidth = island.bounds.width / 2;
    const halfHeight = island.bounds.height / 2;
    const cosine = Math.cos(island.rotation ?? 0);
    const sine = Math.sin(island.rotation ?? 0);
    const radiusX = Math.abs(cosine) * halfWidth + Math.abs(sine) * halfHeight;
    const radiusZ = Math.abs(sine) * halfWidth + Math.abs(cosine) * halfHeight;
    const centerX = island.bounds.x + halfWidth;
    const centerZ = island.bounds.z + halfHeight;
    return {
      id: island.id,
      x: centerX - radiusX,
      z: centerZ - radiusZ,
      width: radiusX * 2,
      height: radiusZ * 2,
    };
  });

  for (const island of lockedIslands) {
    let cloudBounds = null;
    const context = {
      globalAlpha: 1,
      save() {},
      restore() {},
      drawImage(_image, x, z, width, height) {
        cloudBounds = { x, z, width, height };
      },
    };
    renderer.drawCloudCover(context, island, 0, cloudImage);

    for (const visible of assetBounds) {
      const overlaps = cloudBounds.x < visible.x + visible.width
        && cloudBounds.x + cloudBounds.width > visible.x
        && cloudBounds.z < visible.z + visible.height
        && cloudBounds.z + cloudBounds.height > visible.z;
      assert.equal(
        overlaps,
        false,
        island.id + " 云层不应遮挡 " + visible.id,
      );
    }
  }
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
