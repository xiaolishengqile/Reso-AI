import test from "node:test";
import assert from "node:assert/strict";
import * as world from "../src/config/world.js";
import * as movement from "../src/systems/movement.js";

test("三个地点标识唯一且都位于地图画布内", () => {
  const { LOCATIONS, MAP_SIZE, WALKABLE_POLYGON } = world;
  assert.equal(LOCATIONS.length, 3);
  assert.equal(new Set(LOCATIONS.map(({ id }) => id)).size, 3);

  for (const location of LOCATIONS) {
    assert.ok(location.x > 0 && location.x < MAP_SIZE.width);
    assert.ok(location.z > 0 && location.z < MAP_SIZE.height);
    assert.ok(location.hitRadius > 0);
    assert.ok(location.interactionRadius > 0);
    assert.equal(
      movement.isPointInPolygon(location.approach, WALKABLE_POLYGON),
      true,
    );
  }
});

test("玩家出生点位于浮岛可行走区域", () => {
  assert.equal(
    movement.isPointInPolygon(world.PLAYER_START, world.WALKABLE_POLYGON),
    true,
  );
});
