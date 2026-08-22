import { createStorySceneDefinition } from "../story/createStorySceneDefinition.js";

export const moneyScene = createStorySceneDefinition({
  id: "money", name: "金钱岛", station: "五", accent: "#8b8258", unlocksOrder: 6, nextName: "社交岛",
});
