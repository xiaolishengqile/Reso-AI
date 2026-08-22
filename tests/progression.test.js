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

test("出生时家庭和爬山可进入，工作岛仍锁定", async () => {
  const progression = await progressionPromise;
  const access = Object.fromEntries(
    locations.map((location) => [
      location.id,
      progression.isLocationUnlocked(location, 1),
    ]),
  );

  assert.deepEqual(access, {
    home: true,
    mountain: true,
    office: false,
    dining: false,
    cohabitation: false,
    money: false,
    social: false,
    travel: false,
    future: false,
    wish: false,
  });
});

test("完成爬山后解锁工作岛，家庭场景不会跳级", async () => {
  const progression = await progressionPromise;
  const home = locations.find(({ id }) => id === "home");
  const mountain = locations.find(({ id }) => id === "mountain");

  assert.equal(progression.advanceUnlockOrder(1, home), 1);
  assert.equal(progression.advanceUnlockOrder(1, mountain), 2);
});

test("工作岛桥梁在爬山完成前会按角色半径完整阻挡", async () => {
  const progression = await progressionPromise;
  const gates = [
    { requiredOrder: 2, minX: 9, maxX: 11, minZ: 2, maxZ: 4 },
  ];

  assert.equal(
    progression.canTraversePoint({ x: 8.5, z: 3 }, 1, gates, 0.6),
    false,
  );
  assert.equal(
    progression.canTraversePoint({ x: 8.5, z: 3 }, 2, gates, 0.6),
    true,
  );
  assert.equal(
    progression.canTraversePoint({ x: 5, z: 3 }, 1, gates, 0.6),
    true,
  );
});

test("真实地图中原先可绕过门禁的桥边位置会被阻挡", async () => {
  const progression = await progressionPromise;
  const gate = world.LOCKED_GATES[0];
  const bridge = world.BRIDGES.find(({ id }) => id === "mountain-office");
  const dx = bridge.to.x - bridge.from.x;
  const dz = bridge.to.z - bridge.from.z;
  const length = Math.hypot(dx, dz);
  const midpoint = {
    x: (bridge.from.x + bridge.to.x) / 2,
    z: (bridge.from.z + bridge.to.z) / 2,
  };
  const bridgeEdge = {
    x: midpoint.x - dz / length * (bridge.width / 2 - world.PLAYER_RADIUS),
    z: midpoint.z + dx / length * (bridge.width / 2 - world.PLAYER_RADIUS),
  };

  assert.equal(gate.bridgeId, bridge.id);
  assert.equal(
    movement.isCircleInPolygons(
      bridgeEdge,
      world.PLAYER_RADIUS,
      world.WALKABLE_AREAS,
    ),
    true,
  );

  assert.equal(
    progression.canTraversePoint(
      bridgeEdge,
      1,
      world.LOCKED_GATES,
      world.PLAYER_RADIUS,
    ),
    false,
  );
  assert.equal(
    progression.canTraversePoint(
      bridgeEdge,
      2,
      world.LOCKED_GATES,
      world.PLAYER_RADIUS,
    ),
    true,
  );
});

test("八座待解锁桥梁的中心线都会按角色半径阻挡", async () => {
  const progression = await progressionPromise;
  const lockedBridges = world.BRIDGES.filter(
    ({ requiredOrder }) => requiredOrder >= 2,
  );

  for (const bridge of lockedBridges) {
    const midpoint = {
      x: (bridge.from.x + bridge.to.x) / 2,
      z: (bridge.from.z + bridge.to.z) / 2,
    };
    assert.equal(
      progression.canTraversePoint(
        midpoint,
        bridge.requiredOrder - 1,
        world.LOCKED_GATES,
        world.PLAYER_RADIUS,
      ),
      false,
    );
    assert.equal(
      progression.canTraversePoint(
        midpoint,
        bridge.requiredOrder,
        world.LOCKED_GATES,
        world.PLAYER_RADIUS,
      ),
      true,
    );
  }
});

test("相邻十岛的自动路线均受顺序门禁约束并可直达入口", async () => {
  const progression = await progressionPromise;
  for (let index = 1; index < locations.length; index += 1) {
    const from = index === 1 ? world.PLAYER_START : locations[index - 1].approach;
    const target = locations[index].approach;
    const requiredOrder = locations[index].unlockOrder;
    const openRoute = simulateRoute(from, target, requiredOrder, progression);

    assert.equal(openRoute.arrived, true, locations[index].id + " 应可抵达");

    if (requiredOrder >= 2) {
      const lockedRoute = simulateRoute(from, target, requiredOrder - 1, progression);
      assert.equal(lockedRoute.arrived, false, locations[index].id + " 应被门禁阻挡");
      assert.ok(Math.hypot(
        lockedRoute.position.x - target.x,
        lockedRoute.position.z - target.z,
      ) > 80);
    }
  }
});
