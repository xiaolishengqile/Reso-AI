function media(type, sources, alt) {
  return Object.freeze({
    type,
    sources: Object.freeze([...sources]),
    alt,
  });
}

const ENTRY_MEDIA = media(
  "image",
  ["./assets/mountain/mountain-entry.png"],
  "云雾笼罩的星空谷山脉入口",
);

const STAGE_MEDIA = Object.freeze({
  invitation: media("video", [
    "./assets/mountain/scene-1-1.mp4",
    "./assets/mountain/scene-1-3.mp4",
    "./assets/mountain/scene-1-4.mp4",
  ], "咖啡馆里的周末邀约"),
  fatigue: media("video", ["./assets/mountain/scene-2.mp4"], "攀登陡峭山崖后的疲惫时刻"),
  slip: media("video", ["./assets/mountain/scene-3.mp4"], "暴雨中攀爬湿滑崖壁"),
  "storm-thought": media("video", ["./assets/mountain/scene-4.mp4"], "暴雨危机中的生死抉择"),
  "cave-repair": media("video", ["./assets/mountain/scene-5.mp4"], "岩石下避雨与恢复"),
  "home-message": media("image", ["./assets/mountain/home-message.png"], "暴雨旅程结束后的公寓夜晚"),
  "city-realization": media("image", ["./assets/mountain/city-realization.png"], "镜前重新审视城市生活的夜晚"),
  complete: media("image", ["./assets/mountain/city-realization.png"], "镜前重新审视城市生活的夜晚"),
});

export function getMountainEntryMedia() {
  return ENTRY_MEDIA;
}

export function getMountainStageMedia(stageId) {
  return STAGE_MEDIA[stageId] ?? null;
}

export function validateMountainMedia(stages) {
  if (!Array.isArray(stages)) return ["剧情阶段必须是数组"];
  const errors = [];
  for (const stage of stages) {
    const stageMedia = getMountainStageMedia(stage.id);
    if (!stageMedia) {
      errors.push(`剧情阶段缺少媒体：${stage.id}`);
      continue;
    }
    if (!["video", "image"].includes(stageMedia.type)) {
      errors.push(`剧情媒体类型无效：${stage.id}`);
    }
    if (!stageMedia.sources.length || stageMedia.sources.some((source) => !source)) {
      errors.push(`剧情媒体来源无效：${stage.id}`);
    }
    if (!stageMedia.alt.trim()) errors.push(`剧情媒体缺少说明：${stage.id}`);
  }
  return errors;
}
