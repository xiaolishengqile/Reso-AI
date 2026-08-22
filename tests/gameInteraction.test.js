import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  findLocationRoot,
  getLocationInteraction,
} from "../src/game/createGame.js";

test("射线命中地点子模型时能够找到地点根节点", () => {
  const root = new THREE.Group();
  root.userData.locationId = "cloud-ridge";
  const child = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  root.add(child);

  assert.equal(findLocationRoot(child), root);
});

test("只有点击地点与玩家附近地点相同时才允许进入", () => {
  const mountain = { id: "cloud-ridge", name: "云脊山" };
  const forest = { id: "whispering-woods", name: "风语林" };

  assert.equal(getLocationInteraction(mountain, mountain).canEnter, true);
  assert.equal(getLocationInteraction(forest, mountain).canEnter, false);
  assert.equal(getLocationInteraction(mountain, null).canEnter, false);
});
