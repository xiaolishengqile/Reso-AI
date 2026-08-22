import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptStoryText,
  createChoice,
  getStoryStage,
  validateStory,
} from "../src/scenes/story/story.js";

function validStory() {
  const ids = ["one", "two", "three", "four", "five", "six"];
  return {
    id: "office",
    title: "工作岛",
    unlockOrder: 2,
    unlocksOrder: 3,
    initialStageId: "one",
    theme: { sky: "#9cc", ground: "#596", accent: "#f4c" },
    contextTags: ["工作"],
    stages: [
      ...ids.map((id, index) => ({
        id,
        kind: "choice",
        title: `阶段${index + 1}`,
        narration: "事情自然发生了。",
        prompt: "你会怎么做？",
        recordsEvidence: true,
        pressure: "medium",
        nextStageId: ids[index + 1] ?? "complete",
        choices: ["a", "b", "c"].map((choiceId) => createChoice(
          choiceId,
          `选择${choiceId}`,
          "伴侣回应后，下一件事因此发生。",
          {
            target: "self",
            summary: "中性行为摘要",
            signals: [{ dimension: "communication", value: choiceId, weight: 1 }],
            companionMood: "平静",
          },
        )),
      })),
      {
        id: "complete",
        kind: "complete",
        title: "结束",
        narration: "旅程完成。",
        prompt: "",
        recordsEvidence: false,
        nextStageId: null,
        choices: [],
      },
    ],
  };
}

test("通用剧情要求六组证据、局部反馈和可达完成阶段", () => {
  const story = validStory();
  assert.deepEqual(validateStory(story), []);
  assert.equal(getStoryStage(story, "three").title, "阶段3");
  assert.equal(getStoryStage(story, "missing"), null);
});

test("缺少证据对象、信号或反馈会明确报错", () => {
  const story = validStory();
  story.stages[0].choices[0].target = "";
  story.stages[0].choices[0].feedback = "";
  story.stages[1].choices[0].signals = [];

  const errors = validateStory(story).join("\n");
  assert.match(errors, /证据对象/);
  assert.match(errors, /局部反馈/);
  assert.match(errors, /画像信号/);
});

test("断裂跳转、重复阶段和错误题数会被拒绝", () => {
  const story = validStory();
  story.stages[1].id = "one";
  story.stages[2].nextStageId = "missing";
  story.stages[5].recordsEvidence = false;

  const errors = validateStory(story).join("\n");
  assert.match(errors, /阶段标识重复/);
  assert.match(errors, /下一阶段不存在/);
  assert.match(errors, /必须恰好包含六组正式选择/);
});

test("剧情文本按玩家角色替换同行者称谓", () => {
  assert.equal(adaptStoryText("{companion}在等你。", "boy"), "她在等你。");
  assert.equal(adaptStoryText("{companion}在等你。", "girl"), "他在等你。");
  assert.equal(adaptStoryText("原文", "unknown"), "原文");
});
