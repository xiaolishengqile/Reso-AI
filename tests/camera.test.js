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

test("横向地图的近景保持人物可读尺度并置于视口中央", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createFollowTransform, "function");

  const transform = camera.createFollowTransform(
    1200,
    800,
    MAP_SIZE.width,
    MAP_SIZE.height,
    { x: 2650, z: 1100 },
  );

  assert.ok(Math.abs(transform.scale - Math.min(1200 / 1700, 800 / 1100)) < 0.000001);
  assert.ok(Math.abs(2650 * transform.scale + transform.offsetX - 600) < 0.001);
  assert.ok(Math.abs(1100 * transform.scale + transform.offsetY - 400) < 0.001);
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
      scale: Math.min(1200 / 1700, 800 / 1100),
      offsetX: 0,
      offsetY: 0,
    },
  );
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

test("开场短暂展示全景后即使静止也锁定人物近景", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.resolveCameraMode, "function");

  assert.equal(camera.resolveCameraMode({ elapsedSeconds: 0 }), "overview");
  assert.equal(camera.resolveCameraMode({ elapsedSeconds: 1.5 }), "follow");
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
