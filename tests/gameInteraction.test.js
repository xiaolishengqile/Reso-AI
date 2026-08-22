import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game/createGame.js";

test("场景类型区分直接剧情、确认后剧情和普通入口面板", () => {
  assert.equal(game.getLocationSceneType({ entryMode: "external" }), "external");
  assert.equal(
    game.getLocationSceneType({ entryMode: "confirmed-external" }),
    "confirmed-external",
  );
  assert.equal(game.getLocationSceneType({ id: "home" }), "dialog");
  assert.equal(game.getLocationSceneType({ id: "office" }), "dialog");
  assert.equal(game.getLocationSceneType({ id: "wish", entryMode: "confirmed-external" }), "confirmed-external");
});

test("地图初始解锁顺序默认安全回退，并接受已完成爬山的恢复值", () => {
  assert.equal(game.resolveInitialUnlockedOrder(), 1);
  assert.equal(game.resolveInitialUnlockedOrder(2), 2);
  assert.equal(game.resolveInitialUnlockedOrder(9), 9);
  assert.equal(game.resolveInitialUnlockedOrder(0), 1);
});

test("重温已完成的爬山剧情仍会得到完成状态", () => {
  assert.deepEqual(
    game.resolveLocationCompletion(2, {
      unlocksOrder: 2,
      completionMessage: "爬山已完成，通往工作岛的桥已解锁。",
      replayCompletionMessage: "爬山剧情已重温完成。",
    }),
    {
      unlockedOrder: 2,
      message: "爬山剧情已重温完成。",
    },
  );
});

test("爬山场景同步打开失败会被安全捕获", () => {
  assert.equal(
    game.tryOpenExternalScene(
      () => { throw new Error("broken progress"); },
      { id: "mountain" },
      {},
    ),
    false,
  );
});

test("只有点击地点与玩家附近地点相同时才允许进入", () => {
  const mountain = { id: "mountain", name: "爬山岛" };
  const office = { id: "office", name: "工作岛" };

  assert.equal(game.getLocationInteraction(mountain, mountain).canEnter, true);
  assert.equal(game.getLocationInteraction(office, mountain).canEnter, false);
  assert.equal(game.getLocationInteraction(mountain, null).canEnter, false);
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
