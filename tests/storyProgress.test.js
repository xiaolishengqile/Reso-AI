import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import {
  STORY_PROGRESS_KEY,
  advanceStoryProgress,
  completeStoryProgress,
  createStoryProgress,
  getCompletedStoryOrder,
  loadStoryProgress,
  recordStoryChoice,
  saveStoryProgress,
} from "../src/scenes/story/progress.js";

function evidence(stageId = "overtime") {
  return createEvidence({
    islandId: "office",
    stageId,
    optionId: "negotiate",
    optionText: "先协商新的安排",
    target: "joint",
    summary: "偏好共同协商",
    signals: [{ dimension: "communication", value: "collaborative", weight: 2 }],
    contextTags: ["工作"],
    pressure: "medium",
    answeredAt: 1000,
  });
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const stories = [
  { id: "office", unlockOrder: 2, unlocksOrder: 3, initialStageId: "overtime" },
  { id: "dining", unlockOrder: 3, unlocksOrder: 4, initialStageId: "restaurant-choice" },
  { id: "money", unlockOrder: 4, unlocksOrder: 5, initialStageId: "appliance-budget" },
];

test("首次选择只记录一次且保存后可以恢复", () => {
  const initial = createStoryProgress("girl", "office", "overtime");
  const once = recordStoryChoice(initial, evidence());
  const twice = recordStoryChoice(once, evidence());
  const advanced = advanceStoryProgress(twice, "partner-reply");
  const storage = memoryStorage();

  assert.equal(twice.answers.length, 1);
  assert.equal(twice.officialEvidence.length, 1);
  assert.equal(twice.companionMood, null);
  assert.equal(saveStoryProgress(storage, advanced), true);
  assert.deepEqual(
    loadStoryProgress(storage, "girl", "office", "overtime"),
    advanced,
  );
});

test("剧情进度会保存同行者情绪供刷新后恢复画面", () => {
  const selected = recordStoryChoice(
    createStoryProgress("girl", "office", "overtime"),
    { ...evidence(), companionMood: "被理解" },
  );
  const storage = memoryStorage();
  saveStoryProgress(storage, selected);

  assert.equal(selected.companionMood, "被理解");
  assert.equal(
    loadStoryProgress(storage, "girl", "office", "overtime").companionMood,
    "被理解",
  );
});

test("重玩保留首次正式证据但记录本轮答案", () => {
  const completed = completeStoryProgress(recordStoryChoice(
    createStoryProgress("boy", "office", "overtime"),
    evidence(),
  ), 2000);
  const replay = createStoryProgress("boy", "office", "overtime", completed);
  const selected = recordStoryChoice(replay, evidence("partner-reply"));

  assert.equal(replay.isReplay, true);
  assert.equal(replay.completed, false);
  assert.equal(selected.answers.length, 1);
  assert.deepEqual(selected.officialEvidence, completed.officialEvidence);
  assert.equal(selected.firstCompletedAt, 2000);
});

test("保存单岛不会覆盖同角色的其他岛屿", () => {
  const storage = memoryStorage();
  const office = completeStoryProgress(
    createStoryProgress("girl", "office", "overtime"),
    1000,
  );
  const dining = createStoryProgress("girl", "dining", "restaurant-choice");

  saveStoryProgress(storage, office);
  saveStoryProgress(storage, dining);

  assert.equal(
    loadStoryProgress(storage, "girl", "office", "overtime").firstCompletedAt,
    1000,
  );
  assert.equal(
    loadStoryProgress(storage, "girl", "dining", "restaurant-choice").firstCompletedAt,
    null,
  );
});

test("解锁顺序只接受从工作岛开始连续完成的岛屿", () => {
  const storage = memoryStorage();
  saveStoryProgress(storage, completeStoryProgress(
    createStoryProgress("boy", "office", "overtime"),
    1000,
  ));
  saveStoryProgress(storage, completeStoryProgress(
    createStoryProgress("boy", "money", "appliance-budget"),
    2000,
  ));

  assert.equal(getCompletedStoryOrder(storage, "boy", stories), 3);
});

test("损坏的总存档安全回退且保存失败返回假", () => {
  const storage = memoryStorage({ [STORY_PROGRESS_KEY]: "not-json" });
  assert.deepEqual(
    loadStoryProgress(storage, "boy", "office", "overtime"),
    createStoryProgress("boy", "office", "overtime"),
  );
  assert.equal(saveStoryProgress({ setItem() { throw new Error("quota"); } }, createStoryProgress("boy", "office", "overtime")), false);
});
