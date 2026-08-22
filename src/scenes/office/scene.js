import { createStorySceneDefinition } from "../story/createStorySceneDefinition.js";

export const officeScene = createStorySceneDefinition({
  id: "office", name: "工作岛", station: "二", accent: "#647f8a", unlocksOrder: 3, nextName: "吃饭岛",
});
