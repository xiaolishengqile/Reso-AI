import test from "node:test";
import assert from "node:assert/strict";
import { getAllStories } from "../src/scenes/story/catalog.js";
import {
  createStoryTravel,
  getStoryMap,
  getStoryStop,
  getStoryTravelFrame,
} from "../src/scenes/story/storyMap.js";

test("七座剧情岛都有独立地图和六个问题地点", () => {
  const maps = getAllStories().map(({ id }) => getStoryMap(id));

  assert.equal(maps.length, 7);
  for (const map of maps) {
    assert.ok(map);
    assert.match(map.assetUrl, new RegExp(`/assets/story-maps/${map.id}\\.png$`));
    assert.equal(map.stops.length, 6);
    assert.ok(map.entry.x < map.stops[0].x);
    assert.ok(map.exit.x > map.stops.at(-1).x);
    assert.equal(Object.isFrozen(map), true);
  }
});

test("未知岛屿没有地图配置", () => {
  assert.equal(getStoryMap("unknown"), null);
});

test("剧情阶段按顺序映射到路线地点并让尾声位于出口", () => {
  const story = getAllStories().find(({ id }) => id === "office");
  const map = getStoryMap("office");

  assert.deepEqual(getStoryStop(story, story.stages[0].id), map.stops[0]);
  assert.deepEqual(getStoryStop(story, story.stages[5].id), map.stops[5]);
  assert.deepEqual(getStoryStop(story, "complete"), map.exit);
  assert.deepEqual(getStoryStop(story, "missing"), map.entry);
});

test("岛内移动在开始、中点和结束位置保持连续并夹紧进度", () => {
  const travel = createStoryTravel(
    { x: 0.1, y: 0.8 },
    { x: 0.7, y: 0.4 },
    1000,
    1200,
  );

  assert.deepEqual(getStoryTravelFrame(travel, 500), {
    progress: 0,
    position: { x: 0.1, y: 0.8 },
    arrived: false,
  });
  const middle = getStoryTravelFrame(travel, 1600);
  assert.equal(middle.progress, 0.5);
  assert.ok(Math.abs(middle.position.x - 0.4) < 0.000001);
  assert.ok(Math.abs(middle.position.y - 0.6) < 0.000001);
  assert.equal(middle.arrived, false);
  assert.deepEqual(getStoryTravelFrame(travel, 2400), {
    progress: 1,
    position: { x: 0.7, y: 0.4 },
    arrived: true,
  });
});
