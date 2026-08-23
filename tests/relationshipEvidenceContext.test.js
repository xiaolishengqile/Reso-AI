import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import {
  MANUAL_ISLAND_IDS,
  MOUNTAIN_STAGE_IDS,
  createIcebreakerContext,
  createPersonalManualContext,
} from "../src/relationshipTools/evidenceContext.js";

function evidence(islandId, stageId, optionId, answeredAt) {
  return createEvidence({
    islandId,
    stageId,
    optionId,
    optionText: `${islandId}-${stageId} 的选项文字`,
    target: "self",
    summary: `${islandId}-${stageId} 的中性摘要`,
    signals: [{ dimension: "communication", value: optionId, weight: 2 }],
    contextTags: [islandId],
    pressure: "medium",
    answeredAt,
  });
}

function completeMountain() {
  const options = ["planned", "empathize", "support", "protect", "hug", "secure", "build"];
  return {
    firstCompletedAt: 9000,
    completed: true,
    isReplay: false,
    officialEvidence: [...MOUNTAIN_STAGE_IDS].reverse().map((stageId, reverseIndex) => {
      const index = MOUNTAIN_STAGE_IDS.indexOf(stageId);
      return evidence("mountain", stageId, options[index], 1000 + reverseIndex);
    }),
  };
}

function completeStory(islandId) {
  return {
    islandId,
    firstCompletedAt: 12000,
    completed: false,
    officialEvidence: [
      evidence(islandId, `${islandId}-first`, "joint", 11000),
      evidence(islandId, `${islandId}-second`, "space", 11001),
    ],
  };
}

test("爬山首次完成时间和七组正式证据共同决定入口资格", () => {
  const mountainProgress = completeMountain();
  const icebreaker = createIcebreakerContext({
    characterId: "girl",
    mountainProgress,
    profile: { nickname: "小雾", message: "不得发送" },
  });
  const manual = createPersonalManualContext({
    characterId: "girl",
    mountainProgress,
    storyProgress: {},
  });

  assert.equal(icebreaker.request.evidence.length, 7);
  assert.equal(icebreaker.request.travelerNickname, "小雾");
  assert.equal("message" in icebreaker.request, false);
  assert.deepEqual(manual.completedIslands, ["mountain"]);
  assert.equal(createIcebreakerContext({
    characterId: "girl",
    mountainProgress: { ...mountainProgress, firstCompletedAt: null },
  }), null);
  assert.equal(createPersonalManualContext({
    characterId: "girl",
    mountainProgress: { ...mountainProgress, officialEvidence: [] },
    storyProgress: {},
  }), null);
});

test("未完成的爬山进度即使带有七组证据也不能显示破冰入口", () => {
  const mountainProgress = {
    ...completeMountain(),
    completed: false,
    isReplay: false,
  };

  assert.equal(createIcebreakerContext({
    characterId: "girl",
    mountainProgress,
  }), null);
});

test("请求只投影白名单字段并按正式顺序排列", () => {
  const context = createPersonalManualContext({
    characterId: "boy",
    mountainProgress: completeMountain(),
    storyProgress: { office: completeStory("office") },
    profile: { nickname: "云行", mbtiType: "INFJ", message: "不发送" },
  });

  assert.deepEqual(context.completedIslands, ["mountain", "office"]);
  assert.equal(context.request.travelerNickname, "云行");
  assert.deepEqual(context.request.evidence.map(({ islandId }) => islandId), [
    ...Array(7).fill("mountain"),
    "office",
    "office",
  ]);
  assert.deepEqual(Object.keys(context.request.evidence[0]).sort(), [
    "answeredAt", "contextTags", "evidenceRef", "islandId", "optionId",
    "optionText", "pressure", "signals", "stageId", "summary",
  ]);
  assert.equal("target" in context.request.evidence[0], false);
  assert.deepEqual(MANUAL_ISLAND_IDS, [
    "mountain", "office", "dining", "cohabitation", "money", "social", "travel", "future",
  ]);
});

test("新增剧情证据只改变个人说明书签名", () => {
  const mountainProgress = completeMountain();
  const icebreakerBefore = createIcebreakerContext({ characterId: "girl", mountainProgress });
  const manualBefore = createPersonalManualContext({ characterId: "girl", mountainProgress, storyProgress: {} });
  const icebreakerAfter = createIcebreakerContext({ characterId: "girl", mountainProgress });
  const manualAfter = createPersonalManualContext({
    characterId: "girl",
    mountainProgress,
    storyProgress: { office: completeStory("office") },
  });

  assert.equal(icebreakerBefore.signature, icebreakerAfter.signature);
  assert.notEqual(manualBefore.signature, manualAfter.signature);
});

test("未首次完成的剧情岛不进入说明书请求", () => {
  const incompleteOffice = { ...completeStory("office"), firstCompletedAt: null, completed: true };
  const context = createPersonalManualContext({
    characterId: "girl",
    mountainProgress: completeMountain(),
    storyProgress: { office: incompleteOffice },
  });
  assert.deepEqual(context.completedIslands, ["mountain"]);
  assert.equal(context.request.evidence.length, 7);
});

test("重玩形成的非正式证据不会进入说明书请求", () => {
  const office = completeStory("office");
  office.officialEvidence.push(createEvidence({
    ...evidence("office", "replay-only", "changed", 13000),
    official: false,
  }));
  const context = createPersonalManualContext({
    characterId: "girl",
    mountainProgress: completeMountain(),
    storyProgress: { office },
  });
  assert.equal(context.request.evidence.some(({ stageId }) => stageId === "replay-only"), false);
});

test("非正式爬山证据不会解锁关系反馈工具", () => {
  const mountainProgress = completeMountain();
  mountainProgress.officialEvidence[0] = {
    ...mountainProgress.officialEvidence[0],
    official: false,
  };
  assert.equal(createIcebreakerContext({
    characterId: "girl",
    mountainProgress,
  }), null);
});
