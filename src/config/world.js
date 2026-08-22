export const WORLD_BOUNDS = Object.freeze({
  minX: -18,
  maxX: 18,
  minZ: -12,
  maxZ: 12,
});

export const PLAYER_START = Object.freeze({ x: 0, z: 8 });

export const LOCATIONS = Object.freeze([
  Object.freeze({
    id: "cloud-ridge",
    name: "云脊山",
    x: -10,
    z: -4,
    interactionRadius: 4,
    color: 0xc9826d,
    description: "高山后的风，正在呼唤远行者。",
  }),
  Object.freeze({
    id: "whispering-woods",
    name: "风语林",
    x: 9,
    z: 4,
    interactionRadius: 3.5,
    color: 0x6f9f73,
    description: "林间小径藏着尚未展开的故事。",
  }),
  Object.freeze({
    id: "starfall-ruins",
    name: "星痕遗迹",
    x: 10,
    z: -6,
    interactionRadius: 3.5,
    color: 0xb18a76,
    description: "古老石环记录着天空的裂痕。",
  }),
]);

export const OBSTACLES = Object.freeze([
  Object.freeze({ x: -10, z: -4, radius: 2.4 }),
  Object.freeze({ x: 9, z: 4, radius: 1.7 }),
  Object.freeze({ x: 10, z: -6, radius: 1.5 }),
  Object.freeze({ x: -2, z: -2, radius: 1.8 }),
]);
