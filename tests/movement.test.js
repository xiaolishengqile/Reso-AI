import test from "node:test";
import assert from "node:assert/strict";
import * as movement from "../src/systems/movement.js";

const {
  findNearbyLocation,
  moveActor,
  normalizeDirection,
} = movement;

test("斜向输入会归一化，避免移动速度变快", () => {
  const direction = normalizeDirection({ x: 1, z: 1 });

  assert.ok(Math.abs(Math.hypot(direction.x, direction.z) - 1) < 0.0001);
});

test("移动结果受世界边界和角色半径限制", () => {
  const next = moveActor({
    position: { x: 4.8, z: 0 },
    direction: { x: 1, z: 0 },
    speed: 4,
    deltaSeconds: 1,
    radius: 0.4,
    bounds: { minX: -5, maxX: 5, minZ: -4, maxZ: 4 },
    obstacles: [],
  });

  assert.equal(next.x, 4.6);
  assert.equal(next.z, 0);
});

test("玩家不能进入圆形障碍", () => {
  const next = moveActor({
    position: { x: 0, z: 0 },
    direction: { x: 1, z: 0 },
    speed: 2,
    deltaSeconds: 1,
    radius: 0.4,
    bounds: { minX: -5, maxX: 5, minZ: -4, maxZ: 4 },
    obstacles: [{ x: 2, z: 0, radius: 1 }],
  });

  assert.deepEqual(next, { x: 0, z: 0 });
});

test("玩家不能走出浮岛可行走区域", () => {
  const next = moveActor({
    position: { x: 8, z: 5 },
    direction: { x: 1, z: 0 },
    speed: 3,
    deltaSeconds: 1,
    radius: 0,
    bounds: { minX: 0, maxX: 20, minZ: 0, maxZ: 10 },
    obstacles: [],
    isWalkable: ({ x }) => x <= 10,
  });

  assert.deepEqual(next, { x: 8, z: 5 });
});

test("点击移动会生成单位方向并在抵达时停止", () => {
  assert.deepEqual(
    movement.directionToTarget({ x: 0, z: 0 }, { x: 3, z: 4 }, 0.5),
    { x: 0.6, z: 0.8, arrived: false },
  );
  assert.deepEqual(
    movement.directionToTarget({ x: 2.8, z: 4 }, { x: 3, z: 4 }, 0.5),
    { x: 0, z: 0, arrived: true },
  );
});

test("只返回交互范围内最近的地点", () => {
  const nearby = findNearbyLocation(
    { x: 0, z: 0 },
    [
      { id: "far", x: 5, z: 0, interactionRadius: 1 },
      { id: "near", x: 1, z: 0, interactionRadius: 2 },
    ],
  );

  assert.equal(nearby.id, "near");
});

test("没有地点进入交互范围时返回空值", () => {
  const nearby = findNearbyLocation(
    { x: 0, z: 0 },
    [{ id: "far", x: 5, z: 0, interactionRadius: 1 }],
  );

  assert.equal(nearby, null);
});
