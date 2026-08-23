import test from "node:test";
import assert from "node:assert/strict";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

const validInput = Object.freeze({
  characterId: "girl",
  city: "杭州",
  minAge: 25,
  maxAge: 32,
  relationshipGoal: "steady",
  distancePreference: "same-city",
  priorities: ["stable-work", "financially-independent", "no-smoking"],
  note: "遇到问题愿意沟通",
});

test("轻量现实期待会规范化字段并限制年龄与最多三项条件", async () => {
  const module = await import("../src/profile/partnerPreferences.js").catch(() => ({}));

  assert.equal(typeof module.validatePartnerPreferences, "function");
  const valid = module.validatePartnerPreferences({
    characterId: "girl",
    city: "  杭州  ",
    minAge: "25",
    maxAge: "32",
    relationshipGoal: "steady",
    distancePreference: "same-city",
    priorities: ["stable-work", "financially-independent", "no-smoking"],
    note: "  遇到问题愿意沟通  ",
  });

  assert.deepEqual(valid.value, {
    characterId: "girl",
    city: "杭州",
    minAge: 25,
    maxAge: 32,
    relationshipGoal: "steady",
    distancePreference: "same-city",
    priorities: ["stable-work", "financially-independent", "no-smoking"],
    note: "遇到问题愿意沟通",
  });
  assert.equal(valid.valid, true);

  assert.equal(module.validatePartnerPreferences({
    ...valid.value,
    minAge: 17,
    maxAge: 15,
    priorities: ["stable-work", "no-smoking", "light-drinking", "responsible"],
  }).valid, false);
});

test("男女角色的现实期待可以分别保存、恢复和修改", async () => {
  const module = await import("../src/profile/partnerPreferences.js");

  assert.equal(typeof module.createPartnerPreferences, "function");
  assert.equal(typeof module.savePartnerPreferences, "function");
  assert.equal(typeof module.loadPartnerPreferences, "function");
  const storage = memoryStorage();
  const preferences = module.createPartnerPreferences(validInput, 5000);

  assert.equal(module.savePartnerPreferences(storage, preferences), true);
  assert.deepEqual(module.loadPartnerPreferences(storage, "girl"), {
    version: 1,
    ...validInput,
    savedAt: 5000,
  });
  assert.equal(module.loadPartnerPreferences(storage, "boy"), null);

  const boyPreferences = module.createPartnerPreferences({
    ...validInput,
    characterId: "boy",
    city: "北京",
  }, 5500);
  assert.equal(module.savePartnerPreferences(storage, boyPreferences), true);
  assert.equal(module.loadPartnerPreferences(storage, "girl").city, "杭州");
  assert.equal(module.loadPartnerPreferences(storage, "boy").city, "北京");

  const modified = module.createPartnerPreferences({
    ...validInput,
    city: "上海",
    priorities: ["regular-schedule"],
  }, 6000);
  assert.equal(module.savePartnerPreferences(storage, modified), true);
  assert.equal(module.loadPartnerPreferences(storage, "girl").city, "上海");
  assert.equal(module.loadPartnerPreferences(storage, "boy").city, "北京");
});

test("损坏的旧现实期待不会阻止用户保存新内容", async () => {
  const module = await import("../src/profile/partnerPreferences.js");
  const storage = memoryStorage({
    [module.PARTNER_PREFERENCES_KEY]: "{broken",
  });
  const preferences = module.createPartnerPreferences(validInput, 7000);

  assert.equal(module.savePartnerPreferences(storage, preferences), true);
  assert.equal(module.loadPartnerPreferences(storage, "girl").city, "杭州");
});
