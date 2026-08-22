import { EVIDENCE_TARGETS } from "../../profile/evidence.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function createChoice(id, optionText, feedback, config = {}) {
  return {
    id,
    text: optionText,
    feedback,
    target: config.target,
    summary: config.summary,
    signals: config.signals ?? [],
    companionMood: config.companionMood,
    contextTags: config.contextTags ?? [],
  };
}

export function getStoryStage(story, stageId) {
  return story?.stages?.find(({ id }) => id === stageId) ?? null;
}

export function adaptStoryText(value, characterId) {
  if (typeof value !== "string") return value;
  const companion = characterId === "boy" ? "她" : characterId === "girl" ? "他" : null;
  return companion ? value.replaceAll("{companion}", companion) : value;
}

function validateSignal(signal, path, errors) {
  if (!text(signal?.dimension) || !text(signal?.value)) {
    errors.push(`画像信号内容无效：${path}`);
  }
  if (![1, 2, 3].includes(signal?.weight)) {
    errors.push(`画像信号权重无效：${path}`);
  }
}

export function validateStory(story) {
  if (!story || typeof story !== "object") return ["剧情必须是对象"];
  if (!Array.isArray(story.stages)) return ["剧情阶段必须是数组"];
  const errors = [];
  const stageIds = new Set(story.stages.map(({ id }) => id));
  const seenStages = new Set();
  const evidenceCount = story.stages.filter(({ recordsEvidence }) => recordsEvidence).length;

  if (!text(story.id)) errors.push("剧情缺少岛屿标识");
  if (!text(story.initialStageId) || !stageIds.has(story.initialStageId)) {
    errors.push("剧情初始阶段不存在");
  }
  if (evidenceCount !== 6) errors.push("后续岛剧情必须恰好包含六组正式选择");

  for (const stage of story.stages) {
    const stageId = text(stage.id) || "未知";
    if (seenStages.has(stage.id)) errors.push(`阶段标识重复：${stageId}`);
    seenStages.add(stage.id);

    if (stage.kind === "complete") {
      if (stage.nextStageId !== null) errors.push(`完成阶段不得继续跳转：${stageId}`);
      continue;
    }

    if (!text(stage.nextStageId) || !stageIds.has(stage.nextStageId)) {
      errors.push(`下一阶段不存在：${stageId}`);
    }
    if (!stage.recordsEvidence) errors.push(`选择阶段必须记录正式证据：${stageId}`);
    if (!Array.isArray(stage.choices) || stage.choices.length < 3 || stage.choices.length > 4) {
      errors.push(`画像阶段必须提供三至四个选项：${stageId}`);
      continue;
    }

    const seenChoices = new Set();
    for (const option of stage.choices) {
      const path = `${stageId}/${option?.id ?? "未知"}`;
      if (!text(option?.id) || seenChoices.has(option.id)) errors.push(`选项标识缺失或重复：${path}`);
      seenChoices.add(option?.id);
      if (!text(option?.text)) errors.push(`选项缺少文字：${path}`);
      if (!text(option?.feedback)) errors.push(`选项缺少局部反馈：${path}`);
      if (!EVIDENCE_TARGETS.includes(option?.target)) errors.push(`选项证据对象无效：${path}`);
      if (!text(option?.summary)) errors.push(`选项缺少中性摘要：${path}`);
      if (!text(option?.companionMood)) errors.push(`选项缺少同行者情绪：${path}`);
      if (!Array.isArray(option?.signals) || option.signals.length === 0) {
        errors.push(`选项缺少画像信号：${path}`);
      } else {
        for (const signal of option.signals) validateSignal(signal, path, errors);
      }
    }
  }

  return errors;
}
