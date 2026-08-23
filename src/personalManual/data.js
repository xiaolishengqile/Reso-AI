export const PERSONAL_MANUAL_CACHE_KEY = "reso-ai.relationship-tools.personal-manual";

export const MANUAL_VARIABLE_IDS = Object.freeze([
  "crisisInstinct",
  "involuntaryReaction",
  "incompatiblePattern",
  "possibleMisreading",
  "negativeFeeling",
  "relationshipRedLine",
  "repairAction",
  "recoveryNeed",
  "lifeVision",
]);

export const MANUAL_SECTION_IDS = Object.freeze([
  "deepNeed",
  "defense",
  "incompatible",
  "repair",
  "vision",
]);

export const MANUAL_SECTION_TITLES = Object.freeze({
  deepNeed: "表层标签与深层关系需求",
  defense: "极限压力下的防御本能",
  incompatible: "冲突与需要避开的模式",
  repair: "合适的冲突修复与支持蓝图",
  vision: "人生愿景与关系方向",
});

const CACHE_VERSION = 1;
const CONFIDENCE_LEVELS = new Set(["低", "中", "高"]);
const PROHIBITED = /人格障碍|心理疾病|焦虑症|抑郁症|躁郁症|双相情感障碍|精神病|强迫症|创伤后应激障碍|有病|自恋型人格|性取向|同性恋|异性恋|宗教信仰|政治立场|种族|民族|残疾|病史|救世主情结|命中注定|百分之百|完美契合|彻底碎裂/u;

function text(value, maximum = 600) {
  return typeof value === "string" && value.trim() && Array.from(value.trim()).length <= maximum;
}

function orderedUniqueIds(items, expectedIds) {
  return Array.isArray(items)
    && items.length === expectedIds.length
    && items.every((item, index) => item?.id === expectedIds[index]);
}

export function validatePersonalManualResult(result, allowedEvidenceRefs = null) {
  if (!result || typeof result !== "object") return ["个人说明书必须是对象"];
  const errors = [];
  if (!orderedUniqueIds(result.variables, MANUAL_VARIABLE_IDS)) {
    errors.push("个人说明书需要按固定顺序包含九个变量");
  } else {
    for (const variable of result.variables) {
      if (!text(variable.name, 80) || !text(variable.description)) {
        errors.push(`变量内容无效：${variable.id}`);
      }
      if (!CONFIDENCE_LEVELS.has(variable.confidence)) {
        errors.push(`变量置信度无效：${variable.id}`);
      }
      if (
        !Array.isArray(variable.evidenceRefs)
        || variable.evidenceRefs.length < 1
        || variable.evidenceRefs.length > 12
        || variable.evidenceRefs.some((ref) => !text(ref, 180))
      ) {
        errors.push(`变量证据引用无效：${variable.id}`);
      } else if (
        allowedEvidenceRefs
        && variable.evidenceRefs.some((ref) => !allowedEvidenceRefs.has(ref))
      ) {
        errors.push(`变量引用了请求之外的证据：${variable.id}`);
      }
    }
  }
  if (!orderedUniqueIds(result.sections, MANUAL_SECTION_IDS)) {
    errors.push("个人说明书需要按固定顺序包含五个章节");
  } else {
    for (const section of result.sections) {
      if (
        section.title !== MANUAL_SECTION_TITLES[section.id]
        || !text(section.content, 1200)
        || !CONFIDENCE_LEVELS.has(section.confidence)
        || !Number.isInteger(section.evidenceCount)
        || section.evidenceCount < 1
      ) errors.push(`章节内容无效：${section.id}`);
    }
  }
  if (!text(result.updateSummary, 300)) errors.push("个人说明书缺少更新说明");
  if (PROHIBITED.test(JSON.stringify(result))) {
    errors.push("个人说明书包含不允许的诊断或保证性措辞");
  }
  return errors;
}

function loadStore(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(PERSONAL_MANUAL_CACHE_KEY) ?? "null");
    return parsed?.version === CACHE_VERSION && parsed.players && typeof parsed.players === "object"
      ? parsed
      : { version: CACHE_VERSION, players: {} };
  } catch {
    return { version: CACHE_VERSION, players: {} };
  }
}

function validCache(cache) {
  return Boolean(
    cache
    && typeof cache.evidenceSignature === "string"
    && Number.isInteger(cache.revision)
    && cache.revision > 0
    && Array.isArray(cache.completedIslands)
    && Number.isInteger(cache.evidenceCount)
    && cache.evidenceCount > 0
    && Number.isFinite(cache.generatedAt)
    && validatePersonalManualResult(cache).length === 0
  );
}

export function getPersonalManualState(storage, characterId, context) {
  const cache = loadStore(storage).players?.[characterId];
  if (!validCache(cache)) return { status: "generate", cache: null };
  return {
    status: cache.evidenceSignature === context?.signature ? "view" : "update",
    cache,
  };
}

export function savePersonalManualCache(
  storage,
  characterId,
  context,
  result,
  revision,
  generatedAt = Date.now(),
  model = "",
) {
  try {
    const allowedRefs = new Set(
      result?.variables?.flatMap((variable) => variable.evidenceRefs ?? []) ?? [],
    );
    if (
      !storage?.setItem
      || typeof characterId !== "string"
      || !characterId
      || typeof context?.signature !== "string"
      || !context.signature
      || !Number.isInteger(revision)
      || revision < 1
      || !Number.isFinite(generatedAt)
      || validatePersonalManualResult(result, allowedRefs).length > 0
    ) return false;
    const store = loadStore(storage);
    storage.setItem(PERSONAL_MANUAL_CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      players: {
        ...store.players,
        [characterId]: {
          evidenceSignature: context.signature,
          revision,
          completedIslands: [...context.completedIslands],
          evidenceCount: context.evidenceCount,
          variables: result.variables,
          sections: result.sections,
          updateSummary: result.updateSummary,
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
