import test from "node:test";
import assert from "node:assert/strict";

const resetModule = await import("../src/app/progressReset.js").catch(() => ({}));
const requestGameReset = resetModule.requestGameReset ?? (() => false);

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    removeItem(key) { values.delete(key); },
  };
}

test("确认重新开始只清除本游戏进度并重新加载页面", () => {
  const storage = memoryStorage({
    "reso-ai.traveler-profile": "profile",
    "reso-ai.home-progress": "home",
    "reso-ai.mountain-progress": "mountain",
    "reso-ai.story-progress": "stories",
    "reso-ai.journey-visits": "visits",
    "reso-ai.partner-preferences": "preferences",
    "reso-ai.relationship-tools.icebreaker": "icebreaker",
    "reso-ai.relationship-tools.personal-manual": "manual",
    "other-app.preference": "keep",
  });
  let reloadCount = 0;

  const reset = requestGameReset({
    storage,
    confirmReset: () => true,
    reload: () => { reloadCount += 1; },
  });

  assert.equal(reset, true);
  assert.equal(storage.getItem("reso-ai.traveler-profile"), null);
  assert.equal(storage.getItem("reso-ai.home-progress"), null);
  assert.equal(storage.getItem("reso-ai.mountain-progress"), null);
  assert.equal(storage.getItem("reso-ai.story-progress"), null);
  assert.equal(storage.getItem("reso-ai.journey-visits"), null);
  assert.equal(storage.getItem("reso-ai.partner-preferences"), null);
  assert.equal(storage.getItem("reso-ai.relationship-tools.icebreaker"), null);
  assert.equal(storage.getItem("reso-ai.relationship-tools.personal-manual"), null);
  assert.equal(storage.getItem("other-app.preference"), "keep");
  assert.equal(reloadCount, 1);
});

test("取消重新开始会保留进度且不重新加载页面", () => {
  const storage = memoryStorage({ "reso-ai.home-progress": "home" });
  let reloadCount = 0;

  const reset = requestGameReset({
    storage,
    confirmReset: () => false,
    reload: () => { reloadCount += 1; },
  });

  assert.equal(reset, false);
  assert.equal(storage.getItem("reso-ai.home-progress"), "home");
  assert.equal(reloadCount, 0);
});
