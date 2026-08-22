import test from "node:test";
import assert from "node:assert/strict";

const modulePromise = import("../src/game/journeyProgress.js").catch(() => ({}));

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test("首次进入岛屿会按角色保存到访状态且不会重复", async () => {
  const progress = await modulePromise;
  assert.equal(typeof progress.markLocationVisited, "function");
  const storage = memoryStorage();

  assert.equal(progress.markLocationVisited(storage, "girl", "dining"), true);
  assert.equal(progress.markLocationVisited(storage, "girl", "dining"), true);
  assert.deepEqual(progress.loadVisitedLocationIds(storage, "girl"), ["dining"]);
  assert.deepEqual(progress.loadVisitedLocationIds(storage, "boy"), []);
});

test("损坏的到访记录会安全回退为空列表", async () => {
  const progress = await modulePromise;
  const storage = memoryStorage();
  storage.setItem(progress.JOURNEY_VISITS_KEY, "broken");

  assert.deepEqual(progress.loadVisitedLocationIds(storage, "girl"), []);
});
