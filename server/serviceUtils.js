const PRESSURE_LEVELS = new Set(["low", "medium", "high"]);

export class RelationshipServiceError extends Error {
  constructor(code, publicMessage, status = 400) {
    super(publicMessage);
    this.name = "RelationshipServiceError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = status;
  }
}

export function requiredText(value, maximum, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || Array.from(normalized).length > maximum) {
    throw new RelationshipServiceError("INVALID_REQUEST", `请求中的${fieldName}无效。`);
  }
  return normalized;
}

export function optionalText(value, maximum) {
  if (value === undefined || value === null || value === "") return "";
  return requiredText(value, maximum, "文字");
}

export function normalizeEvidenceItem(item, allowedIslands) {
  if (!item || typeof item !== "object") {
    throw new RelationshipServiceError("INVALID_REQUEST", "请求中的正式证据无效。");
  }
  const islandId = requiredText(item.islandId, 40, "岛屿标识");
  if (!allowedIslands.has(islandId)) {
    throw new RelationshipServiceError("INVALID_REQUEST", "请求包含未知岛屿。");
  }
  const stageId = requiredText(item.stageId, 80, "阶段标识");
  const optionId = requiredText(item.optionId, 80, "选项标识");
  const optionText = requiredText(item.optionText, 300, "选项文字");
  const summary = requiredText(item.summary, 300, "证据摘要");
  if (!Number.isFinite(item.answeredAt)) {
    throw new RelationshipServiceError("INVALID_REQUEST", "请求中的证据时间无效。");
  }
  const evidenceRef = requiredText(item.evidenceRef, 220, "证据引用");
  const expectedRef = `${islandId}/${stageId}/${optionId}@${item.answeredAt}`;
  if (evidenceRef !== expectedRef) {
    throw new RelationshipServiceError("INVALID_REQUEST", "请求中的证据引用不一致。");
  }
  if (!Array.isArray(item.signals) || item.signals.length < 1 || item.signals.length > 12) {
    throw new RelationshipServiceError("INVALID_REQUEST", "请求中的证据信号无效。");
  }
  const signals = item.signals.map((signal) => {
    const dimension = requiredText(signal?.dimension, 80, "信号维度");
    const value = requiredText(signal?.value, 120, "信号内容");
    if (![1, 2, 3].includes(signal?.weight)) {
      throw new RelationshipServiceError("INVALID_REQUEST", "请求中的信号权重无效。");
    }
    return { dimension, value, weight: signal.weight };
  });
  if (!Array.isArray(item.contextTags) || item.contextTags.length > 12) {
    throw new RelationshipServiceError("INVALID_REQUEST", "请求中的情境标签无效。");
  }
  const contextTags = item.contextTags.map((tag) => requiredText(tag, 80, "情境标签"));
  if (!PRESSURE_LEVELS.has(item.pressure)) {
    throw new RelationshipServiceError("INVALID_REQUEST", "请求中的压力级别无效。");
  }
  return {
    evidenceRef,
    islandId,
    stageId,
    optionId,
    optionText,
    summary,
    signals,
    contextTags,
    pressure: item.pressure,
    answeredAt: item.answeredAt,
  };
}

export function parseModelJson(content) {
  const normalized = typeof content === "string"
    ? content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : "";
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed;
  } catch {
    throw new RelationshipServiceError(
      "MODEL_INVALID_RESPONSE",
      "模型返回了无法使用的结果。",
      502,
    );
  }
}

export function invalidModelResult() {
  return new RelationshipServiceError(
    "MODEL_INVALID_RESPONSE",
    "模型返回了无法使用的结果。",
    502,
  );
}
