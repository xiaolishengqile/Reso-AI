import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvidence,
  normalizeEvidence,
  normalizeTravelerEvidence,
  validateEvidence,
} from "../src/profile/evidence.js";

test("统一证据保留对象、情境和分类信号", () => {
  const evidence = createEvidence({
    islandId: "office",
    stageId: "overtime",
    optionId: "negotiate",
    optionText: "先说明情况，再一起调整计划。",
    target: "joint",
    summary: "偏好先透明沟通再协商安排",
    signals: [{ dimension: "communication", value: "collaborative", weight: 2 }],
    contextTags: ["工作", "时间冲突"],
    pressure: "medium",
    companionMood: "被重视",
    elapsedMs: 800,
    answeredAt: 1000,
  });

  assert.equal(validateEvidence(evidence).length, 0);
  assert.equal(evidence.version, 1);
  assert.equal(evidence.target, "joint");
  assert.deepEqual(evidence.signals, [
    { dimension: "communication", value: "collaborative", weight: 2 },
  ]);
});

test("非法证据对象和分类信号会被拒绝", () => {
  const evidence = createEvidence({
    islandId: "office",
    stageId: "overtime",
    optionId: "wait",
    optionText: "先等等。",
    target: "unknown",
    summary: "暂缓处理",
    signals: [{ dimension: "communication", value: "pause", weight: 5 }],
    contextTags: [],
    pressure: "low",
    answeredAt: 1000,
  });

  assert.deepEqual(validateEvidence(evidence), [
    "证据对象无效",
    "画像信号权重无效：communication",
  ]);
});

test("旧爬山证据可以无损补齐统一字段", () => {
  const migrated = normalizeEvidence(
    {
      island: "mountain",
      stageId: "fatigue",
      optionId: "solve",
      optionText: "先看地图",
      analysis: "压力下先处理现实问题",
      dimensions: ["问题解决"],
      answeredAt: 1000,
    },
    { target: "self", summary: "压力下先处理现实问题" },
  );

  assert.equal(migrated.islandId, "mountain");
  assert.equal(migrated.optionText, "先看地图");
  assert.deepEqual(migrated.signals, [
    { dimension: "问题解决", value: "observed", weight: 1 },
  ]);
  assert.equal(validateEvidence(migrated).length, 0);
});

test("现有雾谷老人证据可以纳入统一画像输入", () => {
  const normalized = normalizeTravelerEvidence({
    choiceId: "B",
    officialEvidence: [{
      island: "home",
      stageId: "elder-choice",
      choiceId: "B",
      analysis: "礼貌并保持距离",
      confidence: "low",
      recordedAt: 1000,
    }],
  });

  assert.equal(normalized.islandId, "home");
  assert.equal(normalized.target, "self");
  assert.deepEqual(normalized.signals, [
    { dimension: "socialApproach", value: "polite-distance", weight: 1 },
  ]);
  assert.equal(validateEvidence(normalized).length, 0);
});
