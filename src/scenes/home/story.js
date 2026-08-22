import { ELDER_CHOICES, HOME_STAGES } from "./storyContent.js";

export { ELDER_CHOICES, HOME_STAGES };

export function getHomeStage(stageId) {
  return HOME_STAGES.find(({ id }) => id === stageId) ?? null;
}

export function getElderChoice(choiceId) {
  return ELDER_CHOICES.find(({ id }) => id === choiceId) ?? null;
}

export function validateHomeStory(stages = HOME_STAGES) {
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
    if (typeof stage.text !== "string") errors.push(`阶段缺少正文：${stage.id}`);
  }

  const choiceStage = stages.find(({ id }) => id === "elder-choice");
  if (
    !choiceStage
    || !Array.isArray(choiceStage.choices)
    || choiceStage.choices.length !== 4
    || choiceStage.choices.map(({ id }) => id).join("") !== "ABCD"
  ) {
    errors.push("老人回应必须包含 A、B、C、D 四个选择");
  } else {
    for (const choice of choiceStage.choices) {
      if (!choice.playerLines?.length || !choice.analysis?.trim() || !choice.response?.trim()) {
        errors.push(`老人选择内容不完整：${choice.id}`);
      }
    }
  }

  return errors;
}
