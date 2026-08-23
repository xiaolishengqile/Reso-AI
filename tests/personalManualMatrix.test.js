import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import { resolveFixedManualVariables } from "../src/personalManual/matrix.js";

const CASES = [
  ["solve", "command", "理性主导的危机掌控者"],
  ["solve", "support", "务实的行动守护者"],
  ["solve", "freeze", "理性先行、极压下需要缓冲"],
  ["empathize", "command", "共情但危机时会强势接管"],
  ["empathize", "support", "温柔而可靠的托底者"],
  ["empathize", "freeze", "高敏感共情、极压下易过载"],
  ["blame", "command", "恐惧下以控制保护自己"],
  ["blame", "support", "嘴硬但会行动托底"],
  ["blame", "freeze", "高刺激下先自我保护"],
];

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
    answeredAt: stageId === "fatigue" ? 1000 : 2000,
  });
}

test("第 2、3 题的九种标准组合固定变量一和二", () => {
  for (const [fatigue, slip, expectedName] of CASES) {
    const variables = resolveFixedManualVariables([
      evidence("fatigue", fatigue),
      evidence("slip", slip),
    ]);
    assert.equal(variables.length, 2);
    assert.equal(variables[0].id, "crisisInstinct");
    assert.equal(variables[0].name, expectedName);
    assert.equal(variables[1].id, "involuntaryReaction");
    assert.deepEqual(variables[0].evidenceRefs, [
      `mountain/fatigue/${fatigue}@1000`,
      `mountain/slip/${slip}@2000`,
    ]);
  }
});

test("自由回答或证据缺失时不套用固定九宫格", () => {
  assert.equal(resolveFixedManualVariables([
    evidence("fatigue", "free-response"),
    evidence("slip", "support"),
  ]), null);
  assert.equal(resolveFixedManualVariables([evidence("fatigue", "solve")]), null);
});
