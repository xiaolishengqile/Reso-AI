import test from "node:test";
import assert from "node:assert/strict";
import { officeStory } from "../src/scenes/office/storyContent.js";
import { diningStory } from "../src/scenes/dining/storyContent.js";
import { cohabitationStory } from "../src/scenes/cohabitation/storyContent.js";
import { moneyStory } from "../src/scenes/money/storyContent.js";
import { socialStory } from "../src/scenes/social/storyContent.js";
import { travelStory } from "../src/scenes/travel/storyContent.js";
import { futureStory } from "../src/scenes/future/storyContent.js";
import { getAllStories, getStory } from "../src/scenes/story/catalog.js";
import { getStoryStage, validateStory } from "../src/scenes/story/story.js";

const expectedStages = Object.freeze({
  office: ["overtime", "partner-reply", "work-messages", "support-style", "coworker-boundary", "relocation", "complete"],
  dining: ["restaurant-choice", "meal-rhythm", "sharing-boundary", "diet-support", "phone-repair", "payment-rule", "complete"],
  cohabitation: ["shared-space", "cleaning-standard", "mental-load", "alone-time", "sleep-rhythm", "broken-appliance", "complete"],
  money: ["appliance-budget", "expense-split", "personal-spending", "family-loan", "saving-risk", "hidden-spending", "complete"],
  social: ["leave-party", "attention-at-party", "friend-boundary", "photo-privacy", "family-criticism", "network-expectation", "complete"],
  travel: ["trip-plan", "missed-transport", "lost-route", "fatigue-support", "photo-rhythm", "travel-repair", "complete"],
  future: ["home-city", "career-move", "commitment-form", "children", "parent-care", "ordinary-decade", "complete"],
});

const stories = [
  officeStory,
  diningStory,
  cohabitationStory,
  moneyStory,
  socialStory,
  travelStory,
  futureStory,
];

test("七座后续岛各包含六组完整画像选择", () => {
  assert.equal(stories.length, 7);
  for (const story of stories) {
    assert.deepEqual(story.stages.map(({ id }) => id), expectedStages[story.id]);
    assert.equal(story.stages.filter(({ recordsEvidence }) => recordsEvidence).length, 6);
    assert.deepEqual(validateStory(story), []);
  }
  assert.equal(
    stories.flatMap(({ stages }) => stages).filter(({ recordsEvidence }) => recordsEvidence).length,
    42,
  );
});

test("每座岛都同时采集用户行为、伴侣期待和共同规则", () => {
  for (const story of stories) {
    const targets = new Set(
      story.stages.flatMap(({ choices = [] }) => choices.map(({ target }) => target)),
    );
    assert.deepEqual([...targets].sort(), ["joint", "partner", "self"]);
  }
});

test("七岛按顺序解锁且目录可以安全查询", () => {
  assert.deepEqual(stories.map(({ unlockOrder, unlocksOrder }) => [unlockOrder, unlocksOrder]), [
    [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  ]);
  assert.deepEqual(getAllStories().map(({ id }) => id), stories.map(({ id }) => id));
  assert.equal(getStory("travel"), travelStory);
  assert.equal(getStory("missing"), null);
});

test("相邻岛屿结尾通过剧情反馈自然承接", () => {
  const endings = [
    [officeStory, "relocation", /晚餐|吃饭/],
    [diningStory, "payment-rule", /留宿|回家/],
    [cohabitationStory, "broken-appliance", /费用|购买/],
    [moneyStory, "hidden-spending", /聚会|朋友|家人/],
    [socialStory, "network-expectation", /旅行|车票/],
    [travelStory, "travel-repair", /城市|未来/],
    [futureStory, "ordinary-decade", /心愿岛|雾/],
  ];
  for (const [story, stageId, pattern] of endings) {
    const feedback = getStoryStage(story, stageId).choices.map(({ feedback }) => feedback).join("\n");
    assert.match(feedback, pattern);
  }
});

test("旅行岛与爬山危机错开，未来岛允许诚实面对根本分歧", () => {
  assert.match(getStoryStage(travelStory, "missed-transport").prompt, /错过/);
  assert.doesNotMatch(JSON.stringify(travelStory), /生死|悬崖|失温/);
  assert.match(getStoryStage(futureStory, "children").choices.map(({ text }) => text).join("\n"), /无法折中|底线/);
});
