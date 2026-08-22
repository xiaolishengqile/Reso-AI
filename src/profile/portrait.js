import { validateEvidence } from "./evidence.js";
import { getAllStories } from "../scenes/story/catalog.js";

export const PORTRAIT_GENERATOR_VERSION = 2;

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

const STORY_SCHEMAS = getAllStories();
const EXPECTED_EVIDENCE = Object.freeze(
  STORY_SCHEMAS.map((story) => Object.freeze({
    islandId: story.id,
    islandName: story.title,
    stages: story.stages.filter(({ recordsEvidence }) => recordsEvidence),
  })),
);
const ISLAND_NAMES = Object.freeze(Object.fromEntries(
  EXPECTED_EVIDENCE.map(({ islandId, islandName }) => [islandId, islandName]),
));

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

const DIAGNOSTIC_WORDS = /人格障碍|心理疾病|抑郁症|躁郁症|精神病|有病|自恋型人格|救世主情结|秩序狂热/;

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

export function collectOfficialEvidence({ storyProgress } = {}) {
  const candidates = storyProgressList(storyProgress)
    .flatMap(({ officialEvidence = [] } = {}) => officialEvidence);
  const expectedIslands = new Set(EXPECTED_EVIDENCE.map(({ islandId }) => islandId));
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
  if (Array.isArray(input.storyProgress)) {
    return input.storyProgress.find((progress) => progress?.islandId === islandId);
  }
  return input.storyProgress?.[islandId];
}

export function validatePortraitReadiness(input = {}) {
  const evidence = collectOfficialEvidence(input);
  const missing = [];
  if (input.profile?.completed !== true) missing.push("雾谷旅人记录尚未完成");
  const expectedCharacterId = input.characterId ?? null;

  for (const { islandId, islandName, stages } of EXPECTED_EVIDENCE) {
    const progress = getIslandProgress(input, islandId);
    const islandEvidence = evidence.filter((item) => item.islandId === islandId);
    const count = islandEvidence.length;
    if (!Number.isFinite(progress?.firstCompletedAt) && progress?.completed !== true) {
      missing.push(`${islandName}尚未完整结束`);
    }
    if (expectedCharacterId && progress?.characterId !== expectedCharacterId) {
      missing.push(`${islandName}角色串档，无法用于画像`);
    }
    if (count !== stages.length) {
      missing.push(`${islandName}需要 ${stages.length} 组正式证据，当前 ${count} 组`);
    }

    const stageById = new Map(stages.map((stage) => [stage.id, stage]));
    const stageCounts = new Map();
    let schemaMismatch = false;
    for (const item of islandEvidence) {
      const stage = stageById.get(item.stageId);
      const option = stage?.choices.find(({ id }) => id === item.optionId);
      stageCounts.set(item.stageId, (stageCounts.get(item.stageId) ?? 0) + 1);
      if (!stage || !option || item.target !== (option.target ?? "self")) schemaMismatch = true;
    }
    if (stages.some(({ id }) => stageCounts.get(id) !== 1)) schemaMismatch = true;
    if (schemaMismatch) {
      missing.push(`${islandName}题目证据与正式关卡不一致`);
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
  const pressures = unique(records.map(({ evidence }) => evidence.pressure));
  const refs = unique(records.map(({ evidence }) => evidenceRef(evidence)));
  const confidence = islands.length >= 3 && pressures.length >= 2
    ? "high"
    : confidenceForIslandCount(islands.length);
  return {
    value,
    weight: records.reduce((sum, record) => sum + record.weight, 0),
    islandCount: islands.length,
    islands,
    pressures,
    pressureCount: pressures.length,
    contexts: unique(records.flatMap(({ evidence }) => evidence.contextTags)),
    summaries: unique(records.map(({ evidence }) => evidence.summary)),
    evidenceRefs: refs,
    confidence: confidence === "high" && pressures.length < 2 ? "medium" : confidence,
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
        values: summary.values.map(({ value, contexts, summaries, islands, pressures, confidence, evidenceRefs }) => ({
          value, contexts, summaries, islands, pressures, confidence, evidenceRefs,
        })),
      }))
  ));

  return {
    evidenceCount: validEvidence.length,
    ...buckets,
    conflicts,
  };
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

const CONFIDENCE_RANK = Object.freeze({ low: 1, medium: 2, high: 3 });

function aggregateEntries(aggregated) {
  return ["partner", "joint", "self"].flatMap((target) => (
    Object.entries(aggregated[target]).map(([dimension, summary]) => ({
      target,
      dimension,
      ...summary,
      primary: summary.values[0],
    }))
  )).sort((left, right) => (
    CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence]
    || right.islandCount - left.islandCount
    || right.primary.weight - left.primary.weight
    || left.dimension.localeCompare(right.dimension)
  ));
}

function sectionAggregateEntries(aggregated, index) {
  const entries = aggregateEntries(aggregated);
  if (index === 0) return entries.filter(({ target }) => target !== "self").slice(0, 4);
  if (index === 9) return entries.filter(({ target }) => target !== "joint").slice(0, 4);
  if (index === 11) return entries;
  if (index === 10) return [];
  const rule = SECTION_RULES[index];
  return entries.filter(({ dimension }) => rule?.test(dimension)).slice(0, 4);
}

function describeAggregateEntries(entries) {
  if (entries.length === 0) return "当前证据不足，建议在现实相处中继续观察并坦诚沟通。";
  const descriptions = { partner: [], joint: [], self: [] };
  for (const entry of entries) {
    const summary = entry.primary.summaries[0];
    if (summary && !descriptions[entry.target].includes(summary)) {
      descriptions[entry.target].push(summary);
    }
  }
  const sentences = [];
  if (descriptions.partner.length) {
    sentences.push(`跨场景来看，你更期待伴侣${descriptions.partner.slice(0, 2).join("；")}。`);
  }
  if (descriptions.joint.length) {
    sentences.push(`双方适合共同约定：${descriptions.joint.slice(0, 2).join("；")}。`);
  }
  if (descriptions.self.length) {
    sentences.push(`你的可观察倾向是${descriptions.self.slice(0, 2).join("；")}，可据此寻找相容或互补的方式。`);
  }
  return sentences.join("");
}

function describeConflicts(conflicts) {
  if (conflicts.length === 0) {
    return "目前没有形成明确的跨情境冲突；仍建议在现实相处中确认压力状态和适用边界。";
  }
  const examples = conflicts.slice(0, 2).map(({ values }) => values
    .slice(0, 2)
    .map((value) => {
      const context = value.contexts.slice(0, 2).join("、") || "某些";
      const islands = value.islands.map((id) => ISLAND_NAMES[id] ?? id).join("、");
      return `在${context}情境中“${value.summaries[0]}”（来自${islands}）`;
    })
    .join("，而"));
  return `你的需要会随情境变化：${examples.join("；")}。这不是自相矛盾，建议提前说清适用条件和复盘时间。`;
}

function confidenceForEntries(entries) {
  return entries.reduce(
    (best, entry) => CONFIDENCE_RANK[entry.confidence] > CONFIDENCE_RANK[best]
      ? entry.confidence
      : best,
    "low",
  );
}

function overallConfidence(evidence, aggregated) {
  const islands = new Set(evidence.map(({ islandId }) => islandId)).size;
  const hasHighConfidencePattern = aggregateEntries(aggregated)
    .some(({ confidence }) => confidence === "high");
  if (evidence.length >= 42 && islands === 7 && hasHighConfidencePattern) return "high";
  return islands >= 4 ? "medium" : "low";
}

export function generateLocalPortrait({
  profile = null,
  evidence = [],
  baselineEvidence = null,
  generatedAt = Date.now(),
} = {}) {
  const validEvidence = uniqueByRef(evidence.filter((item) => validateEvidence(item).length === 0));
  const aggregated = aggregatePortraitSignals(validEvidence);
  const sections = PORTRAIT_SECTION_TITLES.map((title, index) => {
    const entries = sectionAggregateEntries(aggregated, index);
    const isConflictSection = index === 10;
    const isEvidenceSection = index === 11;
    let content = isConflictSection
      ? describeConflicts(aggregated.conflicts)
      : isEvidenceSection
        ? `本画像引用 ${validEvidence.length} 组正式选择，覆盖 ${new Set(validEvidence.map(({ islandId }) => islandId)).size} 座剧情岛；高置信度只来自至少三座岛且横跨不同压力情境的一致方向。`
        : describeAggregateEntries(entries);
    let evidenceRefs = isConflictSection
      ? unique(aggregated.conflicts.flatMap(({ values }) => values.flatMap(({ evidenceRefs: refs }) => refs)))
      : isEvidenceSection
        ? unique(validEvidence.map(evidenceRef))
        : unique(entries.flatMap(({ primary }) => primary.evidenceRefs));
    if (index === 1 && baselineEvidence && validateEvidence(baselineEvidence).length === 0) {
      content += ` 雾谷的低压力互动只作为起点参考：${baselineEvidence.summary}。`;
      evidenceRefs = unique([...evidenceRefs, evidenceRef(baselineEvidence)]);
    }
    return {
      id: `section-${index + 1}`,
      title,
      content,
      confidence: isConflictSection
        ? confidenceForEntries(aggregated.conflicts.flatMap(({ values }) => values))
        : isEvidenceSection
          ? overallConfidence(validEvidence, aggregated)
          : confidenceForEntries(entries),
      evidenceRefs: evidenceRefs.slice(0, isEvidenceSection ? 42 : 12),
    };
  });
  const coreEntry = aggregateEntries(aggregated)
    .find(({ target }) => target === "partner" || target === "joint");
  const core = coreEntry?.primary.summaries[0] ?? "通过清晰沟通建立可调整的共同规则";

  return {
    summary: `${profile?.nickname ? `${profile.nickname}更` : "你更"}适合与重视“${core}”的伴侣建立关系，并在现实变化中持续协商相处方式。`,
    sections,
    confidence: overallConfidence(validEvidence, aggregated),
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

function createTravelerBaseline(profile, baselineEvidence) {
  const fogEvidence = baselineEvidence && validateEvidence(baselineEvidence).length === 0
    ? {
        islandId: baselineEvidence.islandId,
        stageId: baselineEvidence.stageId,
        optionId: baselineEvidence.optionId,
        target: baselineEvidence.target,
        summary: baselineEvidence.summary,
        signals: baselineEvidence.signals.map((signal) => ({ ...signal })),
        contextTags: [...baselineEvidence.contextTags],
        confidence: "low",
        evidenceRef: evidenceRef(baselineEvidence),
      }
    : null;
  if (!profile?.mbtiType && !fogEvidence) return null;
  return {
    mbtiType: profile?.mbtiType ?? null,
    scores: profile?.scores ?? null,
    fogEvidence,
  };
}

export function createPortraitRequest({
  profile = null,
  evidence = [],
  baselineEvidence = null,
} = {}) {
  const validEvidence = uniqueByRef(evidence.filter((item) => validateEvidence(item).length === 0));
  const refs = [
    ...validEvidence.map((item) => `${evidenceRef(item)}@${item.answeredAt}`),
    baselineEvidence && validateEvidence(baselineEvidence).length === 0
      ? `${evidenceRef(baselineEvidence)}@${baselineEvidence.answeredAt}`
      : "",
  ];
  return {
    protocolVersion: 2,
    requestId: `portrait-${PORTRAIT_GENERATOR_VERSION}-${stableHash(refs.join("|"))}`,
    generatorVersion: PORTRAIT_GENERATOR_VERSION,
    travelerBaseline: createTravelerBaseline(profile, baselineEvidence),
    evidenceCount: validEvidence.length,
    aggregated: aggregatePortraitSignals(validEvidence),
    requiredSections: PORTRAIT_SECTION_TITLES,
  };
}

function validationSources(source) {
  if (Array.isArray(source)) return { evidence: source, baselineEvidence: null };
  return {
    evidence: Array.isArray(source?.evidence) ? source.evidence : [],
    baselineEvidence: source?.baselineEvidence ?? null,
  };
}

export function validatePortraitResult(result, source = []) {
  const errors = [];
  if (!result || typeof result !== "object") return ["画像结果必须是对象"];
  if (typeof result.summary !== "string" || !result.summary.trim()) errors.push("画像缺少摘要");
  if (!Object.hasOwn(CONFIDENCE_RANK, result.confidence)) errors.push("画像整体置信度无效");
  if (!Array.isArray(result.evidenceRefs) || result.evidenceRefs.length === 0) {
    errors.push("画像缺少整体证据引用");
  }
  if (!Array.isArray(result.sections) || result.sections.length !== 12) {
    errors.push("画像必须包含固定十二个章节");
  } else {
    const titles = result.sections.map(({ title }) => title);
    if (titles.some((title, index) => title !== PORTRAIT_SECTION_TITLES[index])) {
      errors.push("画像章节顺序或标题无效");
    }
    result.sections.forEach((section, index) => {
      if (section?.id !== `section-${index + 1}`) errors.push(`画像第 ${index + 1} 章标识无效`);
      if (typeof section?.content !== "string" || !section.content.trim()) {
        errors.push(`画像第 ${index + 1} 章内容不能为空`);
      }
      if (!Object.hasOwn(CONFIDENCE_RANK, section?.confidence)) {
        errors.push(`画像第 ${index + 1} 章置信度无效`);
      }
      if (!Array.isArray(section?.evidenceRefs)) {
        errors.push(`画像第 ${index + 1} 章缺少证据引用`);
      } else if (
        section.evidenceRefs.length === 0
        && !/证据不足|没有形成明确/.test(section.content)
      ) {
        errors.push(`画像第 ${index + 1} 章需要证据引用`);
      }
    });
  }

  const { evidence, baselineEvidence } = validationSources(source);
  const validEvidence = evidence.filter((item) => validateEvidence(item).length === 0);
  const validBaseline = baselineEvidence && validateEvidence(baselineEvidence).length === 0
    ? [baselineEvidence]
    : [];
  const allowedRefs = new Set([...validEvidence, ...validBaseline].map(evidenceRef));
  const resultRefs = [
    ...(Array.isArray(result.evidenceRefs) ? result.evidenceRefs : []),
    ...(Array.isArray(result.sections)
      ? result.sections.flatMap((section) => (
          Array.isArray(section?.evidenceRefs) ? section.evidenceRefs : []
        ))
      : []),
  ];
  if (resultRefs.some((ref) => !allowedRefs.has(ref))) errors.push("画像引用了不存在的正式证据");

  if (validEvidence.length >= 2 && Array.isArray(result.sections) && result.sections.length === 12) {
    for (const index of [0, 11]) {
      const refs = Array.isArray(result.sections[index]?.evidenceRefs)
        ? result.sections[index].evidenceRefs
        : [];
      const islands = new Set(refs.map((ref) => ref.split("/")[0]).filter((id) => id !== "home"));
      if (islands.size < 2) errors.push(`画像第 ${index + 1} 章需要跨岛证据引用`);
    }
  }
  if (DIAGNOSTIC_WORDS.test(JSON.stringify(result))) errors.push("画像包含诊断性措辞");
  if (!Number.isFinite(result.generatedAt)) errors.push("画像缺少有效生成时间");
  if (!Number.isFinite(result.generatorVersion)) errors.push("画像生成版本无效");
  return errors;
}
