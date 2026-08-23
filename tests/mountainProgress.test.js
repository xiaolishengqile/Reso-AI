import test from "node:test";
import assert from "node:assert/strict";
import { validateEvidence } from "../src/profile/evidence.js";
import {
  MOUNTAIN_PROGRESS_KEY,
  advanceMountainProgress,
  completeMountainProgress,
  createMountainProgress,
  loadMountainProgress,
  recordMountainSelection,
  saveMountainProgress,
} from "../src/scenes/mountain/progress.js";
import { getMountainStage } from "../src/scenes/mountain/story.js";

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
  assert.equal(validateEvidence(twice.officialEvidence[0]).length, 0);
  assert.deepEqual(twice.officialEvidence[0].signals, [
    { dimension: "planning", value: "structured", weight: 2 },
    { dimension: "risk", value: "cautious", weight: 1 },
  ]);
  assert.doesNotMatch(twice.officialEvidence[0].summary, /极度|狂热|救世主|推卸责任/);
  assert.equal(twice.officialEvidence[0].target, "self");
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
  const completed = completeMountainProgress(advanced, 3000);

  assert.equal(initial.currentStageId, "invitation");
  assert.equal(advanced.currentStageId, "fatigue");
  assert.equal(completed.completed, true);
  assert.equal(completed.firstCompletedAt, 3000);
  assert.equal(completed.completedAt, 3000);
});

test("第四题四个预设回答都能记录证据并推进到岩洞", () => {
  const stage = getMountainStage("storm-thought");
  const recordedOptionIds = stage.choices.map((choice, index) => {
    const selected = recordMountainSelection(
      createMountainProgress("girl"),
      stage,
      choice,
      { answeredAt: 2000 + index },
    );
    const advanced = advanceMountainProgress(selected, stage.nextStageId);

    assert.equal(validateEvidence(selected.officialEvidence[0]).length, 0);
    assert.equal(advanced.currentStageId, "cave-repair");
    return selected.officialEvidence[0].optionId;
  });

  assert.deepEqual(recordedOptionIds, ["finish", "extreme", "retreat", "protect"]);
});

test("重玩中刷新仍保留首次通关时间，不会重新锁住后续岛屿", () => {
  const storage = memoryStorage();
  const completed = completeMountainProgress(createMountainProgress("girl"), 2000);
  const replay = createMountainProgress("girl", completed);

  assert.equal(replay.completed, false);
  assert.equal(replay.firstCompletedAt, 2000);
  assert.equal(saveMountainProgress(storage, replay), true);
  assert.equal(loadMountainProgress(storage, "girl").firstCompletedAt, 2000);
});

test("旧版已完成存档会迁移首次完成时间并替换带评价的旧证据", () => {
  const stage = getMountainStage("storm-thought");
  const choice = stage.choices.find(({ id }) => id === "finish");
  const oldProgress = {
    version: 1,
    characterId: "boy",
    currentStageId: "complete",
    currentAnswer: choice.id,
    answers: [{ stageId: stage.id, optionId: choice.id }],
    officialEvidence: [{
      islandId: "mountain",
      stageId: stage.id,
      optionId: choice.id,
      optionText: choice.text,
      target: "self",
      summary: choice.analysis,
      signals: choice.dimensions.map((dimension) => ({ dimension, value: "observed", weight: 1 })),
      contextTags: [stage.scene],
      pressure: "high",
      companionMood: choice.companionMood,
      elapsedMs: 100,
      answeredAt: 1800,
      official: true,
    }],
    actionId: null,
    isReplay: false,
    completed: true,
  };

  const loaded = loadMountainProgress(memoryStorage({
    [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(oldProgress),
  }), "boy");

  assert.equal(loaded.version, 2);
  assert.equal(loaded.firstCompletedAt, 1800);
  assert.doesNotMatch(loaded.officialEvidence[0].summary, /秩序狂热/);
  assert.notEqual(loaded.officialEvidence[0].signals[0].value, "observed");
});

test("旧版存档已经进入重玩时，迁移后仍保留首次通关资格", () => {
  const stages = [
    "invitation",
    "fatigue",
    "slip",
    "storm-thought",
    "cave-repair",
    "home-message",
    "city-realization",
  ].map(getMountainStage);
  const officialEvidence = stages.map((stage, index) => {
    const choice = stage.choices[0];
    return recordMountainSelection(
      createMountainProgress("boy"),
      stage,
      choice,
      { answeredAt: 1000 + index },
    ).officialEvidence[0];
  });
  const oldReplay = {
    version: 1,
    characterId: "boy",
    currentStageId: "fatigue",
    currentAnswer: null,
    answers: [{ stageId: "invitation", optionId: "planned" }],
    officialEvidence,
    actionId: null,
    isReplay: true,
    completed: false,
  };

  const loaded = loadMountainProgress(memoryStorage({
    [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(oldReplay),
  }), "boy");

  assert.equal(loaded.completed, false);
  assert.equal(loaded.isReplay, true);
  assert.equal(loaded.firstCompletedAt, 1006);
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

test("包含损坏正式证据的存档会回退为初始进度", () => {
  const corrupted = {
    ...createMountainProgress("boy"),
    officialEvidence: [{ island: "mountain", stageId: "invitation" }],
  };
  const loaded = loadMountainProgress(
    memoryStorage({ [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(corrupted) }),
    "boy",
  );

  assert.deepEqual(loaded, createMountainProgress("boy"));
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
