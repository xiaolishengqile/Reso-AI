export const ICEBREAKER_CACHE_KEY = "reso-ai.relationship-tools.icebreaker";

const CACHE_VERSION = 1;
const NAME_PATTERN = /^\p{Unified_Ideograph}+(?:·\p{Unified_Ideograph}+)*$/u;
const PROHIBITED = /人格障碍|心理疾病|焦虑症|抑郁症|躁郁症|双相情感障碍|精神病|强迫症|创伤后应激障碍|有病|自恋型人格|性取向|同性恋|异性恋|宗教信仰|政治立场|种族|民族|残疾|病史|命中注定|百分之百|完美契合|救世主情结/u;
const DIAGNOSIS_CLAIM = /(?:患有|确诊(?:为|患有)?|被诊断为|诊断为)[^，。！？；]{0,24}(?:症|病|障碍|综合征)|(?:需要|应该)[^，。！？；]{0,8}(?:接受|进行)[^，。！？；]{0,8}(?:治疗|用药|就医)/u;
const SENSITIVE_INFERENCE = /(?:看出|推断|判断|说明|表明|证明|意味着)[^，。！？；]{0,24}(?:你|用户|对方)[^，。！？；]{0,8}(?:(?:是|属于)[^，。！？；]{0,12}(?:族|教徒|性恋)|信奉[^，。！？；]{0,12}教|(?:的)?性取向)|(?:你|用户|对方)(?:(?:是|属于)[^，。！？；]{0,12}(?:族|教徒|性恋)|信奉[^，。！？；]{0,12}教|(?:的)?(?:民族|宗教信仰|性取向)[^，。！？；]{0,8}(?:是|为|属于|信奉))/u;
const SENSITIVE_ATTRIBUTE_CLAIM = /(?:你|用户|对方|他|她|此人|该用户|这位(?:用户|旅人))[^，。！？；]{0,4}(?:(?:有|患(?:有)?|是|属于)[^，。！？；]{0,16}(?:(?:症|病|综合征|障碍)(?:倾向)?|(?:性恋|性向)(?:倾向)?|教徒|信徒|穆斯林)|信(?:奉)?[^，。！？；]{1,12}(?:教|宗教))/u;
const PARAGRAPH_SEPARATOR = /[\r\n\u2028\u2029]/u;

function codePointLength(value) {
  return Array.from(typeof value === "string" ? value.trim() : "").length;
}

export function validateSafeChineseText(value, minimum, maximum) {
  const errors = [];
  const text = typeof value === "string" ? value.trim() : "";
  const characters = Array.from(text);
  const hanCount = characters.filter((character) => /\p{Unified_Ideograph}/u.test(character)).length;
  const meaningfulCount = characters.filter((character) => !/\s/u.test(character)).length;
  if (
    characters.length < minimum
    || characters.length > maximum
    || PARAGRAPH_SEPARATOR.test(value ?? "")
  ) {
    errors.push(`文字需要${minimum}至${maximum}字且保持单段`);
  }
  if (meaningfulCount === 0 || hanCount / meaningfulCount < 0.6) {
    errors.push("文字需要以有意义的中文为主");
  }
  if (
    PROHIBITED.test(text)
    || DIAGNOSIS_CLAIM.test(text)
    || SENSITIVE_INFERENCE.test(text)
    || SENSITIVE_ATTRIBUTE_CLAIM.test(text)
  ) errors.push("文字包含不允许的诊断、敏感属性或保证性措辞");
  return errors;
}

export function validateIcebreakerResult(result) {
  if (!result || typeof result !== "object") return ["破冰结果必须是对象"];
  const errors = [];
  const name = typeof result.virtualMatchName === "string" ? result.virtualMatchName.trim() : "";
  const nameLength = codePointLength(name);
  if (nameLength < 2 || nameLength > 12 || !NAME_PATTERN.test(name)) {
    errors.push("虚拟昵称需要二至十二个中文字符");
  }
  errors.push(...validateSafeChineseText(result.icebreaker, 150, 250));
  return errors;
}

function loadStore(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(ICEBREAKER_CACHE_KEY) ?? "null");
    return parsed?.version === CACHE_VERSION && parsed.players && typeof parsed.players === "object"
      ? parsed
      : { version: CACHE_VERSION, players: {} };
  } catch {
    return { version: CACHE_VERSION, players: {} };
  }
}

export function loadIcebreakerCache(storage, characterId, evidenceSignature) {
  const cached = loadStore(storage).players?.[characterId];
  if (
    cached?.evidenceSignature !== evidenceSignature
    || !Number.isFinite(cached.generatedAt)
    || validateIcebreakerResult(cached).length > 0
  ) return null;
  return {
    virtualMatchName: cached.virtualMatchName,
    icebreaker: cached.icebreaker,
    generatedAt: cached.generatedAt,
    model: typeof cached.model === "string" ? cached.model : "",
  };
}

export function saveIcebreakerCache(
  storage,
  characterId,
  evidenceSignature,
  result,
  generatedAt = Date.now(),
  model = "",
) {
  try {
    if (
      !storage?.setItem
      || typeof characterId !== "string"
      || !characterId
      || typeof evidenceSignature !== "string"
      || !evidenceSignature
      || !Number.isFinite(generatedAt)
      || validateIcebreakerResult(result).length > 0
    ) return false;
    const store = loadStore(storage);
    storage.setItem(ICEBREAKER_CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      players: {
        ...store.players,
        [characterId]: {
          evidenceSignature,
          virtualMatchName: result.virtualMatchName.trim(),
          icebreaker: result.icebreaker.trim(),
          generatedAt,
          model,
        },
      },
    }));
    return true;
  } catch {
    return false;
  }
}
