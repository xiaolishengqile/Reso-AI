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

test("剧情路标会映射到对应场景位置而非回退山脚", () => {
  const aliases = [
    ["cafe-table", "cafe"],
    ["lower-cliff", "lower"],
    ["mid-cliff", "middle"],
    ["storm-cliff", "cliff"],
    ["cave-entrance", "cliff"],
    ["cave", "shelter"],
    ["apartment-window", "apartment"],
    ["apartment-mirror", "apartment"],
    ["apartment-door", "apartment"],
  ];

  for (const [alias, waypoint] of aliases) {
    assert.deepEqual(
      getMountainActorLayout(alias, 1200, 800),
      getMountainActorLayout(waypoint, 1200, 800),
      alias + " 应使用 " + waypoint + " 的角色位置",
    );
  }
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
  const transforms = [];
  const context = {
    operations,
    transforms,
    save() { operations.push("save"); },
    restore() { operations.push("restore"); },
    translate(x, y) { operations.push("translate"); transforms.push(["translate", x, y]); },
    scale() { operations.push("scale"); },
    rotate(angle) { operations.push("rotate"); transforms.push(["rotate", angle]); },
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

test("帧数据可覆盖动作并隐藏公寓同行者", () => {
  const context = createFakeContext();
  drawMountainFrame(context, {
    scene: "apartment",
    waypoint: "apartment-door",
    width: 1200,
    height: 800,
    playerCharacterId: "boy",
    companionCharacterId: "girl",
    playerAction: "tired",
    companionAction: "hugging",
    showCompanion: false,
  });

  assert.ok(context.transforms.some(([kind, angle]) => kind === "rotate" && angle === 0.15));
  assert.ok(context.transforms.some(([kind, x, y]) => kind === "translate" && Math.round(x) === 492 && y === 576));
  assert.equal(
    context.transforms.some(([kind, x, y]) => kind === "translate" && Math.round(x) === 780 && y === 576),
    false,
  );
});

test("动作先固定在路标，再在局部坐标执行姿态变换", () => {
  function renderAction(playerAction) {
    const context = createFakeContext();
    drawMountainFrame(context, {
      scene: "mountain",
      waypoint: "cliff",
      width: 1200,
      height: 800,
      playerAction,
      showCompanion: false,
    });
    return context.transforms;
  }

  const slipping = renderAction("slipping");
  const standing = renderAction("standing");
  const commanding = renderAction("commanding");
  const lecturing = renderAction("lecturing");

  assert.deepEqual(slipping.slice(0, 3), [
    ["translate", 840, 312],
    ["translate", 4, 8],
    ["rotate", 0.38],
  ]);
  assert.deepEqual(standing[0], ["translate", 840, 312]);
  assert.deepEqual(commanding[0], ["translate", 840, 312]);
  assert.deepEqual(lecturing[0], ["translate", 840, 312]);
  assert.ok(commanding[2][1] < 0 && commanding[2][1] > -0.2);
  assert.ok(lecturing[2][1] > 0 && lecturing[2][1] < 0.2);
});
