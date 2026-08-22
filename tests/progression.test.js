import test from "node:test";
import assert from "node:assert/strict";
import * as world from "../src/config/world.js";

const progressionPromise = import("../src/systems/progression.js");

test("出生时家庭和爬山可进入，工作岛仍锁定", async () => {
  const progression = await progressionPromise;
  const access = Object.fromEntries(
    world.LOCATIONS.map((location) => [
      location.id,
      progression.isLocationUnlocked(location, 1),
    ]),
  );

  assert.deepEqual(access, {
    home: true,
    mountain: true,
    office: false,
  });
});

test("完成爬山后解锁工作岛，家庭场景不会跳级", async () => {
  const progression = await progressionPromise;
  const home = world.LOCATIONS.find(({ id }) => id === "home");
  const mountain = world.LOCATIONS.find(({ id }) => id === "mountain");

  assert.equal(progression.advanceUnlockOrder(1, home), 1);
  assert.equal(progression.advanceUnlockOrder(1, mountain), 2);
});

test("工作岛桥梁在爬山完成前无法通行", async () => {
  const progression = await progressionPromise;
  const gates = [
    { requiredOrder: 2, minX: 9, maxX: 11, minZ: 2, maxZ: 4 },
  ];

  assert.equal(progression.canTraversePoint({ x: 10, z: 3 }, 1, gates), false);
  assert.equal(progression.canTraversePoint({ x: 10, z: 3 }, 2, gates), true);
  assert.equal(progression.canTraversePoint({ x: 5, z: 3 }, 1, gates), true);
});
