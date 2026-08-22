import { homeScene } from "./home/scene.js";
import { mountainScene } from "./mountain/scene.js";
import { officeScene } from "./office/scene.js";
import { diningScene } from "./dining/scene.js";
import { cohabitationScene } from "./cohabitation/scene.js";
import { moneyScene } from "./money/scene.js";
import { socialScene } from "./social/scene.js";
import { travelScene } from "./travel/scene.js";
import { futureScene } from "./future/scene.js";
import { wishScene } from "./wish/scene.js";

export const SCENES = Object.freeze([
  homeScene,
  mountainScene,
  officeScene,
  diningScene,
  cohabitationScene,
  moneyScene,
  socialScene,
  travelScene,
  futureScene,
  wishScene,
]);

const SCENE_BY_ID = new Map(SCENES.map((scene) => [scene.id, scene]));

export function getScene(sceneId) {
  return SCENE_BY_ID.get(sceneId) ?? null;
}

export function createSceneLocations(mapLocations) {
  return Object.freeze(mapLocations.map((location) => {
    const scene = getScene(location.id);
    if (!scene) throw new Error("未注册场景：" + location.id);
    return Object.freeze({ ...location, ...scene });
  }));
}

export function getSceneLegendState(scene, status = {}) {
  if (status.completed) return scene.completedLegendState ?? "已完成";
  if (status.visited) return "已到访";
  return scene.legendState;
}

export function getSceneJourneyStatus(locations) {
  return locations?.length
    ? "十座岛均已开放，靠近并点击地点开始探索"
    : "继续探索人生群岛";
}
