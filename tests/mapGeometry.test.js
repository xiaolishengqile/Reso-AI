import test from "node:test";
import assert from "node:assert/strict";
import * as movement from "../src/systems/movement.js";

test("铺满视口后屏幕坐标能够准确换算回地图坐标", () => {
  const transform = movement.createCoverTransform(1200, 800, 1536, 1024);

  assert.deepEqual(transform, { scale: 0.78125, offsetX: 0, offsetY: 0 });
  assert.deepEqual(
    movement.screenToMap({ x: 600, y: 400 }, transform),
    { x: 768, z: 512 },
  );
});

test("宽屏裁切时坐标换算包含垂直偏移", () => {
  const transform = movement.createCoverTransform(1920, 1080, 1536, 1024);

  assert.deepEqual(transform, { scale: 1.25, offsetX: 0, offsetY: -100 });
  assert.deepEqual(
    movement.screenToMap({ x: 960, y: 540 }, transform),
    { x: 768, z: 512 },
  );
});

test("多边形边界能够区分浮岛与天空", () => {
  const island = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 8 },
    { x: 0, z: 8 },
  ];

  assert.equal(movement.isPointInPolygon({ x: 5, z: 4 }, island), true);
  assert.equal(movement.isPointInPolygon({ x: 12, z: 4 }, island), false);
});
