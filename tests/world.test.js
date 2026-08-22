import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { LOCATIONS, WORLD_BOUNDS } from "../src/config/world.js";
import { createPlayer } from "../src/entities/createPlayer.js";
import { createWorld } from "../src/world/createWorld.js";

test("三个地点标识唯一且都位于地图边界内", () => {
  assert.equal(LOCATIONS.length, 3);
  assert.equal(new Set(LOCATIONS.map(({ id }) => id)).size, 3);

  for (const location of LOCATIONS) {
    assert.ok(location.x > WORLD_BOUNDS.minX);
    assert.ok(location.x < WORLD_BOUNDS.maxX);
    assert.ok(location.z > WORLD_BOUNDS.minZ);
    assert.ok(location.z < WORLD_BOUNDS.maxZ);
    assert.ok(location.interactionRadius > 0);
  }
});

test("世界构建器为每个地点生成对应的交互目标", () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);

  assert.equal(world.locationTargets.length, LOCATIONS.length);
  assert.deepEqual(
    world.locationTargets.map((target) => target.userData.locationId).sort(),
    LOCATIONS.map(({ id }) => id).sort(),
  );
  assert.ok(world.animatedObjects.length > 0);
  assert.ok(scene.children.length > LOCATIONS.length);
});

test("玩家对象包含可移动根节点和会响应方向的更新函数", () => {
  const player = createPlayer();

  assert.ok(player.group.isGroup);
  assert.equal(typeof player.update, "function");
  player.update(0.1, { x: 1, z: 0 });
  assert.ok(Math.abs(player.group.rotation.y - Math.PI / 2) < 0.0001);
  assert.notEqual(player.group.userData.leftLeg.rotation.x, 0);
});

test("构建世界时不会向控制台输出无效材质参数警告", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));

  try {
    createWorld(new THREE.Scene());
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, []);
});
