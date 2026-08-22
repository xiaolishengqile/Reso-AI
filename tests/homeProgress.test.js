import test from "node:test";
import assert from "node:assert/strict";
import {
  HOME_PROGRESS_KEY,
  advanceHomeProgress,
  completeHomeProgress,
  createHomeProgress,
  loadHomeProgress,
  saveHomeChoice,
  saveHomeDraft,
  saveHomeProgress,
} from "../src/scenes/home/progress.js";

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

test("首次进度从自动入谷阶段开始", () => {
  assert.deepEqual(createHomeProgress("girl"), {
    version: 1,
    characterId: "girl",
    currentStageId: "arrival",
    choiceId: null,
    draft: { nickname: "", message: "", mbtiType: "" },
    completed: false,
  });
});

test("选择、推进和记录页草稿保持不可变并可恢复", () => {
  const initial = createHomeProgress("girl");
  const chosen = saveHomeChoice(initial, "B");
  const record = advanceHomeProgress(chosen, "traveler-record");
  const drafted = saveHomeDraft(record, {
    nickname: " 小雾 ",
    message: "慢慢找到方向",
    mbtiType: "INFJ",
  });
  const storage = memoryStorage();

  assert.equal(initial.choiceId, null);
  assert.equal(saveHomeProgress(storage, drafted), true);
  assert.deepEqual(loadHomeProgress(storage, "girl"), drafted);
});

test("完成状态会保留选择和草稿", () => {
  const progress = saveHomeDraft(
    saveHomeChoice(createHomeProgress("boy"), "D"),
    { nickname: "旅人", message: "我先看看", mbtiType: "ISTJ" },
  );
  const completed = completeHomeProgress(progress);

  assert.equal(completed.completed, true);
  assert.equal(completed.choiceId, "D");
  assert.equal(completed.draft.nickname, "旅人");
});

test("损坏、未知阶段和角色不匹配的进度都会安全回到开场", () => {
  const invalidValues = [
    "not-json",
    JSON.stringify({ ...createHomeProgress("boy"), currentStageId: "missing" }),
    JSON.stringify(createHomeProgress("girl")),
  ];

  for (const value of invalidValues) {
    const storage = memoryStorage({ [HOME_PROGRESS_KEY]: value });
    assert.deepEqual(loadHomeProgress(storage, "boy"), createHomeProgress("boy"));
  }
});

test("保存失败返回 false", () => {
  const progress = createHomeProgress("boy");
  assert.equal(saveHomeProgress(null, progress), false);
  assert.equal(saveHomeProgress({ setItem() { throw new Error("quota"); } }, progress), false);
});
