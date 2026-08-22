import { MOUNTAIN_STAGES } from "./storyContent.js";

export { MOUNTAIN_STAGES };

export function getCompanionCharacterId(characterId) {
  if (characterId === "boy") return "girl";
  if (characterId === "girl") return "boy";
  return null;
}

export function getMountainStage(stageId) {
  return MOUNTAIN_STAGES.find(({ id }) => id === stageId) ?? null;
}

export function adaptMountainText(text, characterId) {
  const companionId = getCompanionCharacterId(characterId);
  if (!companionId || typeof text !== "string") return text;
  return text.replaceAll("{companion}", companionId === "boy" ? "他" : "她");
}

export function validateMountainStory(stages) {
  if (!Array.isArray(stages)) return ["剧情阶段必须是数组"];

  const errors = [];
  const ids = new Set();
  const stageIds = new Set(stages.map(({ id }) => id));

  for (const stage of stages) {
    if (!stage.id) errors.push("存在缺少标识的阶段");
    else if (ids.has(stage.id)) errors.push(`阶段标识重复：${stage.id}`);
    else ids.add(stage.id);

    if (stage.kind === "complete") {
      if (stage.nextStageId !== null) errors.push(`完成阶段不得继续跳转：${stage.id}`);
      continue;
    }

    if (!stage.nextStageId || !stageIds.has(stage.nextStageId)) {
      errors.push(`下一阶段不存在：${stage.id}`);
    }

    if (stage.kind === "action" && stage.recordsEvidence) {
      errors.push(`行动阶段不得记录证据：${stage.id}`);
    }

    if (stage.recordsEvidence && (!Array.isArray(stage.dimensions) || stage.dimensions.length === 0)) {
      errors.push(`画像阶段缺少检测指标：${stage.id}`);
    }

    if (!Array.isArray(stage.choices) || stage.choices.length === 0) {
      errors.push(`阶段缺少选项：${stage.id}`);
      continue;
    }

    for (const option of stage.choices) {
      if (!option.text || !option.analysis) errors.push(`选项缺少文字或分析：${stage.id}/${option.id ?? "未知"}`);
      if (stage.recordsEvidence && (!Array.isArray(option.dimensions) || option.dimensions.length === 0)) {
        errors.push(`画像选项缺少检测指标：${stage.id}/${option.id ?? "未知"}`);
      }
      if (stage.recordsEvidence && !option.companionMood?.trim()) {
        errors.push(`画像选项缺少同行者情绪：${stage.id}/${option.id ?? "未知"}`);
      }
    }
  }

  return errors;
}
