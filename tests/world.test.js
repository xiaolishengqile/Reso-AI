import test from "node:test";
import assert from "node:assert/strict";
import * as world from "../src/config/world.js";
import * as movement from "../src/systems/movement.js";

test("十座岛屿使用独立图层并按顺序串联", () => {
  const { ISLANDS, LOCATIONS, MAP_SIZE, WALKABLE_AREAS } = world;
  assert.equal(Array.isArray(ISLANDS), true);
  assert.equal(ISLANDS.length, 10);
  assert.equal(new Set(ISLANDS.map(({ id }) => id)).size, 10);
  assert.equal(LOCATIONS.length, 10);
  assert.deepEqual(
    LOCATIONS.map(({ id, unlockOrder }) => ({ id, unlockOrder })),
    [
      { id: "home", unlockOrder: 0 },
      { id: "mountain", unlockOrder: 1 },
      { id: "office", unlockOrder: 2 },
      { id: "dining", unlockOrder: 3 },
      { id: "cohabitation", unlockOrder: 4 },
      { id: "money", unlockOrder: 5 },
      { id: "social", unlockOrder: 6 },
      { id: "travel", unlockOrder: 7 },
      { id: "future", unlockOrder: 8 },
      { id: "wish", unlockOrder: 9 },
    ],
  );
  assert.deepEqual(ISLANDS.map(({ id, assetUrl }) => ({ id, assetUrl })), [
    { id: "home", assetUrl: "./assets/islands/home.png" },
    { id: "mountain", assetUrl: "./assets/islands/mountain.png" },
    { id: "office", assetUrl: "./assets/islands/office.png" },
    { id: "dining", assetUrl: "./assets/islands/dining.png" },
    { id: "cohabitation", assetUrl: "./assets/islands/cohabitation.png" },
    { id: "money", assetUrl: "./assets/islands/money.png" },
    { id: "social", assetUrl: "./assets/islands/social.png" },
    { id: "travel", assetUrl: "./assets/islands/travel.png" },
    { id: "future", assetUrl: "./assets/islands/future.png" },
    { id: "wish", assetUrl: "./assets/islands/wish.png" },
  ]);

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

test("十座图片岛屿从开局完整显示且不声明云层", () => {
  assert.equal(world.ISLANDS.every(({ renderMode }) => renderMode === "asset"), true);
  assert.equal(world.ISLANDS.every(({ cloudCover }) => cloudCover == null), true);
});

test("玩家出生在家庭岛且移动速度固定为舒适值", () => {
  assert.equal(
    movement.isPointInPolygons(world.PLAYER_START, world.WALKABLE_AREAS),
    true,
  );
  assert.equal(world.PLAYER_SPEED, 145);
});

test("雾谷老人木椅位于主岛内且不与玩家出生点重叠", () => {
  const elder = world.WORLD_DECORATIONS.find(({ id }) => id === "fog-valley-elder");
  const home = world.ISLANDS.find(({ id }) => id === "home");

  assert.ok(elder.x >= home.bounds.x && elder.x <= home.bounds.x + home.bounds.width);
  assert.ok(elder.z >= home.bounds.z && elder.z <= home.bounds.z + home.bounds.height);
  assert.ok(Math.hypot(elder.x - world.PLAYER_START.x, elder.z - world.PLAYER_START.z) > 100);
});

test("十座岛屿沿自然曲线用九座相邻桥串联", () => {
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
    assert.ok(Math.hypot(
      centers[index + 1].x - centers[index].x,
      centers[index + 1].z - centers[index].z,
    ) > 500);
  }
});

test("岛链从左下向右上连续抬升且使用不等步长", () => {
  const centers = world.ISLANDS.map(({ bounds }) => ({
    x: bounds.x + bounds.width / 2,
    z: bounds.z + bounds.height / 2,
  }));
  const steps = centers.slice(1).map((center, index) => ({
    x: center.x - centers[index].x,
    z: center.z - centers[index].z,
  }));
  const distances = steps.map(({ x, z }) => Math.hypot(x, z));
  const [start] = centers;
  const end = centers.at(-1);

  assert.ok(steps.every(({ x }) => x > 0));
  assert.ok(steps.every(({ z }) => z < 0));
  assert.ok(Math.max(...distances) - Math.min(...distances) >= 100);
  assert.ok(start.x < world.MAP_SIZE.width * 0.25);
  assert.ok(start.z > world.MAP_SIZE.height * 0.72);
  assert.ok(end.x > world.MAP_SIZE.width * 0.75);
  assert.ok(end.z < world.MAP_SIZE.height * 0.28);
});

test("岛屿和桥梁由近及远逐步缩小形成纵深", () => {
  const widths = world.ISLANDS.map(({ bounds }) => bounds.width);
  const heights = world.ISLANDS.map(({ bounds }) => bounds.height);
  const bridgeWidths = world.BRIDGES.map(({ width }) => width);

  assert.ok(widths.slice(1).every((width, index) => width <= widths[index]));
  assert.ok(heights.slice(1).every((height, index) => height <= heights[index]));
  assert.ok(bridgeWidths.slice(1).every((width, index) => width <= bridgeWidths[index]));
  assert.ok(widths[0] - widths.at(-1) >= 250);
  assert.ok(bridgeWidths[0] - bridgeWidths.at(-1) >= 30);
});

test("首尾岛与地图边缘保持留白避免被界面遮挡", () => {
  const homeBounds = world.ISLANDS[0].bounds;
  const wishBounds = world.ISLANDS.at(-1).bounds;

  assert.ok(homeBounds.z + homeBounds.height <= world.MAP_SIZE.height * 0.93);
  assert.ok(wishBounds.x + wishBounds.width <= world.MAP_SIZE.width * 0.9);
  assert.ok(wishBounds.z >= world.MAP_SIZE.height * 0.1);
});

test("桥梁始终连接相邻岛屿的可行走边缘", () => {
  for (const bridge of world.BRIDGES) {
    assert.equal(movement.isPointInPolygons(bridge.from, world.WALKABLE_AREAS), true);
    assert.equal(movement.isPointInPolygons(bridge.to, world.WALKABLE_AREAS), true);
  }
});

test("全部桥梁从开局开放且没有顺序门禁", () => {
  assert.deepEqual(world.LOCKED_GATES, []);
});
