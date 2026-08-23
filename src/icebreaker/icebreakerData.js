import { validateEvidence } from "../profile/evidence.js";

export const ICEBREAKER_CACHE_KEY = "reso-ai.mountain-icebreaker";
export const ICEBREAKER_STAGE_IDS = Object.freeze([
  "invitation", "fatigue", "slip", "storm-thought",
  "cave-repair", "home-message", "city-realization",
]);

const CACHE_VERSION = 1;
const VIRTUAL_NAME_PATTERN = /^\p{Unified_Ideograph}+(?:·\p{Unified_Ideograph}+)*$/u;
const PROHIBITED_WORDS = /人格障碍|心理疾病|焦虑症|抑郁症|躁郁症|双相情感障碍|精神病|强迫症|创伤后应激障碍|有病|自恋型人格|性取向|同性恋|异性恋|宗教信仰|政治立场|种族|民族|残疾|病史|命中注定/u;
const DIAGNOSIS_CLAIM_PATTERN = /(?:患有|确诊(?:为|患有)?|被诊断为|诊断为)[^，。！？；]{0,24}(?:症|病|障碍|综合征)|(?:需要|应该)[^，。！？；]{0,8}(?:接受|进行)[^，。！？；]{0,8}(?:治疗|用药|就医)/u;
const SENSITIVE_INFERENCE_PATTERN = /(?:看出|推断|判断|说明|表明|证明|意味着)[^，。！？；]{0,24}(?:你|用户|对方)[^，。！？；]{0,8}(?:(?:是|属于)[^，。！？；]{0,12}(?:族|教徒|性恋)|信奉[^，。！？；]{0,12}教|(?:的)?性取向)|(?:你|用户|对方)(?:(?:是|属于)[^，。！？；]{0,12}(?:族|教徒|性恋)|信奉[^，。！？；]{0,12}教|(?:的)?(?:民族|宗教信仰|性取向)[^，。！？；]{0,8}(?:是|为|属于|信奉))/u;
const SENSITIVE_ATTRIBUTE_CLAIM_PATTERN = /(?:你|用户|对方|他|她|此人|该用户|这位(?:用户|旅人))[^，。！？；]{0,4}(?:(?:有|患(?:有)?|是|属于)[^，。！？；]{0,16}(?:(?:症|病|综合征|障碍)(?:倾向)?|(?:性恋|性向)(?:倾向)?|教徒|信徒|穆斯林)|信(?:奉)?[^，。！？；]{1,12}(?:教|宗教))/u;
const PARAGRAPH_SEPARATOR_PATTERN = /[\r\n\u2028\u2029]/u;

function lengthOf(value) {
  return Array.from(typeof value === "string" ? value.trim() : "").length;
}

export function validateSafeChineseText(value, minimum, maximum) {
  const text = typeof value === "string" ? value.trim() : "";
  const characters = Array.from(text);
  const hanCount = characters.filter((character) => /\p{Unified_Ideograph}/u.test(character)).length;
  const meaningfulCount = characters.filter((character) => !/\s/u.test(character)).length;
  const errors = [];
  if (
    characters.length < minimum
    || characters.length > maximum
    || PARAGRAPH_SEPARATOR_PATTERN.test(value ?? "")
  ) {
    errors.push(`文字需要${minimum}至${maximum}字且保持单段`);
  }
  if (meaningfulCount === 0 || hanCount / meaningfulCount < 0.6) {
    errors.push("文字需要以有意义的中文为主");
  }
  if (
    PROHIBITED_WORDS.test(text)
    || DIAGNOSIS_CLAIM_PATTERN.test(text)
    || SENSITIVE_INFERENCE_PATTERN.test(text)
    || SENSITIVE_ATTRIBUTE_CLAIM_PATTERN.test(text)
  ) errors.push("文字包含不允许的诊断、敏感属性或保证性措辞");
  return errors;
}

export function validateIcebreakerResult(result) {
  const errors = [];
  if (!result || typeof result !== "object") return ["破冰结果必须是对象"];
  const name = typeof result.virtualMatchName === "string" ? result.virtualMatchName.trim() : "";
  if (lengthOf(name) < 2 || lengthOf(name) > 12 || !VIRTUAL_NAME_PATTERN.test(name)) {
    errors.push("虚拟昵称需要二至十二个中文字符");
  }
  errors.push(...validateSafeChineseText(result.icebreaker, 150, 250));
  return errors;
}

export function createIcebreakerContext({ progress, profile = null } = {}) {
  if (!Number.isFinite(progress?.firstCompletedAt)) return null;
  const byStage = new Map((progress.officialEvidence ?? []).map((item) => [item.stageId, item]));
  const evidence = ICEBREAKER_STAGE_IDS.map((stageId) => byStage.get(stageId));
  if (evidence.some((item) => !item || item.official !== true || item.islandId !== "mountain" || validateEvidence(item).length > 0)) {
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
