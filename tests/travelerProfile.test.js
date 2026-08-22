import test from "node:test";
import assert from "node:assert/strict";
import {
  MBTI_TYPES,
  TRAVELER_PROFILE_KEY,
  applyFogValleyAdjustment,
  createMbtiBaseline,
  createTravelerProfile,
  loadTravelerProfile,
  saveTravelerProfile,
  validateTravelerRecord,
} from "../src/profile/travelerProfile.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("支持全部 16 种 MBTI，并生成四组 60/40 初始分", () => {
  assert.equal(MBTI_TYPES.length, 16);
  assert.deepEqual(createMbtiBaseline("ENFP"), {
    energy: { E: 60, I: 40 },
    information: { S: 40, N: 60 },
    decisions: { T: 40, F: 60 },
    lifestyle: { J: 40, P: 60 },
  });

  for (const type of MBTI_TYPES) {
    const scores = createMbtiBaseline(type);
    for (const pair of Object.values(scores)) {
      assert.equal(Object.values(pair).reduce((sum, value) => sum + value, 0), 100);
      assert.deepEqual([...Object.values(pair)].sort(), [40, 60]);
    }
  }
});

test("老人对话只调整外向/内向分数，并保持总分为 100", () => {
  const baseline = createMbtiBaseline("ENFP");
  const expected = {
    A: { E: 70, I: 30 },
    B: { E: 56, I: 44 },
    C: { E: 53, I: 47 },
    D: { E: 48, I: 52 },
  };

  for (const [choiceId, energy] of Object.entries(expected)) {
    const adjusted = applyFogValleyAdjustment(baseline, choiceId);
    assert.deepEqual(adjusted.energy, energy);
    assert.deepEqual(adjusted.information, baseline.information);
    assert.deepEqual(adjusted.decisions, baseline.decisions);
    assert.deepEqual(adjusted.lifestyle, baseline.lifestyle);
    assert.equal(adjusted.energy.E + adjusted.energy.I, 100);
  }
});

test("旅人记录要求昵称、留言和有效性格类型全部填写", () => {
  const valid = validateTravelerRecord({
    nickname: "  小雾  ",
    message: "  慢慢找到自己的方向。  ",
    mbtiType: "INFP",
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.value, {
    nickname: "小雾",
    message: "慢慢找到自己的方向。",
    mbtiType: "INFP",
  });

  const invalid = validateTravelerRecord({
    nickname: " ",
    message: "x".repeat(81),
    mbtiType: "ABCD",
  });
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), ["mbtiType", "message", "nickname"]);
});

test("创建正式旅人画像时保留基线、修正分和首次证据", () => {
  const profile = createTravelerProfile({
    nickname: "小雾",
    message: "去看看雾后面有什么。",
    mbtiType: "ISTJ",
    choiceId: "D",
  }, 1234);

  assert.equal(profile.completed, true);
  assert.equal(profile.completedAt, 1234);
  assert.deepEqual(profile.scores.energy, { E: 28, I: 72 });
  assert.deepEqual(profile.officialEvidence, [{
    island: "home",
    stageId: "elder-choice",
    choiceId: "D",
    adjustment: { E: -12, I: 12 },
    confidence: "low",
    recordedAt: 1234,
  }]);
  assert.throws(() => createTravelerProfile({
    nickname: "小雾",
    message: "你好",
    mbtiType: "ISTJ",
    choiceId: "unknown",
  }), /无效/);
});

test("首份正式画像可保存恢复，之后不能被不同画像覆盖", () => {
  const storage = memoryStorage();
  const first = createTravelerProfile({
    nickname: "小雾",
    message: "第一笔记录",
    mbtiType: "ENFP",
    choiceId: "A",
  }, 1000);
  const second = createTravelerProfile({
    nickname: "另一位旅人",
    message: "第二笔记录",
    mbtiType: "INTJ",
    choiceId: "D",
  }, 2000);

  assert.equal(saveTravelerProfile(storage, first), true);
  assert.deepEqual(loadTravelerProfile(storage), first);
  assert.equal(saveTravelerProfile(storage, first), true);
  assert.equal(saveTravelerProfile(storage, second), false);
  assert.deepEqual(loadTravelerProfile(storage), first);
  assert.equal(saveTravelerProfile({ setItem() { throw new Error("quota"); } }, first), false);
  assert.equal(loadTravelerProfile(memoryStorage({ [TRAVELER_PROFILE_KEY]: "broken" })), null);
});
