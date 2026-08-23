import test from "node:test";
import assert from "node:assert/strict";
import * as character from "../src/entities/character.js";

test("角色选项包含男生和女生", () => {
  assert.deepEqual(
    character.CHARACTER_OPTIONS.map(({ id, name }) => ({ id, name })),
    [
      { id: "boy", name: "男生" },
      { id: "girl", name: "女生" },
    ],
  );
});

test("角色会根据移动方向切换正面、侧面和背面", () => {
  assert.deepEqual(character.getCharacterFacing({ x: 0, z: 1 }), {
    view: "front",
    flip: false,
  });
  assert.deepEqual(character.getCharacterFacing({ x: 0, z: -1 }), {
    view: "back",
    flip: false,
  });
  assert.deepEqual(character.getCharacterFacing({ x: 1, z: 0 }), {
    view: "side",
    flip: false,
  });
  assert.deepEqual(character.getCharacterFacing({ x: -1, z: 0 }), {
    view: "side",
    flip: true,
  });
});

test("未知角色会安全回退到男生造型", () => {
  assert.equal(character.getCharacterProfile("unknown").id, "boy");
});

test("男生和女生使用不同的轮廓特征而不是只替换颜色", () => {
  const boy = character.getCharacterProfile("boy");
  const girl = character.getCharacterProfile("girl");

  assert.deepEqual(
    { hairStyle: boy.hairStyle, glasses: boy.glasses, sleeves: boy.sleeves },
    { hairStyle: "short-tousled", glasses: true, sleeves: "long" },
  );
  assert.deepEqual(
    { hairStyle: girl.hairStyle, glasses: girl.glasses, sleeves: girl.sleeves },
    { hairStyle: "long-wavy", glasses: false, sleeves: "short" },
  );
});

test("侧向行走使用接触、过渡、反向接触、过渡的连续帧", () => {
  assert.equal(typeof character.getCharacterAnimationFrame, "function");
  const direction = { x: 1, z: 0 };
  const frames = [0, 1 / 6, 2 / 6, 3 / 6].map((elapsedSeconds) => (
    character.getCharacterAnimationFrame(direction, elapsedSeconds, true)
  ));

  assert.deepEqual(frames, [
    { column: 0, row: 1 },
    { column: 1, row: 1 },
    { column: 2, row: 1 },
    { column: 1, row: 1 },
  ]);
});

test("绘制已加载角色时从动作图取帧而不是退回几何小人", () => {
  const drawCalls = [];
  const context = {
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {},
    ellipse() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, closePath() {},
    drawImage(...args) { drawCalls.push(args); },
  };
  const spriteImage = {
    complete: true,
    naturalWidth: 1536,
    naturalHeight: 1024,
  };

  character.drawCharacter(context, {
    characterId: "boy",
    position: { x: 10, z: 20 },
    direction: { x: 1, z: 0 },
    elapsedSeconds: 1 / 6,
    moving: true,
    spriteImage,
  });

  assert.equal(drawCalls.length, 1);
  assert.deepEqual(drawCalls[0].slice(1, 5), [512, 512, 512, 512]);
});

test("男女行走原图朝向不同时仍会面向实际移动方向", () => {
  assert.equal(typeof character.getCharacterSpriteFlip, "function");
  const walkFrame = { column: 0, row: 1 };
  const movingRight = { x: 1, z: 0 };

  assert.equal(character.getCharacterSpriteFlip("boy", walkFrame, movingRight), true);
  assert.equal(character.getCharacterSpriteFlip("girl", walkFrame, movingRight), false);
});
