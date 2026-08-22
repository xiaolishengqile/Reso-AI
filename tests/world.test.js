import test from "node:test";
import assert from "node:assert/strict";
import * as world from "../src/config/world.js";
import * as movement from "../src/systems/movement.js";

test("三座岛屿按家庭、爬山、工作的顺序串联", () => {
  const { LOCATIONS, MAP_SIZE, WALKABLE_AREAS } = world;
  assert.equal(LOCATIONS.length, 3);
  assert.equal(new Set(LOCATIONS.map(({ id }) => id)).size, 3);
  assert.deepEqual(
    LOCATIONS.map(({ id, unlockOrder }) => ({ id, unlockOrder })),
    [
      { id: "home", unlockOrder: 0 },
      { id: "mountain", unlockOrder: 1 },
      { id: "office", unlockOrder: 2 },
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

test("玩家出生在家庭岛且移动速度更舒适", () => {
  assert.equal(
    movement.isPointInPolygons(world.PLAYER_START, world.WALKABLE_AREAS),
    true,
  );
  assert.ok(world.PLAYER_SPEED >= 120 && world.PLAYER_SPEED <= 150);
});
