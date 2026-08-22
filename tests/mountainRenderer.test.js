import test from "node:test";
import assert from "node:assert/strict";
import {
  drawMountainFrame,
  getMountainActorLayout,
  getMountainScenePalette,
} from "../src/scenes/mountain/mountainRenderer.js";

test("咖啡馆、大山和公寓使用不同场景色板", () => {
  assert.notDeepEqual(
    getMountainScenePalette("cafe", "clear"),
    getMountainScenePalette("mountain", "storm"),
  );
  assert.notDeepEqual(
    getMountainScenePalette("mountain", "storm"),
    getMountainScenePalette("apartment", "night"),
  );
});

test("角色按画布比例从山脚移动到山腰和山顶", () => {
  const foot = getMountainActorLayout("foot", 1200, 800);
  const middle = getMountainActorLayout("middle", 1200, 800);
  const summit = getMountainActorLayout("summit", 1200, 800);

  assert.ok(foot.player.y > middle.player.y);
  assert.ok(middle.player.y > summit.player.y);
  assert.equal(foot.player.x, 1200 * 0.28);
  assert.equal(summit.camera.scale, 0.82);
});

test("路线覆盖剧情所需的角色动作", () => {
  assert.equal(getMountainActorLayout("lower", 900, 600).player.action, "walking");
  assert.equal(getMountainActorLayout("middle", 900, 600).player.action, "tired");
  assert.equal(getMountainActorLayout("cliff", 900, 600).player.action, "slipping");
  assert.equal(getMountainActorLayout("cliff", 900, 600).companion.action, "supporting");
  assert.equal(getMountainActorLayout("shelter", 900, 600).player.action, "hugging");
  assert.equal(getMountainActorLayout("shelter", 900, 600).companion.action, "comforting");
  assert.equal(getMountainActorLayout("return", 900, 600).companion.action, "distant");
});

function createFakeContext() {
  const operations = [];
  const context = {
    operations,
    save() { operations.push("save"); },
    restore() { operations.push("restore"); },
    translate() { operations.push("translate"); },
    scale() { operations.push("scale"); },
    rotate() { operations.push("rotate"); },
    beginPath() { operations.push("beginPath"); },
    closePath() { operations.push("closePath"); },
    moveTo() { operations.push("moveTo"); },
    lineTo() { operations.push("lineTo"); },
    quadraticCurveTo() { operations.push("quadraticCurveTo"); },
    bezierCurveTo() { operations.push("bezierCurveTo"); },
    arc() { operations.push("arc"); },
    ellipse() { operations.push("ellipse"); },
    fill() { operations.push("fill"); },
    stroke() { operations.push("stroke"); },
    fillRect() { operations.push("fillRect"); },
    strokeRect() { operations.push("strokeRect"); },
    clearRect() { operations.push("clearRect"); },
    fillText() { operations.push("fillText"); },
    setLineDash() { operations.push("setLineDash"); },
    createLinearGradient() {
      operations.push("gradient");
      return { addColorStop() {} };
    },
  };
  return context;
}

test("三种空间都会产生完整帧绘制操作", () => {
  for (const [scene, weather, waypoint] of [
    ["cafe", "clear", "cafe"],
    ["mountain", "storm", "cliff"],
    ["apartment", "night", "apartment"],
  ]) {
    const context = createFakeContext();
    drawMountainFrame(context, {
      scene,
      weather,
      waypoint,
      width: 1200,
      height: 800,
      playerCharacterId: "boy",
      companionCharacterId: "girl",
      elapsedSeconds: 1,
    });
    assert.ok(context.operations.includes("fillRect"), scene + " 应绘制背景");
    assert.ok(context.operations.includes("ellipse"), scene + " 应绘制场景或角色");
    assert.ok(context.operations.length > 30, scene + " 应绘制完整场景");
  }
});
