import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import {
  ICEBREAKER_CACHE_KEY,
  ICEBREAKER_STAGE_IDS,
  createIcebreakerContext,
  loadIcebreakerCache,
  saveIcebreakerCache,
  validateIcebreakerResult,
} from "../src/icebreaker/icebreakerData.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

const validText = [
  "系统先替你筛掉只看表面热闹、却忽略相处节奏的人。",
  "你和云舟都喜欢山野，但真正难得的是压力来时仍能彼此理解。",
  "如果暴雨突至、路线受阻，你们会先确认安全，再重新安排计划。",
  "你偶尔沉默，他也可能急着解决问题，这种碰撞容易让双方紧绷。",
  "不过他愿意先问你的感受，再说明自己的判断，并用行动修复误会。",
  "这样的关系不是永远顺利，而是在变化里依然让人感到被看见、被托住。",
  "如果你也愿意，我们可以从一次轻松的散步聊起，不必急着定义答案。",
].join("");

function completeProgress() {
  return {
    firstCompletedAt: 9000,
    completed: false,
    officialEvidence: [...ICEBREAKER_STAGE_IDS].reverse().map((stageId, index) => createEvidence({
      islandId: "mountain",
      stageId,
      optionId: `choice-${index}`,
      optionText: `第 ${index + 1} 个回答`,
      target: "self",
      summary: `第 ${index + 1} 个中性摘要`,
      signals: [{ dimension: "repair", value: `value-${index}`, weight: 2 }],
      contextTags: ["mountain"],
      pressure: "medium",
      answeredAt: 1000 + index,
    })),
  };
}

test("首次完成时间和七组正式证据共同决定破冰入口资格", () => {
  assert.equal(createIcebreakerContext({ progress: { ...completeProgress(), firstCompletedAt: null } }), null);
  assert.equal(createIcebreakerContext({ progress: { ...completeProgress(), officialEvidence: [] } }), null);
  assert.equal(createIcebreakerContext({ progress: completeProgress() }).request.evidence.length, 7);
});

test("非正式证据不能获得破冰入口资格", () => {
  const progress = completeProgress();
  progress.officialEvidence[0] = { ...progress.officialEvidence[0], official: false };
  assert.equal(createIcebreakerContext({ progress }), null);
});

test("重温状态仍按固定阶段顺序生成最小请求和稳定签名", () => {
  const context = createIcebreakerContext({
    progress: completeProgress(),
    profile: { nickname: "小雾", message: "不应发送", mbtiType: "INFJ" },
  });
  assert.deepEqual(context.request.evidence.map(({ stageId }) => stageId), ICEBREAKER_STAGE_IDS);
  assert.equal(context.request.travelerNickname, "小雾");
  assert.equal("message" in context.request, false);
  assert.match(context.signature, /^invitation\//);
});

test("只接受昵称有效且正文为一百五十至二百五十字的结果", () => {
  assert.deepEqual(validateIcebreakerResult({ virtualMatchName: "云舟", icebreaker: validText }), []);
  assert.deepEqual(validateIcebreakerResult({ virtualMatchName: "云·舟", icebreaker: validText }), []);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "", icebreaker: validText }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "Cloud", icebreaker: validText }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "··", icebreaker: validText }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "云··舟", icebreaker: validText }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "云·A", icebreaker: validText }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "云舟", icebreaker: "太短" }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "云舟", icebreaker: "A".repeat(180) }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "云舟", icebreaker: `${validText.slice(0, 160)}\u2028分段` }).length > 0);
  assert.ok(validateIcebreakerResult({ virtualMatchName: "云舟", icebreaker: `${validText.slice(0, 160)}\u2029分段` }).length > 0);
  assert.ok(validateIcebreakerResult({
    virtualMatchName: "云舟",
    icebreaker: `${validText.slice(0, 160)}这说明你患有焦虑症`,
  }).length > 0);
  assert.ok(validateIcebreakerResult({
    virtualMatchName: "云舟",
    icebreaker: `${validText.slice(0, 160)}系统推断你的性取向`,
  }).length > 0);
});

test("缓存只在答案签名一致时恢复", () => {
  const storage = memoryStorage();
  const result = {
    virtualMatchName: "云舟",
    icebreaker: validText,
  };
  assert.equal(saveIcebreakerCache(storage, "signature-a", result, 3000), true);
  assert.deepEqual(loadIcebreakerCache(storage, "signature-a"), { ...result, generatedAt: 3000 });
  assert.equal(loadIcebreakerCache(storage, "signature-b"), null);
  assert.ok(storage.getItem(ICEBREAKER_CACHE_KEY));
});
