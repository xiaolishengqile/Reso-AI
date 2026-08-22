import test from "node:test";
import assert from "node:assert/strict";
import {
  HOME_STAGES,
  getElderChoice,
  getHomeStage,
  validateHomeStory,
} from "../src/scenes/home/story.js";

test("雾谷剧情包含开场、四条老人回应和旅人记录", () => {
  assert.deepEqual(HOME_STAGES.map(({ id }) => id), [
    "arrival",
    "elder-intro",
    "elder-choice",
    "elder-response",
    "traveler-record",
    "complete",
  ]);
  assert.deepEqual(
    getHomeStage("elder-choice").choices.map(({ id }) => id),
    ["A", "B", "C", "D"],
  );
  assert.equal(validateHomeStory().length, 0);
});

test("四个选择都有玩家对白、分析和完整老人回应", () => {
  for (const id of ["A", "B", "C", "D"]) {
    const choice = getElderChoice(id);
    assert.ok(choice.playerLines.length > 0);
    assert.ok(choice.analysis.length > 0);
    assert.ok(choice.response.length > 80);
  }
  assert.equal(getElderChoice("unknown"), null);
  assert.equal(getHomeStage("unknown"), null);
});

test("剧情校验会报告重复阶段、断裂跳转和不完整选择", () => {
  const broken = HOME_STAGES.map((stage) => ({ ...stage }));
  broken.push({ ...broken[0] });
  broken[1].nextStageId = "missing";
  broken[2].choices = [{ id: "A", response: "" }];

  const errors = validateHomeStory(broken);
  assert.ok(errors.some((error) => error.includes("重复")));
  assert.ok(errors.some((error) => error.includes("下一阶段")));
  assert.ok(errors.some((error) => error.includes("四个选择")));
});
