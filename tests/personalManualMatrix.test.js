import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import { MANUAL_VARIABLE_IDS } from "../src/personalManual/data.js";
import { resolveFixedManualVariables } from "../src/personalManual/matrix.js";

const STAGE_TIMES = Object.freeze({
  fatigue: 1000,
  slip: 2000,
  "storm-thought": 3000,
  "cave-repair": 4000,
  "home-message": 5000,
  "city-realization": 6000,
});

function evidence(stageId, optionId) {
  return createEvidence({
    islandId: "mountain",
    stageId,
    optionId,
    optionText: "测试选择",
    target: "self",
    summary: "中性测试摘要",
    signals: [{ dimension: "stressResponse", value: optionId, weight: 2 }],
    contextTags: ["爬山"],
    pressure: "high",
    answeredAt: STAGE_TIMES[stageId],
  });
}

function completeEvidence(overrides = {}) {
  const choices = {
    fatigue: "empathize",
    slip: "support",
    "storm-thought": "protect",
    "cave-repair": "hug",
    "home-message": "secure",
    "city-realization": "build",
    ...overrides,
  };
  return Object.entries(choices).map(([stageId, optionId]) => evidence(stageId, optionId));
}

function byId(variables, id) {
  return variables.find((item) => item.id === id);
}

test("第 3 题锁定防御本能，第 2 题补充三种压力沟通起点", () => {
  const reactions = {
    command: "危机中倾向用指令接管局面的行动者",
    support: "默默行动的实干者",
    freeze: "高刺激下需要缓冲的敏感反应者",
  };
  for (const [slip, expectedName] of Object.entries(reactions)) {
    const variants = ["solve", "empathize", "blame"].map((fatigue) => (
      resolveFixedManualVariables([
        evidence("fatigue", fatigue),
        evidence("slip", slip),
      ])
    ));
    assert.deepEqual(variants.map((items) => items[0].name), Array(3).fill(expectedName));
    assert.equal(new Set(variants.map((items) => items[1].description)).size, 3);
    assert.deepEqual(variants[0].map(({ id }) => id), [
      "crisisInstinct",
      "involuntaryReaction",
    ]);
  }
});

test("完整标准七题按最终规则固定九个变量", () => {
  const variables = resolveFixedManualVariables(completeEvidence());
  assert.deepEqual(variables.map(({ id }) => id), MANUAL_VARIABLE_IDS);
  assert.match(byId(variables, "incompatiblePattern").name, /安全|感受/);
  assert.match(byId(variables, "repairAction").name, /拥抱|陪伴/);
  assert.match(byId(variables, "lifeVision").name, /城市扎根|长期家园/);
  assert.doesNotMatch(JSON.stringify(variables), /救世主情结|心理边界崩塌|疯子|拖油瓶|暴君|冷血/);
});

test("红牌禁区依次优先匹配焦虑、理性和共情规则", () => {
  const anxious = resolveFixedManualVariables(completeEvidence({
    fatigue: "blame",
    "home-message": "anxious",
  }));
  assert.match(byId(anxious, "incompatiblePattern").name, /撤退|冷处理/);

  const rational = resolveFixedManualVariables(completeEvidence({
    fatigue: "solve",
    "home-message": "secure",
  }));
  assert.match(byId(rational, "incompatiblePattern").name, /推卸责任/);

  const empathic = resolveFixedManualVariables(completeEvidence({
    fatigue: "empathize",
    "home-message": "avoid",
  }));
  assert.match(byId(empathic, "incompatiblePattern").name, /目标|安全|感受/);
});

test("防御沟通选甩锅且未命中前三条时按危机价值观中性组合", () => {
  for (const storm of ["finish", "extreme", "retreat", "protect"]) {
    const variables = resolveFixedManualVariables(completeEvidence({
      fatigue: "blame",
      "storm-thought": storm,
      "home-message": "secure",
    }));
    assert.deepEqual(variables.slice(2, 5).map(({ id }) => id), [
      "incompatiblePattern",
      "possibleMisreading",
      "negativeFeeling",
    ]);
    assert.ok(variables.slice(2, 5).every(({ confidence }) => confidence === "中"));
  }
});

test("修复动作优先于亲密距离信号并覆盖三种补给方案", () => {
  const spaceWins = resolveFixedManualVariables(completeEvidence({
    "cave-repair": "space",
    "home-message": "anxious",
  }));
  assert.match(byId(spaceWins, "recoveryNeed").name, /缓冲空间/);

  const hugWins = resolveFixedManualVariables(completeEvidence({
    "cave-repair": "hug",
    "home-message": "avoid",
  }));
  assert.match(byId(hugWins, "recoveryNeed").name, /连接|肯定/);

  const balanced = resolveFixedManualVariables(completeEvidence({
    "cave-repair": "lecture",
    "home-message": "secure",
  }));
  assert.match(byId(balanced, "repairAction").name, /确认安全|平等复盘/);
});

test("第 7 题直接锁定三种人生航向", () => {
  const expected = {
    build: /城市扎根|长期家园/,
    enjoy: /当下|真实体验/,
    roam: /流动|自由探索/,
  };
  for (const [optionId, pattern] of Object.entries(expected)) {
    const variables = resolveFixedManualVariables(completeEvidence({
      "city-realization": optionId,
    }));
    assert.match(byId(variables, "lifeVision").name, pattern);
  }
});

test("自由回答只取消受影响的固定变量组", () => {
  const freeSlip = resolveFixedManualVariables(completeEvidence({ slip: "free-response" }));
  assert.equal(byId(freeSlip, "crisisInstinct"), undefined);
  assert.equal(byId(freeSlip, "involuntaryReaction"), undefined);
  assert.ok(byId(freeSlip, "lifeVision"));

  const freeFuture = resolveFixedManualVariables(completeEvidence({
    "city-realization": "free-response",
  }));
  assert.equal(byId(freeFuture, "lifeVision"), undefined);
  assert.ok(byId(freeFuture, "repairAction"));
});
