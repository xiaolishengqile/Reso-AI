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

test("十座岛屿按双谷折线排列并用九座相邻桥串联", () => {
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

  const heights = centers.map(({ z }) => z);
  assert.ok(heights[0] < heights[1] && heights[1] < heights[2]);
  assert.ok(heights[2] > heights[3] && heights[3] > heights[4]);
  assert.ok(heights[4] > heights[5]);
  assert.ok(heights[5] < heights[6] && heights[6] < heights[7]);
  assert.ok(heights[7] > heights[8] && heights[8] > heights[9]);
});

test("双转折链路使用不等间距和不同谷深避免机械对称", () => {
  const centers = world.ISLANDS.map(({ bounds }) => ({
    x: bounds.x + bounds.width / 2,
    z: bounds.z + bounds.height / 2,
  }));
  const horizontalGaps = centers.slice(1).map((center, index) => (
    center.x - centers[index].x
  ));
  const firstDescent = centers[2].z - centers[0].z;
  const secondDescent = centers[7].z - centers[5].z;
  const firstAscent = centers[2].z - centers[5].z;
  const secondAscent = centers[7].z - centers[9].z;

  assert.ok(Math.max(...horizontalGaps) - Math.min(...horizontalGaps) >= 80);
  assert.ok(Math.abs(firstDescent - secondDescent) >= 200);
  assert.ok(Math.abs(firstAscent - secondAscent) >= 200);
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
