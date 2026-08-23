import test from "node:test";
import assert from "node:assert/strict";
import { MAP_SIZE } from "../src/config/world.js";

const cameraPromise = import("../src/systems/camera.js").catch(() => ({}));

test("静止概览会完整容纳整张地图", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createOverviewTransform, "function");

  const transform = camera.createOverviewTransform(
    1200,
    800,
    MAP_SIZE.width,
    MAP_SIZE.height,
  );

  assert.ok(Math.abs(transform.scale - 1200 / MAP_SIZE.width) < 0.000001);
  assert.equal(transform.offsetX, 0);
  assert.ok(transform.offsetY > 0);
});

test("人物近景放大约三成并置于视口中央", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createFollowTransform, "function");

  const transform = camera.createFollowTransform(
    1200,
    800,
    MAP_SIZE.width,
    MAP_SIZE.height,
    { x: 2650, z: 1100 },
  );

  assert.ok(Math.abs(transform.scale - Math.min(1200 / 1300, 800 / 840)) < 0.000001);
  assert.ok(Math.abs(2650 * transform.scale + transform.offsetX - 600) < 0.001);
  assert.ok(Math.abs(1100 * transform.scale + transform.offsetY - 400) < 0.001);
});

test("地图内底部对话会把人物焦点抬到画面上半部", async () => {
  const camera = await cameraPromise;
  const transform = camera.createFollowTransform(
    1200,
    800,
    MAP_SIZE.width,
    MAP_SIZE.height,
    { x: 2650, z: 1900 },
    0.68,
  );

  assert.ok(Math.abs(transform.scale - 544 / 840) < 0.001);
  assert.ok(Math.abs(1900 * transform.scale + transform.offsetY - 272) < 0.001);
});

test("近景跟随在地图边缘不会露出空白", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createFollowTransform, "function");

  assert.deepEqual(
    camera.createFollowTransform(
      1200,
      800,
      MAP_SIZE.width,
      MAP_SIZE.height,
      { x: 0, z: 0 },
    ),
    {
      scale: Math.min(1200 / 1300, 800 / 840),
      offsetX: 0,
      offsetY: 0,
    },
  );
});

test("超宽屏近景不会把岛屿继续放大到裁出页面", async () => {
  const camera = await cameraPromise;

  const transform = camera.createFollowTransform(
    2884,
    1494,
    MAP_SIZE.width,
    MAP_SIZE.height,
    { x: 1510, z: 1290 },
  );

  assert.equal(transform.scale, 1.05);
});

test("镜头会平滑接近目标而不会瞬间跳变", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.stepCamera, "function");

  const current = { scale: 0.4, offsetX: 0, offsetY: 10 };
  const target = { scale: 0.8, offsetX: -500, offsetY: -300 };
  const next = camera.stepCamera(current, target, 1 / 60);

  assert.ok(next.scale > current.scale && next.scale < target.scale);
  assert.ok(next.offsetX < current.offsetX && next.offsetX > target.offsetX);
  assert.ok(next.offsetY < current.offsetY && next.offsetY > target.offsetY);
});

test("拖动云海会平移地图并限制在地图边界内", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.panMapTransform, "function");

  assert.deepEqual(
    camera.panMapTransform(
      { scale: 0.5, offsetX: -200, offsetY: -100 },
      { x: 120, y: -80 },
      1200,
      800,
      MAP_SIZE.width,
      MAP_SIZE.height,
    ),
    { scale: 0.5, offsetX: -80, offsetY: -180 },
  );

  assert.deepEqual(
    camera.panMapTransform(
      { scale: 0.5, offsetX: -80, offsetY: -180 },
      { x: 1000, y: -2000 },
      1200,
      800,
      MAP_SIZE.width,
      MAP_SIZE.height,
    ),
    { scale: 0.5, offsetX: 0, offsetY: -1200 },
  );
});

test("全景完整容纳地图时开始拖动会进入可平移尺度", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createPannableTransform, "function");
  const overview = camera.createOverviewTransform(
    1200,
    800,
    MAP_SIZE.width,
    MAP_SIZE.height,
  );
  const anchor = { x: 180, y: 160 };
  const mapPoint = {
    x: (anchor.x - overview.offsetX) / overview.scale,
    z: (anchor.y - overview.offsetY) / overview.scale,
  };

  const pannable = camera.createPannableTransform(
    overview,
    anchor,
    mapPoint,
    1200,
    800,
    MAP_SIZE.width,
    MAP_SIZE.height,
  );

  assert.ok(pannable.scale > overview.scale);
  assert.ok(MAP_SIZE.width * pannable.scale > 1200);
  assert.ok(MAP_SIZE.height * pannable.scale > 800);
});

test("开场短暂展示全景后即使静止也锁定人物近景", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.resolveCameraMode, "function");

  assert.equal(camera.resolveCameraMode({ elapsedSeconds: 0 }), "overview");
  assert.equal(camera.resolveCameraMode({ elapsedSeconds: 1.5 }), "follow");
});

test("雾谷地图内对话会立即锁定人物近景", async () => {
  const camera = await cameraPromise;

  assert.equal(camera.resolveCameraMode({
    elapsedSeconds: 0,
    dialogueActive: true,
  }), "follow");
});

test("全景按钮保持全景，但人物移动会立即恢复近景", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.resolveCameraMode, "function");

  assert.equal(camera.resolveCameraMode({
    elapsedSeconds: 3,
    overviewRequested: true,
    moving: false,
  }), "overview");
  assert.equal(camera.resolveCameraMode({
    elapsedSeconds: 3,
    overviewRequested: true,
    moving: true,
  }), "follow");
});
