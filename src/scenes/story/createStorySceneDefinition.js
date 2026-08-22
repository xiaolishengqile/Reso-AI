export function createStorySceneDefinition(config) {
  const {
    id,
    name,
    station,
    accent,
    unlocksOrder,
    nextName,
  } = config;
  return Object.freeze({
    id,
    entryMode: "confirmed-external",
    entryLabel: `进入${name}剧情`,
    name,
    label: `第 ${station} 站 · ${name}`,
    accent,
    description: `进入${name}，和同行者面对一段真实的关系选择。`,
    lockedDescription: `${name}尚未解锁，请先完成上一座岛。`,
    sceneDescription: `这里记录你在${name}中的处理方式、伴侣期待与共同规则。`,
    legendState: "已解锁",
    completedLegendState: "已完成",
    completedAtOrder: unlocksOrder,
    unlocksOrder,
    completionMessage: `${name}已完成，通往${nextName}的桥已解锁。`,
    replayCompletionMessage: `${name}剧情已重温完成。`,
    closeMessage: `已返回世界地图，${name}进度会在下次进入时恢复。`,
    openFailureMessage: `${name}剧情暂时无法恢复，请稍后重试。`,
  });
}
