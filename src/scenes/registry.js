import { homeScene } from "./home/scene.js";
import { mountainScene } from "./mountain/scene.js";
import { officeScene } from "./office/scene.js";

export const SCENES = Object.freeze([
  homeScene,
  mountainScene,
  officeScene,
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

export function getSceneLegendState(scene, unlocked, unlockedOrder) {
  if (!unlocked) return "未解锁";
  if (scene.completedAtOrder && unlockedOrder >= scene.completedAtOrder) {
    return scene.completedLegendState;
  }
  return scene.legendState;
}
