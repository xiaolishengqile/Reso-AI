import test from "node:test";
import assert from "node:assert/strict";
import * as world from "../src/config/world.js";
import * as movement from "../src/systems/movement.js";
import { createSceneLocations } from "../src/scenes/registry.js";

const progressionPromise = import("../src/systems/progression.js");
const locations = createSceneLocations(world.LOCATIONS);

function simulateRoute(from, target, unlockedOrder, progression) {
  let position = { ...from };
  for (let frame = 0; frame < 900; frame += 1) {
    const direction = movement.directionToTarget(position, target, 8);
    if (direction.arrived) return { arrived: true, position };
    position = movement.moveActor({
      position,
      direction,
      speed: world.PLAYER_SPEED,
      deltaSeconds: 1 / 60,
      radius: world.PLAYER_RADIUS,
      bounds: world.WORLD_BOUNDS,
      obstacles: world.OBSTACLES,
      isWalkable: (point) => (
        movement.isCircleInPolygons(
          point,
          world.PLAYER_RADIUS,
          world.WALKABLE_AREAS,
        )
        && progression.canTraversePoint(
          point,
          unlockedOrder,
          world.LOCKED_GATES,
          world.PLAYER_RADIUS,
        )
      ),
    });
  }
  return { arrived: false, position };
}

test("出生时十座岛全部可以进入", async () => {
  const progression = await progressionPromise;
  const access = Object.fromEntries(
    locations.map((location) => [
      location.id,
      progression.isLocationUnlocked(location, 1),
    ]),
  );

  assert.deepEqual(access, {
    home: true, mountain: true, office: true, dining: true, cohabitation: true,
    money: true, social: true, travel: true, future: true, wish: true,
  });
});

test("完成爬山后解锁工作岛，家庭场景不会跳级", async () => {
  const progression = await progressionPromise;
  const home = locations.find(({ id }) => id === "home");
  const mountain = locations.find(({ id }) => id === "mountain");

  assert.equal(progression.advanceUnlockOrder(1, home), 1);
  assert.equal(progression.advanceUnlockOrder(1, mountain), 2);
});

test("没有门禁时任意桥梁位置都可以通行", async () => {
  const progression = await progressionPromise;
  assert.equal(progression.canTraversePoint({ x: 8.5, z: 3 }, 1, [], 0.6), true);
});

test("相邻十岛的自动路线从开局均可直达入口", async () => {
  const progression = await progressionPromise;
  for (let index = 1; index < locations.length; index += 1) {
    const from = index === 1 ? world.PLAYER_START : locations[index - 1].approach;
    const target = locations[index].approach;
    const openRoute = simulateRoute(from, target, 1, progression);

    assert.equal(openRoute.arrived, true, locations[index].id + " 应可抵达");
  }
});
