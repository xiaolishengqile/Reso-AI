export const MAP_SIZE = Object.freeze({ width: 1536, height: 1024 });

export const WORLD_BOUNDS = Object.freeze({
  minX: 150,
  maxX: 1386,
  minZ: 180,
  maxZ: 910,
});

export const WALKABLE_POLYGON = Object.freeze([
  Object.freeze({ x: 185, z: 520 }),
  Object.freeze({ x: 280, z: 340 }),
  Object.freeze({ x: 515, z: 215 }),
  Object.freeze({ x: 760, z: 275 }),
  Object.freeze({ x: 1010, z: 220 }),
  Object.freeze({ x: 1270, z: 325 }),
  Object.freeze({ x: 1370, z: 520 }),
  Object.freeze({ x: 1285, z: 785 }),
  Object.freeze({ x: 1050, z: 875 }),
  Object.freeze({ x: 790, z: 825 }),
  Object.freeze({ x: 545, z: 900 }),
  Object.freeze({ x: 290, z: 770 }),
]);

export const PLAYER_START = Object.freeze({ x: 620, z: 780 });

export const LOCATIONS = Object.freeze([
  Object.freeze({
    id: "cloud-ridge",
    name: "云脊山",
    x: 425,
    z: 320,
    hitRadius: 105,
    interactionRadius: 145,
    approach: Object.freeze({ x: 520, z: 420 }),
    accent: "#ba755d",
    description: "高山后的风，正在呼唤远行者。",
    sceneDescription: "山门之后是一条通往云端神殿的石阶。这里作为独立场景入口演示。",
  }),
  Object.freeze({
    id: "whispering-woods",
    name: "风语林",
    x: 1150,
    z: 300,
    hitRadius: 112,
    interactionRadius: 180,
    approach: Object.freeze({ x: 1050, z: 420 }),
    accent: "#608d68",
    description: "林间小径藏着尚未展开的故事。",
    sceneDescription: "古树下的门扉泛着微光，穿过它就能进入林中的独立故事。",
  }),
  Object.freeze({
    id: "starfall-ruins",
    name: "星痕遗迹",
    x: 1125,
    z: 675,
    hitRadius: 125,
    interactionRadius: 180,
    approach: Object.freeze({ x: 965, z: 720 }),
    accent: "#9b7464",
    description: "古老石环记录着天空的裂痕。",
    sceneDescription: "环形遗迹中央仍有微弱回声，这里将承载遗迹探索场景。",
  }),
]);

export const OBSTACLES = Object.freeze([
  Object.freeze({ x: 425, z: 320, radius: 76 }),
  Object.freeze({ x: 1150, z: 300, radius: 74 }),
  Object.freeze({ x: 1125, z: 675, radius: 92 }),
  Object.freeze({ x: 760, z: 500, radius: 44 }),
]);
