const CHARACTER_IDS = new Set(["boy", "girl"]);
const RELATIONSHIP_GOALS = new Set(["steady", "marriage", "companionship", "natural"]);
const DISTANCE_PREFERENCES = new Set(["same-city", "short-term", "long-term", "flexible"]);
const PRIORITIES = new Set([
  "stable-work",
  "financially-independent",
  "no-smoking",
  "light-drinking",
  "regular-schedule",
  "family-plan-compatible",
  "responsible",
  "none",
]);

export const PARTNER_PREFERENCES_KEY = "reso-ai.partner-preferences";
const PREFERENCES_VERSION = 1;
const STORE_VERSION = 1;
const RELATIONSHIP_LABELS = Object.freeze({
  steady: "稳定恋爱",
  marriage: "以结婚为目标",
  companionship: "长期陪伴",
  natural: "顺其自然",
});
const DISTANCE_LABELS = Object.freeze({
  "same-city": "只考虑同城",
  "short-term": "可以接受短期异地",
  "long-term": "可以接受长期异地",
  flexible: "地点不是问题",
});
const PRIORITY_LABELS = Object.freeze({
  "stable-work": "工作相对稳定",
  "financially-independent": "经济上能够独立",
  "no-smoking": "不吸烟",
  "light-drinking": "很少饮酒",
  "regular-schedule": "作息比较规律",
  "family-plan-compatible": "婚育想法接近",
  responsible: "有责任感",
  none: "没有特别限制",
});

function normalizeAge(value) {
  if (value === "" || value === null || value === undefined) return null;
  const age = Number(value);
  return Number.isInteger(age) ? age : Number.NaN;
}

export function validatePartnerPreferences(input = {}) {
  input = input && typeof input === "object" ? input : {};
  const value = {
    characterId: typeof input.characterId === "string" ? input.characterId : "",
    city: typeof input.city === "string" ? input.city.trim() : "",
    minAge: normalizeAge(input.minAge),
    maxAge: normalizeAge(input.maxAge),
    relationshipGoal: typeof input.relationshipGoal === "string" ? input.relationshipGoal : "",
    distancePreference: typeof input.distancePreference === "string" ? input.distancePreference : "",
    priorities: [...new Set(Array.isArray(input.priorities) ? input.priorities : [])]
      .filter((item) => typeof item === "string"),
    note: typeof input.note === "string" ? input.note.trim() : "",
  };
  const errors = {};

  if (!CHARACTER_IDS.has(value.characterId)) errors.characterId = "玩家角色无效";
  if (value.city.length > 20) errors.city = "城市不能超过 20 个字符";
  const hasOneAge = value.minAge === null !== (value.maxAge === null);
  const agesInvalid = [value.minAge, value.maxAge]
    .filter((age) => age !== null)
    .some((age) => !Number.isInteger(age) || age < 18 || age > 80);
  if (hasOneAge || agesInvalid || (value.minAge !== null && value.minAge > value.maxAge)) {
    errors.age = "年龄范围需要填写 18—80 岁的有效区间";
  }
  if (!RELATIONSHIP_GOALS.has(value.relationshipGoal)) errors.relationshipGoal = "请选择关系期待";
  if (!DISTANCE_PREFERENCES.has(value.distancePreference)) errors.distancePreference = "请选择异地接受程度";
  if (value.priorities.some((item) => !PRIORITIES.has(item)) || value.priorities.length > 3) {
    errors.priorities = "现实条件最多选择三项";
  } else if (value.priorities.includes("none") && value.priorities.length > 1) {
    errors.priorities = "没有特别限制不能与其他条件同时选择";
  }
  if (value.note.length > 50) errors.note = "补充期待不能超过 50 个字符";

  return { value, errors, valid: Object.keys(errors).length === 0 };
}

export function createPartnerPreferences(input, now = Date.now()) {
  const validation = validatePartnerPreferences(input);
  if (!validation.valid) throw new Error("现实期待不完整或包含无效内容");
  return {
    version: PREFERENCES_VERSION,
    ...validation.value,
    savedAt: now,
  };
}

function isValidPreferences(preferences) {
  return Boolean(
    preferences
    && preferences.version === PREFERENCES_VERSION
    && validatePartnerPreferences(preferences).valid
    && Number.isFinite(preferences.savedAt),
  );
}

function readPreferenceStore(storage) {
  try {
    const stored = storage?.getItem?.(PARTNER_PREFERENCES_KEY);
    if (!stored) return { version: STORE_VERSION, players: {} };

    const parsed = JSON.parse(stored);
    if (parsed?.version === STORE_VERSION && parsed.players && typeof parsed.players === "object") {
      return parsed;
    }

    // 兼容首版只保存单个角色的数据，下一次保存时自动迁移。
    if (isValidPreferences(parsed)) {
      return {
        version: STORE_VERSION,
        players: { [parsed.characterId]: parsed },
      };
    }
  } catch {
    // 损坏存档按空数据处理，允许用户重新填写并覆盖。
  }

  return { version: STORE_VERSION, players: {} };
}

export function loadPartnerPreferences(storage, characterId) {
  try {
    const preferences = readPreferenceStore(storage).players[characterId];
    return isValidPreferences(preferences) && preferences.characterId === characterId
      ? preferences
      : null;
  } catch {
    return null;
  }
}

export function savePartnerPreferences(storage, preferences) {
  try {
    if (!storage?.setItem || !isValidPreferences(preferences)) return false;
    const current = readPreferenceStore(storage);
    storage.setItem(PARTNER_PREFERENCES_KEY, JSON.stringify({
      version: STORE_VERSION,
      players: {
        ...current.players,
        [preferences.characterId]: preferences,
      },
    }));
    return true;
  } catch {
    return false;
  }
}

export function describePartnerPreferences(preferences, characterId = preferences?.characterId) {
  const validation = validatePartnerPreferences(preferences);
  if (!validation.valid || validation.value.characterId !== characterId) return null;
  const value = validation.value;
  return {
    recommendedGender: characterId === "boy" ? "女性" : "男性",
    city: value.city || "地点不限",
    ageRange: value.minAge === null ? "年龄不限" : `${value.minAge}—${value.maxAge} 岁`,
    relationshipGoal: RELATIONSHIP_LABELS[value.relationshipGoal],
    distancePreference: DISTANCE_LABELS[value.distancePreference],
    priorities: value.priorities.map((item) => PRIORITY_LABELS[item]),
    note: value.note,
  };
}
