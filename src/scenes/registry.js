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

export function getSceneLegendState(scene, unlocked, unlockedOrder) {
  if (!unlocked) return "未解锁";
  if (scene.completedAtOrder && unlockedOrder >= scene.completedAtOrder) {
    return scene.completedLegendState;
  }
  return scene.legendState;
}

export function getSceneJourneyStatus(locations, unlockedOrder) {
  const orderedLocations = [...locations].sort(
    (left, right) => left.unlockOrder - right.unlockOrder,
  );
  const origin = orderedLocations[0];
  const current = orderedLocations
    .filter((location) => location.unlockOrder <= unlockedOrder)
    .at(-1);

  if (!origin || !current) return "继续探索人生群岛";
  if (current.unlockOrder <= 1) {
    return `从${origin.name}出发，先前往${current.name}`;
  }
  if (current === orderedLocations.at(-1)) {
    return `${current.name}已解锁，前往查看旅程答案`;
  }
  return `${current.name}已解锁，沿着下一座桥继续前往`;
}
