import {
  FREE_RESPONSE_OPTION_ID,
  normalizeFreeResponse,
} from "../shared/freeResponse.js";

export const TRAVELER_PROFILE_KEY = "reso-ai.traveler-profile";

export const MBTI_TYPES = Object.freeze([
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
]);

const PROFILE_VERSION = 1;
const CHOICE_ADJUSTMENTS = Object.freeze({
  A: 10,
  B: -4,
  C: -7,
  D: -12,
  [FREE_RESPONSE_OPTION_ID]: 0,
});

function scorePair(selected, first, second) {
  return selected === first
    ? { [first]: 60, [second]: 40 }
    : { [first]: 40, [second]: 60 };
}

function copyScores(scores) {
  return Object.fromEntries(
    Object.entries(scores).map(([key, pair]) => [key, { ...pair }]),
  );
}

export function validateTravelerRecord(input = {}) {
  const value = {
    nickname: typeof input.nickname === "string" ? input.nickname.trim() : "",
    message: typeof input.message === "string" ? input.message.trim() : "",
    mbtiType: typeof input.mbtiType === "string" ? input.mbtiType.trim().toUpperCase() : "",
  };
  const errors = {};

  if (!value.nickname || value.nickname.length > 20) {
    errors.nickname = "昵称需要填写 1—20 个字符";
  }
  if (!value.message || value.message.length > 80) {
    errors.message = "留言需要填写 1—80 个字符";
  }
  if (!MBTI_TYPES.includes(value.mbtiType)) {
    errors.mbtiType = "请选择有效的性格类型";
  }

  return { value, errors, valid: Object.keys(errors).length === 0 };
}

export function createMbtiBaseline(type) {
  if (!MBTI_TYPES.includes(type)) throw new Error("无效的性格类型");
  return {
    energy: scorePair(type[0], "E", "I"),
    information: scorePair(type[1], "S", "N"),
    decisions: scorePair(type[2], "T", "F"),
    lifestyle: scorePair(type[3], "J", "P"),
  };
}

export function applyFogValleyAdjustment(scores, choiceId) {
  const shift = CHOICE_ADJUSTMENTS[choiceId];
  if (typeof shift !== "number") throw new Error("无效的老人对话选择");

  const adjusted = copyScores(scores);
  adjusted.energy.E = Math.max(0, Math.min(100, scores.energy.E + shift));
  adjusted.energy.I = 100 - adjusted.energy.E;
  return adjusted;
}

export function createTravelerProfile(input, now = Date.now()) {
  const validation = validateTravelerRecord(input);
  if (!validation.valid) throw new Error("旅人记录不完整或包含无效内容");

  const shift = CHOICE_ADJUSTMENTS[input.choiceId];
  if (typeof shift !== "number") throw new Error("无效的老人对话选择");
  const analysis = typeof input.analysis === "string" ? input.analysis.trim() : "";
  if (!analysis) throw new Error("老人对话选择缺少分析");
  const freeResponse = input.choiceId === FREE_RESPONSE_OPTION_ID
    ? normalizeFreeResponse(input.freeResponse ?? analysis)
    : "";
  if (input.choiceId === FREE_RESPONSE_OPTION_ID && !freeResponse) {
    throw new Error("自由回答不能为空");
  }

  const baselineScores = createMbtiBaseline(validation.value.mbtiType);
  return {
    version: PROFILE_VERSION,
    ...validation.value,
    choiceId: input.choiceId,
    ...(freeResponse ? { freeResponse } : {}),
    baselineScores,
    scores: applyFogValleyAdjustment(baselineScores, input.choiceId),
    officialEvidence: [{
      island: "home",
      stageId: "elder-choice",
      choiceId: input.choiceId,
      adjustment: { E: shift, I: shift === 0 ? 0 : -shift },
      analysis,
      ...(freeResponse ? { responseText: freeResponse } : {}),
      confidence: "low",
      recordedAt: now,
    }],
    completed: true,
    completedAt: now,
  };
}

function isValidScores(scores) {
  return Boolean(
    scores
    && Object.values(scores).length === 4
    && Object.values(scores).every((pair) => (
      pair
      && Object.values(pair).length === 2
      && Object.values(pair).every(Number.isFinite)
      && Object.values(pair).reduce((sum, value) => sum + value, 0) === 100
    )),
  );
}

function isValidProfile(profile) {
  const record = validateTravelerRecord(profile);
  return Boolean(
    profile
    && profile.version === PROFILE_VERSION
    && record.valid
    && typeof CHOICE_ADJUSTMENTS[profile.choiceId] === "number"
    && typeof (profile.freeResponse ?? "") === "string"
    && (
      profile.choiceId !== FREE_RESPONSE_OPTION_ID
      || Boolean(normalizeFreeResponse(profile.freeResponse))
    )
    && isValidScores(profile.baselineScores)
    && isValidScores(profile.scores)
    && Array.isArray(profile.officialEvidence)
    && profile.officialEvidence.length === 1
    && typeof profile.officialEvidence[0]?.analysis === "string"
    && Boolean(profile.officialEvidence[0].analysis.trim())
    && profile.completed === true
    && Number.isFinite(profile.completedAt),
  );
}

export function loadTravelerProfile(storage) {
  try {
    const stored = storage?.getItem?.(TRAVELER_PROFILE_KEY);
    if (!stored) return null;
    const profile = JSON.parse(stored);
    return isValidProfile(profile) ? profile : null;
  } catch {
    return null;
  }
}

export function saveTravelerProfile(storage, profile) {
  try {
    if (!storage?.setItem || !isValidProfile(profile)) return false;
    const existing = loadTravelerProfile(storage);
    if (existing) return JSON.stringify(existing) === JSON.stringify(profile);
    storage.setItem(TRAVELER_PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
