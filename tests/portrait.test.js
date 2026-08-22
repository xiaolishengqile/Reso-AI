import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence, normalizeTravelerEvidence } from "../src/profile/evidence.js";
import { createTravelerProfile } from "../src/profile/travelerProfile.js";
import {
  PORTRAIT_SECTION_TITLES,
  aggregatePortraitSignals,
  collectOfficialEvidence,
  createPortraitRequest,
  generateLocalPortrait,
  validatePortraitReadiness,
  validatePortraitResult,
} from "../src/profile/portrait.js";
import { MOUNTAIN_STAGES } from "../src/scenes/mountain/storyContent.js";
import { getAllStories } from "../src/scenes/story/catalog.js";

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
  const mountainStages = MOUNTAIN_STAGES.filter(({ recordsEvidence }) => recordsEvidence);
  const stories = getAllStories();
  const byIsland = {
    mountain: mountainStages.map((stage, index) => evidenceForStage("mountain", stage, index)),
    ...Object.fromEntries(stories.map((story) => [
      story.id,
      story.stages
        .filter(({ recordsEvidence }) => recordsEvidence)
        .map((stage, index) => evidenceForStage(story.id, stage, index)),
    ])),
  };
  return {
    characterId: "girl",
    profile: createTravelerProfile({
      nickname: "旅人",
      message: "去寻找真实的相处答案",
      mbtiType: "INFJ",
      choiceId: "B",
      analysis: "礼貌接收帮助，同时保持自己的节奏与边界",
    }, 500),
    mountainProgress: {
      characterId: "girl",
      completed: true,
      firstCompletedAt: 2000,
      officialEvidence: byIsland.mountain,
    },
    storyProgress: Object.fromEntries(
      Object.entries(byIsland)
        .filter(([islandId]) => islandId !== "mountain")
        .map(([islandId, officialEvidence]) => [islandId, {
          characterId: "girl",
          islandId,
          completed: true,
          firstCompletedAt: 3000,
          officialEvidence,
        }]),
    ),
  };
}

function evidenceForStage(islandId, stage, index) {
  const option = stage.choices[index % stage.choices.length];
  return createEvidence({
    islandId,
    stageId: stage.id,
    optionId: option.id,
    optionText: option.text,
    target: option.target ?? "self",
    summary: option.summary ?? `${stage.title}中的中性关系选择`,
    signals: option.signals ?? [{
      dimension: "communication",
      value: index % 2 ? "direct" : "collaborative",
      weight: 2,
    }],
    contextTags: [islandId, stage.title],
    pressure: stage.pressure ?? (stage.id === "slip" ? "high" : "medium"),
    answeredAt: 1000 + index,
  });
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

test("未知题目、重复题目和角色串档都不能伪装成完整证据", () => {
  const unknown = completeInput();
  unknown.storyProgress.office.officialEvidence[0] = {
    ...unknown.storyProgress.office.officialEvidence[0],
    stageId: "fake-stage",
  };
  assert.match(validatePortraitReadiness(unknown).missing.join("\n"), /工作岛.*题目|工作岛.*证据/);

  const duplicate = completeInput();
  duplicate.storyProgress.dining.officialEvidence[1] = {
    ...duplicate.storyProgress.dining.officialEvidence[0],
    answeredAt: 9999,
  };
  assert.equal(validatePortraitReadiness(duplicate).ready, false);

  const mixedRole = completeInput();
  mixedRole.storyProgress.travel.characterId = "boy";
  assert.match(validatePortraitReadiness(mixedRole).missing.join("\n"), /角色|串档/);
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

test("高置信度必须来自至少三座岛且覆盖不同压力情境", () => {
  const samePressure = ["office", "cohabitation", "travel"].map((islandId, index) => (
    evidence(islandId, index + 1, {
      target: "partner", dimension: "emotionalSupport", value: "empathy", summary: "希望先被倾听",
    })
  )).map((item) => ({ ...item, pressure: "medium" }));
  assert.equal(
    aggregatePortraitSignals(samePressure).partner.emotionalSupport.confidence,
    "medium",
  );

  samePressure[2] = { ...samePressure[2], pressure: "high" };
  assert.equal(
    aggregatePortraitSignals(samePressure).partner.emotionalSupport.confidence,
    "high",
  );
});

test("本地画像优先采用跨岛聚合结论，并明确保留情境冲突", () => {
  const crossIsland = [
    evidence("office", 1, { target: "partner", dimension: "emotionalSupport", value: "empathy", weight: 1, summary: "压力后先倾听感受" }),
    evidence("cohabitation", 2, { target: "partner", dimension: "emotionalSupport", value: "empathy", weight: 1, summary: "疲惫时先确认情绪" }),
    evidence("travel", 3, { target: "partner", dimension: "emotionalSupport", value: "empathy", weight: 1, summary: "意外发生时先安抚" }),
    evidence("money", 4, { target: "partner", dimension: "emotionalSupport", value: "space", weight: 3, summary: "争执时先留独处空间" }),
  ];
  const result = generateLocalPortrait({ evidence: crossIsland, generatedAt: 5000 });

  assert.match(result.sections[3].content, /压力后先倾听感受|疲惫时先确认情绪|意外发生时先安抚/);
  assert.match(result.sections[10].content, /争执时先留独处空间/);
  assert.equal(result.sections[3].confidence, "high");
});

test("本地生成器始终输出十二个可追溯章节", () => {
  const input = completeInput();
  const evidenceList = collectOfficialEvidence(input);
  const result = generateLocalPortrait({
    profile: input.profile,
    evidence: evidenceList,
    baselineEvidence: normalizeTravelerEvidence(input.profile),
    generatedAt: 5000,
  });

  assert.equal(result.sections.length, 12);
  assert.deepEqual(result.sections.map(({ title }) => title), PORTRAIT_SECTION_TITLES);
  assert.match(result.summary, /关系|伴侣|相处/);
  assert.ok(result.sections.every(({ content }) => content.length > 0));
  assert.ok(result.sections.some(({ evidenceRefs }) => evidenceRefs.length > 0));
  assert.deepEqual(validatePortraitResult(result, {
    evidence: evidenceList,
    baselineEvidence: normalizeTravelerEvidence(input.profile),
  }), []);
});

test("远程请求只包含聚合摘要，不泄露原始选项或存储对象", () => {
  const input = completeInput();
  const evidenceList = collectOfficialEvidence(input);
  const request = createPortraitRequest({
    profile: input.profile,
    evidence: evidenceList,
    baselineEvidence: normalizeTravelerEvidence(input.profile),
  });
  const serialized = JSON.stringify(request);

  assert.equal(request.evidenceCount, 49);
  assert.ok(request.requestId);
  assert.ok(request.aggregated.partner);
  assert.equal(request.travelerBaseline.fogEvidence.islandId, "home");
  assert.equal(request.travelerBaseline.fogEvidence.confidence, "low");
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
  assert.match(validatePortraitResult({ ...valid, summary: "你有明显的救世主情结" }, evidenceList).join("\n"), /诊断/);

  const missingRefs = {
    ...valid,
    sections: valid.sections.map((section, index) => index === 0
      ? { ...section, evidenceRefs: undefined }
      : section),
  };
  assert.match(validatePortraitResult(missingRefs, evidenceList).join("\n"), /引用/);
  assert.match(validatePortraitResult({ ...valid, confidence: "certain" }, evidenceList).join("\n"), /置信度/);
});
