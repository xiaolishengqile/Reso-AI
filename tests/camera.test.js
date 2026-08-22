import test from "node:test";
import assert from "node:assert/strict";

const cameraPromise = import("../src/systems/camera.js").catch(() => ({}));

test("静止概览会完整容纳整张地图", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createOverviewTransform, "function");

  const transform = camera.createOverviewTransform(1200, 800, 3400, 2200);

  assert.ok(Math.abs(transform.scale - 1200 / 3400) < 0.000001);
  assert.equal(transform.offsetX, 0);
  assert.ok(transform.offsetY > 0);
});

test("移动近景会放大两倍并把角色置于视口中央", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createFollowTransform, "function");

  const transform = camera.createFollowTransform(
    1200,
    800,
    3400,
    2200,
    { x: 1700, z: 1100 },
  );

  assert.ok(Math.abs(transform.scale - (1200 / 3400) * 2) < 0.000001);
  assert.ok(Math.abs(1700 * transform.scale + transform.offsetX - 600) < 0.001);
  assert.ok(Math.abs(1100 * transform.scale + transform.offsetY - 400) < 0.001);
});

test("近景跟随在地图边缘不会露出空白", async () => {
  const camera = await cameraPromise;
  assert.equal(typeof camera.createFollowTransform, "function");

  assert.deepEqual(
    camera.createFollowTransform(
      1200,
      800,
      3400,
      2200,
      { x: 0, z: 0 },
    ),
    {
      scale: (1200 / 3400) * 2,
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
