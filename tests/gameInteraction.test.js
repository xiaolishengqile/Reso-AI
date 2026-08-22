import test from "node:test";
import assert from "node:assert/strict";
import * as game from "../src/game/createGame.js";

test("只有点击地点与玩家附近地点相同时才允许进入", () => {
  const mountain = { id: "cloud-ridge", name: "云脊山" };
  const forest = { id: "whispering-woods", name: "风语林" };

  assert.equal(game.getLocationInteraction(mountain, mountain).canEnter, true);
  assert.equal(game.getLocationInteraction(forest, mountain).canEnter, false);
  assert.equal(game.getLocationInteraction(mountain, null).canEnter, false);
});

test("只命中鼠标范围内最近的地标", () => {
  const locations = [
    { id: "mountain", x: 100, z: 100, hitRadius: 40 },
    { id: "forest", x: 240, z: 100, hitRadius: 30 },
  ];

  assert.equal(
    game.findLocationAtPoint({ x: 115, z: 100 }, locations)?.id,
    "mountain",
  );
  assert.equal(game.findLocationAtPoint({ x: 180, z: 100 }, locations), null);
});
