import test from "node:test";
import assert from "node:assert/strict";
import {
  ICEBREAKER_CACHE_KEY,
  loadIcebreakerCache,
  saveIcebreakerCache,
  validateIcebreakerResult,
} from "../src/icebreaker/data.js";
import {
  MANUAL_SECTION_IDS,
  MANUAL_VARIABLE_IDS,
  PERSONAL_MANUAL_CACHE_KEY,
  getPersonalManualState,
  savePersonalManualCache,
  validatePersonalManualResult,
} from "../src/personalManual/data.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

function validIcebreaker() {
  return {
    virtualMatchName: "云舟",
    icebreaker: "看到你在山路压力里仍会先确认安全，也愿意在风雨过后认真修复关系，我想和你从一次不赶时间的散步聊起。我们可以分享各自在计划被打乱时最需要的支持，也可以坦白哪些时刻更想安静缓冲。不必急着证明默契，只要保持好奇，尊重彼此节奏，再一起选一个舒服的小目标。也许是一顿热饭、一段城市夜路，或者下一次出发前共同列好的清单，让了解慢慢发生，也让每一次回应都真实可接住。",
  };
}

function validManual(refs = ["mountain/fatigue/empathize@1000"]) {
  const sectionTitles = [
    "表层标签与深层关系需求",
    "极限压力下的防御本能",
    "冲突与需要避开的模式",
    "合适的冲突修复与支持蓝图",
    "人生愿景与关系方向",
  ];
  return {
    variables: MANUAL_VARIABLE_IDS.map((id, index) => ({
      id,
      name: `关系变量${index + 1}`,
      description: "当前证据显示一种可以继续被后续旅程验证的关系倾向。",
      confidence: index < 2 ? "高" : "中",
      evidenceRefs: refs,
    })),
    sections: MANUAL_SECTION_IDS.map((id, index) => ({
      id,
      title: sectionTitles[index],
      content: "这部分把已确认的变量整理成中性、可读且不作心理诊断的关系说明。",
      confidence: "中",
      evidenceCount: refs.length,
    })),
    updateSummary: "初版融合爬山岛证据。",
  };
}

test("破冰结果限制虚拟昵称、单段字数和危险措辞", () => {
  const valid = validIcebreaker();
  assert.deepEqual(validateIcebreakerResult(valid), []);
  assert.ok(validateIcebreakerResult({ ...valid, virtualMatchName: "Cloud" }).length > 0);
  assert.ok(validateIcebreakerResult({ ...valid, icebreaker: "太短" }).length > 0);
  assert.ok(validateIcebreakerResult({ ...valid, icebreaker: `${valid.icebreaker}\n下一段` }).length > 0);
  assert.ok(validateIcebreakerResult({ ...valid, icebreaker: `${valid.icebreaker.slice(0, 160)}命中注定` }).length > 0);
});

test("破冰缓存按角色和证据签名隔离", () => {
  const storage = memoryStorage();
  const result = validIcebreaker();
  assert.equal(saveIcebreakerCache(storage, "girl", "ice-a", result, 3000, "glm-5.3"), true);
  assert.equal(loadIcebreakerCache(storage, "girl", "ice-a").generatedAt, 3000);
  assert.equal(loadIcebreakerCache(storage, "boy", "ice-a"), null);
  assert.equal(loadIcebreakerCache(storage, "girl", "ice-b"), null);
  assert.ok(storage.getItem(ICEBREAKER_CACHE_KEY));
});

test("说明书必须包含完整九变量、五章节与合法证据引用", () => {
  const allowed = new Set(["mountain/fatigue/empathize@1000"]);
  const valid = validManual([...allowed]);
  assert.deepEqual(validatePersonalManualResult(valid, allowed), []);
  assert.ok(validatePersonalManualResult({ ...valid, variables: valid.variables.slice(1) }, allowed).length > 0);
  assert.ok(validatePersonalManualResult({
    ...valid,
    variables: valid.variables.map((item, index) => index === 0
      ? { ...item, evidenceRefs: ["unknown/ref"] }
      : item),
  }, allowed).length > 0);
});

test("说明书缓存区分生成、查看和可更新状态并保留版本", () => {
  const storage = memoryStorage();
  const context = { signature: "manual-a", completedIslands: ["mountain"], evidenceCount: 7 };
  assert.equal(getPersonalManualState(storage, "girl", context).status, "generate");
  assert.equal(savePersonalManualCache(storage, "girl", context, validManual(), 1, 4000, "glm-5.3"), true);
  const current = getPersonalManualState(storage, "girl", context);
  assert.equal(current.status, "view");
  assert.equal(current.cache.revision, 1);
  const stale = getPersonalManualState(storage, "girl", {
    signature: "manual-b",
    completedIslands: ["mountain", "office"],
    evidenceCount: 13,
  });
  assert.equal(stale.status, "update");
  assert.equal(stale.cache.revision, 1);
  assert.ok(storage.getItem(PERSONAL_MANUAL_CACHE_KEY));
});

test("损坏缓存安全回退且保存异常不影响当前结果", () => {
  const storage = memoryStorage({
    [ICEBREAKER_CACHE_KEY]: "not-json",
    [PERSONAL_MANUAL_CACHE_KEY]: "not-json",
  });
  assert.equal(loadIcebreakerCache(storage, "girl", "ice-a"), null);
  assert.equal(getPersonalManualState(storage, "girl", {
    signature: "manual-a", completedIslands: ["mountain"], evidenceCount: 7,
  }).status, "generate");
  const throwing = { getItem: storage.getItem, setItem() { throw new Error("quota"); } };
  assert.equal(saveIcebreakerCache(throwing, "girl", "ice-a", validIcebreaker()), false);
  assert.equal(savePersonalManualCache(
    throwing,
    "girl",
    { signature: "manual-a", completedIslands: ["mountain"], evidenceCount: 7 },
    validManual(),
    1,
  ), false);
});
