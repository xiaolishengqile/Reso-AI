import test from "node:test";
import assert from "node:assert/strict";
import {
  MOUNTAIN_PROGRESS_KEY,
  advanceMountainProgress,
  completeMountainProgress,
  createMountainProgress,
  loadMountainProgress,
  recordMountainSelection,
  saveMountainProgress,
} from "../src/scenes/mountain/progress.js";

const evidenceStage = {
  id: "invitation",
  recordsEvidence: true,
  scene: "cafe",
};
const actionStage = {
  id: "storm-action",
  recordsEvidence: false,
  scene: "cliff",
};
const option = {
  id: "planned",
  text: "先确认天气和路线",
  analysis: "偏好可控的冒险",
  dimensions: ["规划意识", "风险偏好"],
};

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

test("首次选择只生成一条正式画像证据", () => {
  const initial = createMountainProgress("boy");
  const once = recordMountainSelection(initial, evidenceStage, option, {
    elapsedMs: 800,
    companionMood: "expectant",
    answeredAt: 1000,
  });
  const twice = recordMountainSelection(once, evidenceStage, option, {
    elapsedMs: 900,
    companionMood: "expectant",
    answeredAt: 1100,
  });

  assert.equal(twice.officialEvidence.length, 1);
  assert.equal(twice.answers.length, 1);
  assert.deepEqual(twice.officialEvidence[0], {
    island: "mountain",
    stageId: "invitation",
    optionId: "planned",
    optionText: "先确认天气和路线",
    analysis: "偏好可控的冒险",
    dimensions: ["规划意识", "风险偏好"],
    companionMood: "expectant",
    elapsedMs: 800,
    answeredAt: 1000,
    confidence: "low",
  });
});

test("重复游玩不会覆盖首次正式画像证据", () => {
  const completed = completeMountainProgress(recordMountainSelection(
    createMountainProgress("girl"),
    evidenceStage,
    option,
    { elapsedMs: 500, companionMood: "calm", answeredAt: 2000 },
  ));
  const replay = createMountainProgress("girl", completed);
  const selected = recordMountainSelection(replay, evidenceStage, option, {
    elapsedMs: 600,
    companionMood: "expectant",
    answeredAt: 3000,
  });

  assert.equal(selected.isReplay, true);
  assert.deepEqual(selected.officialEvidence, completed.officialEvidence);
  assert.equal(selected.answers.length, 1);
});

test("行动选择只记录行动标识，不生成正式画像证据", () => {
  const selected = recordMountainSelection(
    createMountainProgress("boy"),
    actionStage,
    { id: "shelter", text: "寻找避雨处" },
    {},
  );

  assert.equal(selected.actionId, "shelter");
  assert.deepEqual(selected.officialEvidence, []);
  assert.deepEqual(selected.answers, []);
});

test("推进与完成保留不可变进度状态", () => {
  const initial = createMountainProgress("girl");
  const advanced = advanceMountainProgress(initial, "fatigue");
  const completed = completeMountainProgress(advanced);

  assert.equal(initial.currentStageId, "invitation");
  assert.equal(advanced.currentStageId, "fatigue");
  assert.equal(completed.completed, true);
});

test("损坏、版本不匹配或角色不匹配的存档会回退为初始进度", () => {
  for (const stored of [
    "not-json",
    JSON.stringify({ version: 99, characterId: "boy" }),
    JSON.stringify({ version: 1, characterId: "girl" }),
  ]) {
    const loaded = loadMountainProgress(memoryStorage({ [MOUNTAIN_PROGRESS_KEY]: stored }), "boy");
    assert.deepEqual(loaded, createMountainProgress("boy"));
  }
});

test("保存和恢复有效进度，并在存储失败时返回 false", () => {
  const storage = memoryStorage();
  const progress = completeMountainProgress(advanceMountainProgress(
    createMountainProgress("boy"),
    "fatigue",
  ));

  assert.equal(saveMountainProgress(storage, progress), true);
  assert.deepEqual(loadMountainProgress(storage, "boy"), progress);
  assert.equal(saveMountainProgress({ setItem() { throw new Error("quota"); } }, progress), false);
  assert.equal(saveMountainProgress(null, progress), false);
});
