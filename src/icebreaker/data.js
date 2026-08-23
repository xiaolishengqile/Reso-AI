export const ICEBREAKER_CACHE_KEY = "reso-ai.relationship-tools.icebreaker";

const CACHE_VERSION = 1;
const NAME_PATTERN = /^[\p{Script=Han}·]{2,12}$/u;
const PROHIBITED = /人格障碍|心理疾病|抑郁症|躁郁症|精神病|有病|自恋型人格|救世主情结|命中注定|百分之百|完美契合/;

function codePointLength(value) {
  return Array.from(typeof value === "string" ? value.trim() : "").length;
}

export function validateIcebreakerResult(result) {
  if (!result || typeof result !== "object") return ["破冰结果必须是对象"];
  const errors = [];
  const name = typeof result.virtualMatchName === "string"
    ? result.virtualMatchName.trim()
    : "";
  const icebreaker = typeof result.icebreaker === "string"
    ? result.icebreaker.trim()
    : "";
  if (!NAME_PATTERN.test(name)) errors.push("虚拟昵称需要二至十二个中文字符");
  const length = codePointLength(icebreaker);
  if (length < 150 || length > 250 || /[\r\n]/.test(icebreaker)) {
    errors.push("破冰话术需要一百五十至二百五十字的单段中文文字");
  }
  if (PROHIBITED.test(`${name}${icebreaker}`)) {
    errors.push("破冰结果包含不允许的诊断或保证性措辞");
  }
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
