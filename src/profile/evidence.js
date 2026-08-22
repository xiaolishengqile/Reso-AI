export const EVIDENCE_VERSION = 1;
export const EVIDENCE_TARGETS = Object.freeze(["self", "partner", "joint"]);

const PRESSURE_LEVELS = new Set(["low", "medium", "high"]);
const TRAVELER_APPROACH = Object.freeze({
  A: Object.freeze({ value: "active", text: "主动热情地回应老人" }),
  B: Object.freeze({ value: "polite-distance", text: "礼貌回应并保持距离" }),
  C: Object.freeze({ value: "observing", text: "简单回应并先观察环境" }),
  D: Object.freeze({ value: "silent-safety-check", text: "保持沉默并先确认安全" }),
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function copySignals(signals = []) {
  return Array.isArray(signals)
    ? signals.map((signal) => ({
        dimension: text(signal?.dimension),
        value: text(signal?.value),
        weight: signal?.weight ?? 1,
      }))
    : [];
}

export function createEvidence(input = {}) {
  return {
    version: EVIDENCE_VERSION,
    islandId: text(input.islandId),
    stageId: text(input.stageId),
    optionId: text(input.optionId),
    optionText: text(input.optionText),
    target: text(input.target),
    summary: text(input.summary),
    signals: copySignals(input.signals),
    contextTags: Array.isArray(input.contextTags)
      ? input.contextTags.map(text).filter(Boolean)
      : [],
    pressure: text(input.pressure) || "low",
    companionMood: text(input.companionMood) || null,
    elapsedMs: Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : null,
    answeredAt: Number.isFinite(input.answeredAt) ? input.answeredAt : Date.now(),
    official: input.official !== false,
  };
}

export function validateEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return ["证据必须是对象"];
  const errors = [];
  if (evidence.version !== EVIDENCE_VERSION) errors.push("证据版本无效");
  if (!text(evidence.islandId)) errors.push("证据缺少岛屿标识");
  if (!text(evidence.stageId)) errors.push("证据缺少阶段标识");
  if (!text(evidence.optionId)) errors.push("证据缺少选项标识");
  if (!text(evidence.optionText)) errors.push("证据缺少选项文字");
  if (!EVIDENCE_TARGETS.includes(evidence.target)) errors.push("证据对象无效");
  if (!text(evidence.summary)) errors.push("证据缺少中性摘要");
  if (!Array.isArray(evidence.signals) || evidence.signals.length === 0) {
    errors.push("证据缺少画像信号");
  } else {
    for (const signal of evidence.signals) {
      const dimension = text(signal?.dimension) || "未知";
      if (!text(signal?.dimension) || !text(signal?.value)) {
        errors.push(`画像信号内容无效：${dimension}`);
      }
      if (![1, 2, 3].includes(signal?.weight)) {
        errors.push(`画像信号权重无效：${dimension}`);
      }
    }
  }
  if (!PRESSURE_LEVELS.has(evidence.pressure)) errors.push("证据压力级别无效");
  if (!Number.isFinite(evidence.answeredAt)) errors.push("证据记录时间无效");
  return errors;
}

export function normalizeEvidence(evidence = {}, fallback = {}) {
  const dimensions = Array.isArray(evidence.dimensions) ? evidence.dimensions : [];
  const signals = evidence.signals?.length
    ? evidence.signals
    : fallback.signals?.length
      ? fallback.signals
      : dimensions.map((dimension) => ({ dimension, value: "observed", weight: 1 }));
  return createEvidence({
    islandId: evidence.islandId ?? evidence.island ?? fallback.islandId,
    stageId: evidence.stageId ?? fallback.stageId,
    optionId: evidence.optionId ?? evidence.choiceId ?? fallback.optionId,
    optionText: evidence.optionText ?? fallback.optionText,
    target: evidence.target ?? fallback.target ?? "self",
    summary: evidence.summary ?? evidence.analysis ?? fallback.summary,
    signals,
    contextTags: evidence.contextTags ?? fallback.contextTags ?? [],
    pressure: evidence.pressure ?? fallback.pressure ?? "low",
    companionMood: evidence.companionMood ?? fallback.companionMood,
    elapsedMs: evidence.elapsedMs,
    answeredAt: evidence.answeredAt ?? evidence.recordedAt ?? fallback.answeredAt,
    official: evidence.official,
  });
}

export function normalizeTravelerEvidence(profile) {
  const original = profile?.officialEvidence?.[0];
  const choiceId = original?.choiceId ?? profile?.choiceId;
  const approach = TRAVELER_APPROACH[choiceId];
  if (!original || !approach) return null;
  return createEvidence({
    islandId: "home",
    stageId: original.stageId ?? "elder-choice",
    optionId: choiceId,
    optionText: approach.text,
    target: "self",
    summary: original.analysis,
    signals: [{ dimension: "socialApproach", value: approach.value, weight: 1 }],
    contextTags: ["陌生人互动", "低压力"],
    pressure: "low",
    answeredAt: original.recordedAt,
  });
}
