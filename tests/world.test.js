import test from "node:test";
import assert from "node:assert/strict";
import * as world from "../src/config/world.js";
import * as movement from "../src/systems/movement.js";

test("十座岛屿使用独立图层并按顺序串联", () => {
  const { ISLANDS, LOCATIONS, MAP_SIZE, WALKABLE_AREAS } = world;
  assert.equal(Array.isArray(ISLANDS), true);
  assert.equal(ISLANDS.length, 10);
  assert.equal(new Set(ISLANDS.map(({ id }) => id)).size, 10);
  assert.equal(LOCATIONS.length, 3);
  assert.deepEqual(
    LOCATIONS.map(({ id, unlockOrder }) => ({ id, unlockOrder })),
    [
      { id: "home", unlockOrder: 0 },
      { id: "mountain", unlockOrder: 1 },
      { id: "office", unlockOrder: 2 },
    ],
  );
  assert.deepEqual(
    ISLANDS.filter(({ assetUrl }) => assetUrl).map(({ id, assetUrl }) => ({
      id,
      assetUrl,
    })),
    [
      { id: "home", assetUrl: "./assets/islands/home.png" },
      { id: "mountain", assetUrl: "./assets/islands/mountain.png" },
      { id: "office", assetUrl: "./assets/islands/office.png" },
    ],
  );

  for (const location of LOCATIONS) {
    assert.ok(location.x > 0 && location.x < MAP_SIZE.width);
    assert.ok(location.z > 0 && location.z < MAP_SIZE.height);
    assert.ok(location.hitRadius > 0);
    assert.ok(location.interactionRadius > 0);
    assert.ok(
      Math.hypot(
        location.x - location.approach.x,
        location.z - location.approach.z,
      ) + 8 <= location.interactionRadius,
    );
    assert.equal(movement.isPointInPolygons(location.approach, WALKABLE_AREAS), true);
  }
});

test("七座后续岛屿被比场景占位更大的云层完整覆盖", () => {
  assert.equal(Array.isArray(world.ISLANDS), true);
  const futureIslands = world.ISLANDS.filter(({ kind }) => kind === "future");
  assert.equal(futureIslands.length, 7);

  for (const island of futureIslands) {
    assert.equal(island.assetUrl, null);
    assert.ok(island.cloudCover.x <= island.bounds.x);
    assert.ok(island.cloudCover.z <= island.bounds.z);
    assert.ok(
      island.cloudCover.x + island.cloudCover.width
        >= island.bounds.x + island.bounds.width,
    );
    assert.ok(
      island.cloudCover.z + island.cloudCover.height
        >= island.bounds.z + island.bounds.height,
    );
    assert.ok(island.cloudCover.opacity >= 0.9);
  }
});

test("玩家出生在家庭岛且移动速度固定为舒适值", () => {
  assert.equal(
    movement.isPointInPolygons(world.PLAYER_START, world.WALKABLE_AREAS),
    true,
  );
  assert.equal(world.PLAYER_SPEED, 145);
});

test("十座岛屿以不规则自然路线用九座相邻桥串联", () => {
  const centers = world.ISLANDS.map(({ bounds }) => ({
    x: bounds.x + bounds.width / 2,
    z: bounds.z + bounds.height / 2,
  }));

  assert.equal(world.BRIDGES.length, world.ISLANDS.length - 1);
  for (let index = 0; index < world.BRIDGES.length; index += 1) {
    const bridge = world.BRIDGES[index];
    assert.equal(bridge.fromIslandId, world.ISLANDS[index].id);
    assert.equal(bridge.toIslandId, world.ISLANDS[index + 1].id);
    assert.equal(bridge.requiredOrder, world.ISLANDS[index + 1].unlockOrder);
    assert.ok(centers[index].x < centers[index + 1].x);
  }
});

test("散点链路使用多次转向和不等步长避免形成固定字母", () => {
  const centers = world.ISLANDS.map(({ bounds }) => ({
    x: bounds.x + bounds.width / 2,
    z: bounds.z + bounds.height / 2,
  }));
  const horizontalGaps = centers.slice(1).map((center, index) => (
    center.x - centers[index].x
  ));
  const verticalSteps = centers.slice(1).map((center, index) => (
    center.z - centers[index].z
  ));
  const verticalDirections = verticalSteps.map((step) => Math.sign(step));
  const directionChanges = verticalDirections.slice(1).filter(
    (direction, index) => direction !== verticalDirections[index],
  ).length;

  assert.ok(Math.max(...horizontalGaps) - Math.min(...horizontalGaps) >= 150);
  assert.ok(Math.max(...verticalSteps.map(Math.abs))
    - Math.min(...verticalSteps.map(Math.abs)) >= 250);
  assert.ok(directionChanges >= 5);
});

test("爬山岛道路轴线与家庭到工作的桥梁方向一致", () => {
  const mountain = world.ISLANDS[1];
  const adjacentBridges = world.BRIDGES.slice(0, 2);
  const pathAngle = Math.atan2(
    mountain.bounds.height * 0.57,
    mountain.bounds.width * 0.21,
  ) + mountain.rotation;
  const center = {
    x: mountain.bounds.x + mountain.bounds.width / 2,
    z: mountain.bounds.z + mountain.bounds.height * 0.52,
  };
  const cosine = Math.cos(mountain.rotation);
  const sine = Math.sin(mountain.rotation);
  const mountainEndpoints = [adjacentBridges[0].to, adjacentBridges[1].from];

  for (const bridge of adjacentBridges) {
    const bridgeAngle = Math.atan2(
      bridge.to.z - bridge.from.z,
      bridge.to.x - bridge.from.x,
    );
    const angleDifference = Math.abs(Math.atan2(
      Math.sin(pathAngle - bridgeAngle),
      Math.cos(pathAngle - bridgeAngle),
    ));
    assert.ok(angleDifference < 0.2);
  }

  for (const endpoint of mountainEndpoints) {
    const dx = endpoint.x - center.x;
    const dz = endpoint.z - center.z;
    const localX = dx * cosine + dz * sine;
    const localZ = -dx * sine + dz * cosine;
    const ellipseDistance = localX ** 2 / (mountain.bounds.width * 0.43) ** 2
      + localZ ** 2 / (mountain.bounds.height * 0.37) ** 2;
    assert.ok(Math.abs(ellipseDistance - 1) < 0.000001);
  }
});

test("八座后续门禁与待解锁桥梁逐一对应", () => {
  const lockedBridges = world.BRIDGES.filter(
    ({ requiredOrder }) => requiredOrder >= 2,
  );

  assert.equal(lockedBridges.length, 8);
  assert.equal(world.LOCKED_GATES.length, lockedBridges.length);
  assert.deepEqual(
    world.LOCKED_GATES.map(({ bridgeId, requiredOrder }) => ({
      bridgeId,
      requiredOrder,
    })),
    lockedBridges.map(({ id, requiredOrder }) => ({
      bridgeId: id,
      requiredOrder,
    })),
  );
});
