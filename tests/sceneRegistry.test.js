import test from "node:test";
import assert from "node:assert/strict";
import { LOCATIONS } from "../src/config/world.js";

async function loadRegistry() {
  let registry;
  await assert.doesNotReject(async () => {
    registry = await import("../src/scenes/registry.js");
  });
  return registry;
}

test("地图地点会由各自场景模块补充业务信息", async () => {
  const registry = await loadRegistry();
  const mapLocations = LOCATIONS;

  const locations = registry.createSceneLocations(mapLocations);

  assert.deepEqual(
    locations.map(({ id, name }) => ({ id, name })),
    [
      { id: "home", name: "雾谷入口" },
      { id: "mountain", name: "爬山岛" },
      { id: "office", name: "工作岛" },
      { id: "dining", name: "吃饭岛" },
      { id: "cohabitation", name: "同居岛" },
      { id: "money", name: "金钱岛" },
      { id: "social", name: "社交岛" },
      { id: "travel", name: "旅行岛" },
      { id: "future", name: "未来岛" },
      { id: "wish", name: "心愿岛" },
    ],
  );
  assert.equal(locations[1].entryLabel, "进入爬山剧情");
  assert.equal(locations[2].entryLabel, "进入工作岛剧情");
  assert.equal(locations[9].entryLabel, "查看心仪对象画像");
  assert.equal(LOCATIONS[0].name, undefined);
  assert.equal(Object.isFrozen(locations), true);
  assert.equal(Object.isFrozen(locations[0]), true);
});

test("场景注册表拒绝没有实现的地图地点", async () => {
  const registry = await loadRegistry();

  assert.throws(
    () => registry.createSceneLocations([{ id: "unknown", x: 0, z: 0 }]),
    /未注册场景：unknown/,
  );
});

test("图例状态区分可前往、已到访和已完成", async () => {
  const registry = await loadRegistry();
  const home = registry.getScene("home");
  const mountain = registry.getScene("mountain");
  const office = registry.getScene("office");
  const future = registry.getScene("future");
  const wish = registry.getScene("wish");

  assert.equal(registry.getSceneLegendState(home, {}), "旅程起点");
  assert.equal(registry.getSceneLegendState(mountain, {}), "已解锁");
  assert.equal(registry.getSceneLegendState(mountain, { visited: true }), "已到访");
  assert.equal(registry.getSceneLegendState(mountain, { completed: true }), "已完成");
  assert.equal(registry.getSceneLegendState(office, {}), "已解锁");
  assert.equal(registry.getSceneLegendState(future, { completed: true }), "已完成");
  assert.equal(registry.getSceneLegendState(wish, {}), "画像生成处");
});

test("探索提示明确十岛均已开放", async () => {
  const registry = await loadRegistry();
  const locations = registry.createSceneLocations(LOCATIONS);

  assert.equal(
    registry.getSceneJourneyStatus(locations),
    "十座岛均已开放，靠近并点击地点开始探索",
  );
});

test("地图配置只保存空间与解锁顺序而不承载场景业务", async () => {
  const registry = await loadRegistry();
  const mountainLocation = LOCATIONS.find(({ id }) => id === "mountain");
  const mountainScene = registry.getScene("mountain");

  assert.equal(mountainLocation.name, undefined);
  assert.equal(mountainLocation.sceneDescription, undefined);
  assert.equal(mountainLocation.completionLabel, undefined);
  assert.equal(mountainLocation.unlocksOrder, undefined);
  assert.equal(mountainScene.name, "爬山岛");
  assert.equal(mountainScene.entryMode, "confirmed-external");
  assert.equal(mountainScene.entryLabel, "进入爬山剧情");
  assert.equal(mountainScene.unlocksOrder, 2);
  assert.equal(mountainScene.replayCompletionMessage, "爬山剧情已重温完成。");
  assert.equal(registry.getScene("home").entryMode, "external");
});
