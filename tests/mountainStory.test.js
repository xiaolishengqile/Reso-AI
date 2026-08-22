import test from "node:test";
import assert from "node:assert/strict";
import {
  MOUNTAIN_STAGES,
  adaptMountainText,
  getCompanionCharacterId,
  getMountainStage,
  validateMountainStory,
} from "../src/scenes/mountain/story.js";

test("男女玩家会匹配异性同行者", () => {
  assert.equal(getCompanionCharacterId("boy"), "girl");
  assert.equal(getCompanionCharacterId("girl"), "boy");
  assert.equal(getCompanionCharacterId("unknown"), null);
});

test("爬山剧情包含七组画像选择和一组非画像行动", () => {
  const evidenceStages = MOUNTAIN_STAGES.filter(({ recordsEvidence }) => recordsEvidence);
  const actionStages = MOUNTAIN_STAGES.filter(({ kind }) => kind === "action");
  assert.equal(evidenceStages.length, 7);
  assert.equal(actionStages.length, 1);
  assert.deepEqual(validateMountainStory(MOUNTAIN_STAGES), []);
});

test("剧情查询能返回已知阶段并安全处理未知阶段", () => {
  assert.equal(getMountainStage("invitation")?.title, "周末邀约");
  assert.equal(getMountainStage("missing-stage"), null);
});

test("剧情文本会按玩家性别替换同行者代词", () => {
  assert.equal(adaptMountainText("{companion}在等你。", "boy"), "她在等你。");
  assert.equal(adaptMountainText("{companion}在等你。", "girl"), "他在等你。");
});

test("剧情校验会报告关键配置错误", () => {
  const invalidStages = [
    {
      id: "duplicate",
      kind: "choice",
      recordsEvidence: true,
      dimensions: ["指标"],
      choices: [{ id: "missing-dimensions", text: "选择", analysis: "分析", dimensions: [] }],
      nextStageId: "missing",
    },
    {
      id: "duplicate",
      kind: "action",
      recordsEvidence: true,
      choices: [{ id: "action", text: "行动", analysis: "分析", dimensions: [] }],
      nextStageId: "complete",
    },
    {
      id: "complete",
      kind: "complete",
      recordsEvidence: false,
      choices: [],
      nextStageId: null,
    },
  ];

  const errors = validateMountainStory(invalidStages);
  assert.ok(errors.includes("阶段标识重复：duplicate"));
  assert.ok(errors.includes("下一阶段不存在：duplicate"));
  assert.ok(errors.includes("行动阶段不得记录证据：duplicate"));
  assert.ok(errors.includes("画像选项缺少检测指标：duplicate/missing-dimensions"));
});

test("七组画像选项都声明同行者情绪，缺失时配置校验会报错", () => {
  const evidenceChoices = MOUNTAIN_STAGES
    .filter(({ recordsEvidence }) => recordsEvidence)
    .flatMap(({ choices }) => choices);
  assert.ok(evidenceChoices.every(({ companionMood }) => companionMood));

  const invalidStage = {
    id: "missing-mood",
    kind: "choice",
    recordsEvidence: true,
    dimensions: ["指标"],
    choices: [{ id: "option", text: "选择", analysis: "分析", dimensions: ["指标"] }],
    nextStageId: "complete",
  };
  const completeStage = {
    id: "complete",
    kind: "complete",
    recordsEvidence: false,
    choices: [],
    nextStageId: null,
  };

  assert.ok(
    validateMountainStory([invalidStage, completeStage]).includes(
      "画像选项缺少同行者情绪：missing-mood/option",
    ),
  );
});
