import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game/createGame.js";

test("爬山地点交给独立剧情，家庭和工作地点保留入口面板", () => {
  assert.equal(game.getLocationSceneType({ id: "mountain" }), "mountain-story");
  assert.equal(game.getLocationSceneType({ id: "home" }), "dialog");
  assert.equal(game.getLocationSceneType({ id: "office" }), "dialog");
});

test("只有点击地点与玩家附近地点相同时才允许进入", () => {
  const mountain = { id: "mountain", name: "爬山岛" };
  const office = { id: "office", name: "工作岛" };

  assert.equal(game.getLocationInteraction(mountain, mountain).canEnter, true);
  assert.equal(game.getLocationInteraction(office, mountain).canEnter, false);
  assert.equal(game.getLocationInteraction(mountain, null).canEnter, false);
});

test("未解锁岛屿不能自动前往或进入", () => {
  const office = { id: "office", name: "工作岛" };
  const interaction = game.getLocationInteraction(office, office, false);

  assert.deepEqual(interaction, {
    canEnter: false,
    canApproach: false,
    message: "工作岛尚未解锁，请先完成爬山。",
  });
});

test("只命中鼠标范围内最近的地标", () => {
  const locations = [
    { id: "mountain", x: 100, z: 100, hitRadius: 40 },
    { id: "forest", x: 240, z: 100, hitRadius: 30 },
  ];

  assert.equal(
    game.findLocationAtPoint({ x: 115, z: 100 }, locations)?.id,
    "mountain",
  );
  assert.equal(game.findLocationAtPoint({ x: 180, z: 100 }, locations), null);
});

test("底图加载失败时错误提示优先且持久显示", () => {
  assert.equal(
    game.getExplorationStatus({
      backgroundFailed: true,
      nearbyLocation: { name: "云脊山" },
    }),
    "手绘地图底图加载失败，请刷新页面重试。",
  );
});

test("单张岛屿素材失败时会指出具体地点", () => {
  assert.equal(
    game.getExplorationStatus({
      backgroundFailed: true,
      failedAssetName: "工作岛",
    }),
    "“工作岛”素材加载失败，请刷新页面重试。",
  );
});

test("底图失败后普通点击提示不能覆盖错误", () => {
  assert.deepEqual(
    game.resolveStatusUpdate({
      backgroundFailed: true,
      message: "那里是云海，旅人无法抵达。",
      now: 100,
      lockMilliseconds: 1300,
    }),
    {
      message: "手绘地图底图加载失败，请刷新页面重试。",
      lockedUntil: Number.POSITIVE_INFINITY,
    },
  );
});
