import { validateEvidence } from "./evidence.js";

export const PORTRAIT_GENERATOR_VERSION = 1;

export const PORTRAIT_SECTION_TITLES = Object.freeze([
  "一句话关系核心需求",
  "心仪对象的核心性格与价值观",
  "合适的沟通方式",
  "合适的情绪支持方式",
  "冲突发生时的理想处理流程",
  "对陪伴与个人空间的期待",
  "事业、金钱和生活方式的相容条件",
  "社交、家庭和异性边界",
  "婚姻、孩子、城市与未来方向",
  "适合的互补特征",
  "需要提前谈清楚的潜在冲突",
  "主要结论对应的岛屿证据与置信度",
]);

const EXPECTED_EVIDENCE = Object.freeze([
  ["mountain", "爬山岛", 7],
  ["office", "工作岛", 6],
  ["dining", "吃饭岛", 6],
  ["cohabitation", "同居岛", 6],
  ["money", "金钱岛", 6],
  ["social", "社交岛", 6],
  ["travel", "旅行岛", 6],
  ["future", "未来岛", 6],
]);

const SECTION_RULES = Object.freeze([
  null,
  /priority|commitment|loyalty|integrity|longTermLove|responsibility|career|children/i,
  /communication|presence|socialSupport|publicCommitment/i,
  /emotionalSupport|travelSupport|support|empathy|recovery|security/i,
  /conflict|repair|jealousy|accountability|stressResponse|travelConflict/i,
  /closeness|autonomy|space|presence|socialEnergy|sleep|alone/i,
  /career|finance|money|fairness|risk|saving|spending|workBoundary|futureHome|lifestyle/i,
  /privacy|social|network|familyBoundary|jealousy|trust|publicCommitment/i,
  /commitment|children|familyCare|futureHome|longTermLove|planning/i,
  null,
  null,
  null,
]);

const DIAGNOSTIC_WORDS = /人格障碍|心理疾病|抑郁症|躁郁症|精神病|有病|自恋型人格/;

function evidenceRef(item) {
  return `${item.islandId}/${item.stageId}/${item.optionId}`;
}

function unique(values) {
  return [...new Set(values)];
}

function confidenceForIslandCount(count) {
  if (count >= 3) return "high";
  if (count >= 2) return "medium";
  return "low";
}

function storyProgressList(storyProgress) {
  if (Array.isArray(storyProgress)) return storyProgress;
  return storyProgress && typeof storyProgress === "object"
    ? Object.values(storyProgress)
    : [];
}

export function collectOfficialEvidence({ mountainProgress, storyProgress } = {}) {
  const candidates = [
    ...(mountainProgress?.officialEvidence ?? []),
    ...storyProgressList(storyProgress).flatMap(({ officialEvidence = [] } = {}) => officialEvidence),
  ];
  const expectedIslands = new Set(EXPECTED_EVIDENCE.map(([islandId]) => islandId));
  const seen = new Set();
  return candidates.filter((item) => {
    const ref = evidenceRef(item ?? {});
    if (
      !expectedIslands.has(item?.islandId)
      || item?.official === false
      || validateEvidence(item).length > 0
      || seen.has(ref)
    ) return false;
    seen.add(ref);
    return true;
  });
}

function getIslandProgress(input, islandId) {
  if (islandId === "mountain") return input.mountainProgress;
  if (Array.isArray(input.storyProgress)) {
    return input.storyProgress.find((progress) => progress?.islandId === islandId);
  }
  return input.storyProgress?.[islandId];
}

export function validatePortraitReadiness(input = {}) {
  const evidence = collectOfficialEvidence(input);
  const missing = [];
  if (input.profile?.completed !== true) missing.push("雾谷旅人记录尚未完成");

  for (const [islandId, islandName, expectedCount] of EXPECTED_EVIDENCE) {
    const progress = getIslandProgress(input, islandId);
    const count = evidence.filter((item) => item.islandId === islandId).length;
    if (!Number.isFinite(progress?.firstCompletedAt) && progress?.completed !== true) {
      missing.push(`${islandName}尚未完整结束`);
    }
    if (count !== expectedCount) {
      missing.push(`${islandName}需要 ${expectedCount} 组正式证据，当前 ${count} 组`);
    }
  }

  return {
    ready: missing.length === 0,
    missing,
    evidenceCount: evidence.length,
  };
}

function createValueSummary(value, records) {
  const islands = unique(records.map(({ evidence }) => evidence.islandId));
  const refs = unique(records.map(({ evidence }) => evidenceRef(evidence)));
  return {
    value,
    weight: records.reduce((sum, record) => sum + record.weight, 0),
    islandCount: islands.length,
    islands,
    contexts: unique(records.flatMap(({ evidence }) => evidence.contextTags)),
    summaries: unique(records.map(({ evidence }) => evidence.summary)),
    evidenceRefs: refs,
    confidence: confidenceForIslandCount(islands.length),
  };
}

export function aggregatePortraitSignals(evidence = []) {
  const grouped = new Map();
  const validEvidence = evidence.filter((item) => validateEvidence(item).length === 0);
  for (const item of validEvidence) {
    for (const signal of item.signals) {
      const key = `${item.target}\u0000${signal.dimension}\u0000${signal.value}`;
      const records = grouped.get(key) ?? [];
      records.push({ evidence: item, weight: signal.weight });
      grouped.set(key, records);
    }
  }

  const buckets = { self: {}, partner: {}, joint: {} };
  for (const target of Object.keys(buckets)) {
    const dimensions = unique(validEvidence
      .filter((item) => item.target === target)
      .flatMap((item) => item.signals.map(({ dimension }) => dimension)));
    for (const dimension of dimensions) {
      const values = [...grouped.entries()]
        .filter(([key]) => key.startsWith(`${target}\u0000${dimension}\u0000`))
        .map(([key, records]) => createValueSummary(key.split("\u0000")[2], records))
        .sort((left, right) => (
          right.islandCount - left.islandCount
          || right.weight - left.weight
          || left.value.localeCompare(right.value)
        ));
      const primary = values[0];
      buckets[target][dimension] = {
        primaryValue: primary.value,
        confidence: primary.confidence,
        islandCount: primary.islandCount,
        contextualValues: values.map(({ value }) => value),
        values,
        evidenceRefs: unique(values.flatMap(({ evidenceRefs }) => evidenceRefs)),
      };
    }
  }

  const conflicts = Object.entries(buckets).flatMap(([target, dimensions]) => (
    Object.entries(dimensions)
      .filter(([, summary]) => summary.contextualValues.length > 1)
      .map(([dimension, summary]) => ({
        target,
        dimension,
        values: summary.values.map(({ value, contexts, evidenceRefs }) => ({
          value, contexts, evidenceRefs,
        })),
      }))
  ));

  return {
    evidenceCount: validEvidence.length,
    ...buckets,
    conflicts,
  };
}

function sectionEvidence(evidence, index, aggregated) {
  if (index === 0) return evidence.filter(({ target }) => target !== "self");
  if (index === 9) return evidence.filter(({ target }) => target !== "joint");
  if (index === 10) {
    const refs = new Set(aggregated.conflicts.flatMap(({ values }) => (
      values.flatMap(({ evidenceRefs }) => evidenceRefs)
    )));
    const highPressure = evidence.filter(({ pressure }) => pressure === "high");
    return uniqueByRef([
      ...evidence.filter((item) => refs.has(evidenceRef(item))),
      ...highPressure,
    ]);
  }
  if (index === 11) return evidence;
  const rule = SECTION_RULES[index];
  return evidence.filter((item) => item.signals.some(({ dimension }) => rule?.test(dimension)));
}

function uniqueByRef(evidence) {
  const seen = new Set();
  return evidence.filter((item) => {
    const ref = evidenceRef(item);
    if (seen.has(ref)) return false;
    seen.add(ref);
    return true;
  });
}

function selectSummaries(evidence, target, limit = 2) {
  return unique(evidence
    .filter((item) => item.target === target)
    .sort((left, right) => (
      Math.max(...right.signals.map(({ weight }) => weight))
      - Math.max(...left.signals.map(({ weight }) => weight))
    ))
    .map(({ summary }) => summary)).slice(0, limit);
}

function describeSection(evidence, index, aggregated) {
  if (evidence.length === 0) return "当前证据不足，建议在现实相处中继续观察并坦诚沟通。";
  const partner = selectSummaries(evidence, "partner");
  const joint = selectSummaries(evidence, "joint");
  const self = selectSummaries(evidence, "self");

  if (index === 10 && aggregated.conflicts.length > 0) {
    return `不同情境下保留了 ${aggregated.conflicts.length} 组不完全相同的需要。这并不代表答案矛盾，建议提前谈清压力状态、适用边界和复盘时间。`;
  }
  if (index === 11) {
    const islandCount = new Set(evidence.map(({ islandId }) => islandId)).size;
    return `本画像引用 ${evidence.length} 组正式选择，覆盖 ${islandCount} 座剧情岛；结论按跨岛一致程度标注置信度，并保留情境差异。`;
  }

  const sentences = [];
  if (partner.length) sentences.push(`你更期待伴侣${partner.join("；")}。`);
  if (joint.length) sentences.push(`双方适合共同约定：${joint.join("；")}。`);
  if (self.length) sentences.push(`你的可观察倾向是${self.join("；")}，可用来寻找相容或互补的相处方式。`);
  return sentences.join("") || "当前证据不足，建议在现实相处中继续观察并坦诚沟通。";
}

function sectionConfidence(evidence) {
  return confidenceForIslandCount(new Set(evidence.map(({ islandId }) => islandId)).size);
}

function overallConfidence(evidence) {
  const islands = new Set(evidence.map(({ islandId }) => islandId)).size;
  return evidence.length >= 49 && islands === 8 ? "high" : islands >= 4 ? "medium" : "low";
}

export function generateLocalPortrait({ profile = null, evidence = [], generatedAt = Date.now() } = {}) {
  const validEvidence = uniqueByRef(evidence.filter((item) => validateEvidence(item).length === 0));
  const aggregated = aggregatePortraitSignals(validEvidence);
  const sections = PORTRAIT_SECTION_TITLES.map((title, index) => {
    const relevant = sectionEvidence(validEvidence, index, aggregated);
    return {
      id: `section-${index + 1}`,
      title,
      content: describeSection(relevant, index, aggregated),
      confidence: sectionConfidence(relevant),
      evidenceRefs: unique(relevant.map(evidenceRef)).slice(0, index === 11 ? 49 : 8),
    };
  });
  const explicitNeeds = selectSummaries(validEvidence, "partner", 1);
  const sharedRules = selectSummaries(validEvidence, "joint", 1);
  const core = explicitNeeds[0] ?? sharedRules[0] ?? "通过清晰沟通建立可调整的共同规则";

  return {
    summary: `${profile?.nickname ? `${profile.nickname}更` : "你更"}适合与愿意${core}的伴侣建立关系，并在现实变化中持续协商相处方式。`,
    sections,
    confidence: overallConfidence(validEvidence),
    evidenceRefs: unique(validEvidence.map(evidenceRef)),
    generatedAt,
    generatorVersion: PORTRAIT_GENERATOR_VERSION,
    source: "local",
  };
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createPortraitRequest({ profile = null, evidence = [] } = {}) {
  const validEvidence = uniqueByRef(evidence.filter((item) => validateEvidence(item).length === 0));
  const refs = validEvidence.map((item) => `${evidenceRef(item)}@${item.answeredAt}`);
  return {
    protocolVersion: 1,
    requestId: `portrait-${PORTRAIT_GENERATOR_VERSION}-${stableHash(refs.join("|"))}`,
    generatorVersion: PORTRAIT_GENERATOR_VERSION,
    travelerBaseline: profile?.mbtiType ? { mbtiType: profile.mbtiType } : null,
    evidenceCount: validEvidence.length,
    aggregated: aggregatePortraitSignals(validEvidence),
    requiredSections: PORTRAIT_SECTION_TITLES,
  };
}

export function validatePortraitResult(result, evidence = []) {
  const errors = [];
  if (!result || typeof result !== "object") return ["画像结果必须是对象"];
  if (typeof result.summary !== "string" || !result.summary.trim()) errors.push("画像缺少摘要");
  if (!Array.isArray(result.sections) || result.sections.length !== 12) {
    errors.push("画像必须包含固定十二个章节");
  } else {
    const titles = result.sections.map(({ title }) => title);
    if (titles.some((title, index) => title !== PORTRAIT_SECTION_TITLES[index])) {
      errors.push("画像章节顺序或标题无效");
    }
    if (result.sections.some(({ content }) => typeof content !== "string" || !content.trim())) {
      errors.push("画像章节内容不能为空");
    }
  }

  const allowedRefs = new Set(evidence
    .filter((item) => validateEvidence(item).length === 0)
    .map(evidenceRef));
  const resultRefs = [
    ...(Array.isArray(result.evidenceRefs) ? result.evidenceRefs : []),
    ...(Array.isArray(result.sections)
      ? result.sections.flatMap(({ evidenceRefs = [] }) => evidenceRefs)
      : []),
  ];
  if (resultRefs.some((ref) => !allowedRefs.has(ref))) errors.push("画像引用了不存在的正式证据");
  if (DIAGNOSTIC_WORDS.test(JSON.stringify(result))) errors.push("画像包含诊断性措辞");
  if (!Number.isFinite(result.generatedAt)) errors.push("画像缺少有效生成时间");
  if (!Number.isFinite(result.generatorVersion)) errors.push("画像生成版本无效");
  return errors;
}
