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
