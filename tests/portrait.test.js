import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import {
  PORTRAIT_SECTION_TITLES,
  aggregatePortraitSignals,
  collectOfficialEvidence,
  createPortraitRequest,
  generateLocalPortrait,
  validatePortraitReadiness,
  validatePortraitResult,
} from "../src/profile/portrait.js";

const evidenceCounts = Object.freeze({
  mountain: 7,
  office: 6,
  dining: 6,
  cohabitation: 6,
  money: 6,
  social: 6,
  travel: 6,
  future: 6,
});

function evidence(islandId, index, config = {}) {
  return createEvidence({
    islandId,
    stageId: `${islandId}-${index}`,
    optionId: config.optionId ?? `choice-${index}`,
    optionText: config.optionText ?? `用户看见的原始选项 ${index}`,
    target: config.target ?? ["self", "partner", "joint"][index % 3],
    summary: config.summary ?? `${islandId}中的中性关系偏好 ${index}`,
    signals: config.signals ?? [{
      dimension: config.dimension ?? "communication",
      value: config.value ?? (index % 2 ? "direct" : "collaborative"),
      weight: config.weight ?? 2,
    }],
    contextTags: [islandId, "关系情境"],
    pressure: index % 3 === 0 ? "high" : "medium",
    answeredAt: 1000 + index,
  });
}

function completeInput() {
  const byIsland = Object.fromEntries(Object.entries(evidenceCounts).map(([islandId, count]) => [
    islandId,
    Array.from({ length: count }, (_, index) => evidence(islandId, index)),
  ]));
  return {
    profile: { completed: true, nickname: "旅人", mbtiType: "INFJ" },
    mountainProgress: {
      completed: true,
      firstCompletedAt: 2000,
      officialEvidence: byIsland.mountain,
    },
    storyProgress: Object.fromEntries(
      Object.entries(byIsland)
        .filter(([islandId]) => islandId !== "mountain")
        .map(([islandId, officialEvidence]) => [islandId, {
          completed: true,
          firstCompletedAt: 3000,
          officialEvidence,
        }]),
    ),
  };
}

test("只收集有效的首次正式剧情证据", () => {
  const input = completeInput();
  input.storyProgress.office.officialEvidence.push({ islandId: "office" });

  const collected = collectOfficialEvidence(input);

  assert.equal(collected.length, 49);
  assert.equal(new Set(collected.map(({ islandId }) => islandId)).size, 8);
});

test("四十九组剧情证据和雾谷资料齐全后才允许生成", () => {
  const input = completeInput();
  assert.deepEqual(validatePortraitReadiness(input), {
    ready: true,
    missing: [],
    evidenceCount: 49,
  });

  input.storyProgress.travel.officialEvidence.pop();
  const incomplete = validatePortraitReadiness(input);
  assert.equal(incomplete.ready, false);
  assert.equal(incomplete.evidenceCount, 48);
  assert.match(incomplete.missing.join("\n"), /旅行岛.*6.*5/);

  input.profile = null;
  assert.match(validatePortraitReadiness(input).missing.join("\n"), /雾谷/);
});

test("不同情境的支持偏好冲突会同时保留", () => {
  const aggregated = aggregatePortraitSignals([
    evidence("office", 1, {
      target: "partner", dimension: "emotionalSupport", value: "empathy", summary: "压力后希望先被倾听",
    }),
    evidence("cohabitation", 2, {
      target: "partner", dimension: "emotionalSupport", value: "space", summary: "疲惫时希望保留独处空间",
    }),
    evidence("travel", 3, {
      target: "partner", dimension: "emotionalSupport", value: "empathy", summary: "旅途中希望先确认感受",
    }),
  ]);

  assert.deepEqual(
    aggregated.partner.emotionalSupport.contextualValues,
    ["empathy", "space"],
  );
  assert.equal(aggregated.partner.emotionalSupport.primaryValue, "empathy");
  assert.equal(aggregated.partner.emotionalSupport.confidence, "medium");
  assert.equal(aggregated.conflicts.length, 1);
});

test("本地生成器始终输出十二个可追溯章节", () => {
  const input = completeInput();
  const evidenceList = collectOfficialEvidence(input);
  const result = generateLocalPortrait({
    profile: input.profile,
    evidence: evidenceList,
    generatedAt: 5000,
  });

  assert.equal(result.sections.length, 12);
  assert.deepEqual(result.sections.map(({ title }) => title), PORTRAIT_SECTION_TITLES);
  assert.match(result.summary, /关系|伴侣|相处/);
  assert.ok(result.sections.every(({ content }) => content.length > 0));
  assert.ok(result.sections.some(({ evidenceRefs }) => evidenceRefs.length > 0));
  assert.deepEqual(validatePortraitResult(result, evidenceList), []);
});

test("远程请求只包含聚合摘要，不泄露原始选项或存储对象", () => {
  const input = completeInput();
  const evidenceList = collectOfficialEvidence(input);
  const request = createPortraitRequest({
    profile: input.profile,
    evidence: evidenceList,
  });
  const serialized = JSON.stringify(request);

  assert.equal(request.evidenceCount, 49);
  assert.ok(request.requestId);
  assert.ok(request.aggregated.partner);
  assert.doesNotMatch(serialized, /用户看见的原始选项/);
  assert.doesNotMatch(serialized, /localStorage|storage/);
});

test("缺少固定章节、引用不存在证据或诊断性措辞的结果会被拒绝", () => {
  const input = completeInput();
  const evidenceList = collectOfficialEvidence(input);
  const valid = generateLocalPortrait({ profile: input.profile, evidence: evidenceList });

  assert.match(validatePortraitResult({ ...valid, sections: valid.sections.slice(1) }, evidenceList)[0], /十二/);
  const invalidRef = {
    ...valid,
    sections: valid.sections.map((section, index) => index === 0
      ? { ...section, evidenceRefs: ["missing/stage/choice"] }
      : section),
  };
  assert.match(validatePortraitResult(invalidRef, evidenceList).join("\n"), /不存在/);
  assert.match(validatePortraitResult({ ...valid, summary: "对方可能有人格障碍" }, evidenceList).join("\n"), /诊断/);
});
