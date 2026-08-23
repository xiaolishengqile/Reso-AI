import { validateEvidence } from "../profile/evidence.js";

export const ICEBREAKER_CACHE_KEY = "reso-ai.mountain-icebreaker";
export const ICEBREAKER_STAGE_IDS = Object.freeze([
  "invitation", "fatigue", "slip", "storm-thought",
  "cave-repair", "home-message", "city-realization",
]);

const CACHE_VERSION = 1;
const VIRTUAL_NAME_PATTERN = /^[\p{Script=Han}·]{2,12}$/u;
const PROHIBITED_WORDS = /人格障碍|心理疾病|抑郁症|躁郁症|精神病|有病|自恋型人格|命中注定/;

function lengthOf(value) {
  return Array.from(typeof value === "string" ? value.trim() : "").length;
}

export function validateIcebreakerResult(result) {
  const errors = [];
  if (!result || typeof result !== "object") return ["破冰结果必须是对象"];
  if (!VIRTUAL_NAME_PATTERN.test(typeof result.virtualMatchName === "string" ? result.virtualMatchName.trim() : "")) {
    errors.push("虚拟昵称需要二至十二个中文字符");
  }
  const textLength = lengthOf(result.icebreaker);
  if (textLength < 150 || textLength > 250 || /[\r\n]/.test(result.icebreaker ?? "")) {
    errors.push("破冰话术需要一百五十至二百五十字的单段文字");
  }
  if (PROHIBITED_WORDS.test(result.icebreaker ?? "")) errors.push("破冰话术包含不允许的诊断或保证性措辞");
  return errors;
}

export function createIcebreakerContext({ progress, profile = null } = {}) {
  if (!Number.isFinite(progress?.firstCompletedAt)) return null;
  const byStage = new Map((progress.officialEvidence ?? []).map((item) => [item.stageId, item]));
  const evidence = ICEBREAKER_STAGE_IDS.map((stageId) => byStage.get(stageId));
  if (evidence.some((item) => !item || item.islandId !== "mountain" || validateEvidence(item).length > 0)) {
    return null;
  }
  const requestEvidence = evidence.map((item) => ({
    stageId: item.stageId,
    optionId: item.optionId,
    optionText: item.optionText,
    summary: item.summary,
    signals: item.signals.map(({ dimension, value, weight }) => ({ dimension, value, weight })),
    contextTags: [...item.contextTags],
    pressure: item.pressure,
  }));
  return {
    signature: evidence.map((item) => `${item.stageId}/${item.optionId}@${item.answeredAt}`).join("|"),
    request: {
      protocolVersion: 1,
      travelerNickname: typeof profile?.nickname === "string" ? profile.nickname.trim() : "",
      evidence: requestEvidence,
    },
  };
}

export function loadIcebreakerCache(storage, signature) {
  try {
    const cache = JSON.parse(storage?.getItem?.(ICEBREAKER_CACHE_KEY) ?? "null");
    if (cache?.version !== CACHE_VERSION || cache.signature !== signature) return null;
    const result = {
      virtualMatchName: cache.virtualMatchName,
      icebreaker: cache.icebreaker,
      generatedAt: cache.generatedAt,
    };
    return validateIcebreakerResult(result).length === 0 && Number.isFinite(result.generatedAt)
      ? result
      : null;
  } catch {
    return null;
  }
}

export function saveIcebreakerCache(storage, signature, result, now = Date.now()) {
  try {
    if (!storage?.setItem || validateIcebreakerResult(result).length > 0) return false;
    storage.setItem(ICEBREAKER_CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      signature,
      virtualMatchName: result.virtualMatchName.trim(),
      icebreaker: result.icebreaker.trim(),
      generatedAt: now,
    }));
    return true;
  } catch {
    return false;
  }
}
