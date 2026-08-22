import test from "node:test";
import assert from "node:assert/strict";
import {
  MOUNTAIN_STAGES,
  getCompanionCharacterId,
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
