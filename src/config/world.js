export const MAP_SIZE = Object.freeze({ width: 1536, height: 1024 });

export const WORLD_BOUNDS = Object.freeze({
  minX: 45,
  maxX: 1490,
  minZ: 25,
  maxZ: 995,
});

function freezeArea(points) {
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

export const WALKABLE_AREAS = Object.freeze([
  freezeArea([
    { x: 60, z: 300 },
    { x: 145, z: 120 },
    { x: 350, z: 25 },
    { x: 555, z: 100 },
    { x: 660, z: 285 },
    { x: 610, z: 475 },
    { x: 440, z: 575 },
    { x: 220, z: 545 },
    { x: 75, z: 430 },
  ]),
  freezeArea([
    { x: 870, z: 235 },
    { x: 965, z: 90 },
    { x: 1170, z: 30 },
    { x: 1375, z: 100 },
    { x: 1480, z: 275 },
    { x: 1415, z: 455 },
    { x: 1210, z: 545 },
    { x: 980, z: 455 },
  ]),
  freezeArea([
    { x: 340, z: 655 },
    { x: 430, z: 535 },
    { x: 650, z: 455 },
    { x: 905, z: 465 },
    { x: 1090, z: 560 },
    { x: 1180, z: 775 },
    { x: 1050, z: 925 },
    { x: 765, z: 1005 },
    { x: 485, z: 925 },
  ]),
  freezeArea([
    { x: 430, z: 430 },
    { x: 505, z: 405 },
    { x: 665, z: 570 },
    { x: 580, z: 640 },
  ]),
  freezeArea([
    { x: 585, z: 270 },
    { x: 945, z: 250 },
    { x: 955, z: 350 },
    { x: 590, z: 370 },
  ]),
]);

export const PLAYER_START = Object.freeze({ x: 650, z: 760 });
export const PLAYER_RADIUS = 15;
export const PLAYER_SPEED = 145;

export const LOCKED_GATES = Object.freeze([
  Object.freeze({
    requiredOrder: 2,
    minX: 905,
    maxX: 970,
    minZ: 245,
    maxZ: 370,
  }),
]);

export const LOCATIONS = Object.freeze([
  Object.freeze({
    id: "home",
    name: "家庭小屋",
    unlockOrder: 0,
    x: 770,
    z: 575,
    hitRadius: 120,
    interactionRadius: 205,
    approach: Object.freeze({ x: 650, z: 705 }),
    accent: "#b77b56",
    description: "旅程从熟悉的家和院子开始。",
    sceneDescription: "这里是玩家的出生地和家庭场景，不需要解锁。",
  }),
  Object.freeze({
    id: "mountain",
    name: "爬山岛",
    unlockOrder: 1,
    unlocksOrder: 2,
    x: 340,
    z: 165,
    hitRadius: 155,
    interactionRadius: 280,
    approach: Object.freeze({ x: 525, z: 350 }),
    accent: "#9b745c",
    description: "第一站：沿着山路走向云端。",
    sceneDescription: "走过绳桥就能开始爬山。完成这段旅程后，工作岛将会解锁。",
    completionLabel: "完成爬山，解锁工作岛",
  }),
  Object.freeze({
    id: "office",
    name: "工作岛",
    unlockOrder: 2,
    x: 1170,
    z: 155,
    hitRadius: 145,
    interactionRadius: 255,
    approach: Object.freeze({ x: 1030, z: 330 }),
    accent: "#647f8a",
    description: "第二站：进入办公室，开始新的故事。",
    lockedDescription: "工作岛尚未解锁，请先完成爬山。",
    sceneDescription: "桥的另一端是办公室场景，这里将承载工作与成长的故事。",
  }),
]);

export const OBSTACLES = Object.freeze([
  Object.freeze({ x: 770, z: 575, radius: 88 }),
  Object.freeze({ x: 340, z: 165, radius: 132 }),
  Object.freeze({ x: 1170, z: 155, radius: 105 }),
]);
