import test from "node:test";
import assert from "node:assert/strict";
import { getAllStories } from "../src/scenes/story/catalog.js";
import { getSceneController, resolveSavedUnlockOrder } from "../src/app/sceneRouting.js";

test("雾谷、爬山、七岛共用剧情和心愿岛会分发到正确控制器", () => {
  const controllers = {
    home: { id: "home-controller" },
    mountain: { id: "mountain-controller" },
    story: { id: "story-controller" },
    wish: { id: "wish-controller" },
  };

  assert.equal(getSceneController("home", controllers), controllers.home);
  assert.equal(getSceneController("mountain", controllers), controllers.mountain);
  assert.equal(getSceneController("office", controllers), controllers.story);
  assert.equal(getSceneController("future", controllers), controllers.story);
  assert.equal(getSceneController("wish", controllers), controllers.wish);
  assert.equal(getSceneController("unknown", controllers), null);
});

test("没有完成爬山时后方伪造完成记录不能跳级", () => {
  const storyProgress = Object.fromEntries(getAllStories().map(({ id }) => [
    id,
    { firstCompletedAt: 1000 },
  ]));

  assert.equal(resolveSavedUnlockOrder({
    mountainProgress: { completed: false, firstCompletedAt: null },
    storyProgress,
  }), undefined);
});

test("只恢复从工作岛开始连续完成的解锁顺序", () => {
  const stories = getAllStories();
  const storyProgress = {
    office: { firstCompletedAt: 1000 },
    dining: { firstCompletedAt: 1100 },
    money: { firstCompletedAt: 1200 },
    future: { firstCompletedAt: 1300 },
  };

  assert.equal(resolveSavedUnlockOrder({
    mountainProgress: { completed: true, firstCompletedAt: 900 },
    storyProgress,
    stories,
  }), 4);

  for (const story of stories) storyProgress[story.id] = { firstCompletedAt: 2000 };
  assert.equal(resolveSavedUnlockOrder({
    mountainProgress: { completed: true, firstCompletedAt: 900 },
    storyProgress,
    stories,
  }), 9);
});
