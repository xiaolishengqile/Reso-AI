import { createStorySceneDefinition } from "../story/createStorySceneDefinition.js";

export const diningScene = createStorySceneDefinition({
  id: "dining", name: "吃饭岛", station: "三", accent: "#b67554", unlocksOrder: 4, nextName: "同居岛",
});
