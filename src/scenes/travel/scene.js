import { createStorySceneDefinition } from "../story/createStorySceneDefinition.js";

export const travelScene = createStorySceneDefinition({
  id: "travel", name: "旅行岛", station: "七", accent: "#ad8454", unlocksOrder: 8, nextName: "未来岛",
});
