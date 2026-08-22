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
