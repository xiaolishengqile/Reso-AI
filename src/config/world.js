export const MAP_SIZE = Object.freeze({ width: 3400, height: 2200 });

export const WORLD_BOUNDS = Object.freeze({
  minX: 0,
  maxX: MAP_SIZE.width,
  minZ: 0,
  maxZ: MAP_SIZE.height,
});

const ASSET_BASE_URL = import.meta.env?.BASE_URL ?? "./";

function assetUrl(path) {
  return ASSET_BASE_URL + path;
}

function freezeArea(points) {
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

function bounds(x, z, width, height) {
  return Object.freeze({ x, z, width, height });
}

function cloudCover(sceneBounds, opacity = 0.96) {
  return Object.freeze({
    x: Math.max(0, sceneBounds.x - 100),
    z: Math.max(0, sceneBounds.z - 100),
    width: sceneBounds.width + 200,
    height: sceneBounds.height + 200,
    opacity,
  });
}

function sceneIsland(id, unlockOrder, assetUrl, sceneBounds, cover = null) {
  return Object.freeze({
    id,
    kind: "scene",
    unlockOrder,
    assetUrl,
    bounds: sceneBounds,
    cloudCover: cover,
  });
}

function futureIsland(unlockOrder, sceneBounds) {
  return Object.freeze({
    id: "future-" + unlockOrder,
    kind: "future",
    unlockOrder,
    assetUrl: null,
    bounds: sceneBounds,
    cloudCover: cloudCover(sceneBounds),
  });
}

const HOME_BOUNDS = bounds(1080, 900, 740, 580);
const MOUNTAIN_BOUNDS = bounds(390, 390, 760, 590);
const OFFICE_BOUNDS = bounds(1270, 190, 760, 600);

export const ISLANDS = Object.freeze([
  sceneIsland("home", 0, assetUrl("assets/islands/home.png"), HOME_BOUNDS),
  sceneIsland(
    "mountain",
    1,
    assetUrl("assets/islands/mountain.png"),
    MOUNTAIN_BOUNDS,
  ),
  sceneIsland(
    "office",
    2,
    assetUrl("assets/islands/office.png"),
    OFFICE_BOUNDS,
    cloudCover(OFFICE_BOUNDS, 0.94),
  ),
  futureIsland(3, bounds(2070, 130, 620, 480)),
  futureIsland(4, bounds(2730, 560, 620, 480)),
  futureIsland(5, bounds(2500, 1240, 620, 480)),
  futureIsland(6, bounds(1970, 1650, 620, 450)),
  futureIsland(7, bounds(1240, 1700, 620, 440)),
  futureIsland(8, bounds(430, 1530, 620, 460)),
  futureIsland(9, bounds(0, 940, 600, 470)),
]);

export const BRIDGES = Object.freeze([
  Object.freeze({
    id: "home-mountain",
    from: Object.freeze({ x: 1240, z: 1060 }),
    to: Object.freeze({ x: 1030, z: 820 }),
    width: 110,
    requiredOrder: 1,
  }),
  Object.freeze({
    id: "mountain-office",
    from: Object.freeze({ x: 1080, z: 725 }),
    to: Object.freeze({ x: 1380, z: 620 }),
    width: 110,
    requiredOrder: 2,
  }),
]);

function gateAcrossBridge(bridge, depth = 70) {
  const dx = bridge.to.x - bridge.from.x;
  const dz = bridge.to.z - bridge.from.z;
  const length = Math.hypot(dx, dz);
  const along = { x: dx / length, z: dz / length };
  const side = { x: -along.z, z: along.x };
  const center = {
    x: (bridge.from.x + bridge.to.x) / 2,
    z: (bridge.from.z + bridge.to.z) / 2,
  };
  const corners = [];
  for (const alongSign of [-1, 1]) {
    for (const sideSign of [-1, 1]) {
      corners.push({
        x: center.x
          + along.x * depth / 2 * alongSign
          + side.x * bridge.width / 2 * sideSign,
        z: center.z
          + along.z * depth / 2 * alongSign
          + side.z * bridge.width / 2 * sideSign,
      });
    }
  }
  return Object.freeze({
    bridgeId: bridge.id,
    requiredOrder: bridge.requiredOrder,
    minX: Math.min(...corners.map(({ x }) => x)),
    maxX: Math.max(...corners.map(({ x }) => x)),
    minZ: Math.min(...corners.map(({ z }) => z)),
    maxZ: Math.max(...corners.map(({ z }) => z)),
  });
}

export const LOCKED_GATES = Object.freeze([
  gateAcrossBridge(BRIDGES.find(({ id }) => id === "mountain-office")),
]);

function ellipseArea(centerX, centerZ, radiusX, radiusZ, segments = 16) {
  return freezeArea(Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return {
      x: centerX + Math.cos(angle) * radiusX,
      z: centerZ + Math.sin(angle) * radiusZ,
    };
  }));
}

function bridgeArea(bridge, overlap = 24) {
  const dx = bridge.to.x - bridge.from.x;
  const dz = bridge.to.z - bridge.from.z;
  const length = Math.hypot(dx, dz);
  const alongX = dx / length;
  const alongZ = dz / length;
  const sideX = -alongZ * bridge.width / 2;
  const sideZ = alongX * bridge.width / 2;
  const start = {
    x: bridge.from.x - alongX * overlap,
    z: bridge.from.z - alongZ * overlap,
  };
  const end = {
    x: bridge.to.x + alongX * overlap,
    z: bridge.to.z + alongZ * overlap,
  };
  return freezeArea([
    { x: start.x + sideX, z: start.z + sideZ },
    { x: end.x + sideX, z: end.z + sideZ },
    { x: end.x - sideX, z: end.z - sideZ },
    { x: start.x - sideX, z: start.z - sideZ },
  ]);
}

export const WALKABLE_AREAS = Object.freeze([
  ellipseArea(1450, 1180, 330, 230),
  ellipseArea(780, 700, 310, 225),
  ellipseArea(1650, 520, 310, 210),
  ...BRIDGES.map((bridge) => bridgeArea(bridge)),
]);

export const PLAYER_START = Object.freeze({ x: 1450, z: 1300 });
export const PLAYER_RADIUS = 15;
export const PLAYER_SPEED = 145;

export const LOCATIONS = Object.freeze([
  Object.freeze({
    id: "home",
    name: "家庭小屋",
    unlockOrder: 0,
    x: 1450,
    z: 1115,
    hitRadius: 130,
    interactionRadius: 235,
    approach: Object.freeze({ x: 1450, z: 1300 }),
    accent: "#b77b56",
    description: "旅程从熟悉的家和院子开始。",
    sceneDescription: "这里是玩家的出生地和家庭场景，不需要解锁。",
  }),
  Object.freeze({
    id: "mountain",
    name: "爬山岛",
    unlockOrder: 1,
    unlocksOrder: 2,
    x: 760,
    z: 650,
    hitRadius: 145,
    interactionRadius: 285,
    approach: Object.freeze({ x: 980, z: 760 }),
    accent: "#9b745c",
    description: "第一站：沿着山路走向云端。",
    sceneDescription: "走过绳桥就能开始爬山。完成这段旅程后，工作岛将会解锁。",
    completionLabel: "完成爬山，解锁工作岛",
  }),
  Object.freeze({
    id: "office",
    name: "工作岛",
    unlockOrder: 2,
    x: 1690,
    z: 475,
    hitRadius: 135,
    interactionRadius: 305,
    approach: Object.freeze({ x: 1435, z: 600 }),
    accent: "#647f8a",
    description: "第二站：进入办公室，开始新的故事。",
    lockedDescription: "工作岛尚未解锁，请先完成爬山。",
    sceneDescription: "桥的另一端是办公室场景，这里将承载工作与成长的故事。",
  }),
]);

export const OBSTACLES = Object.freeze([
  Object.freeze({ x: 1450, z: 1115, radius: 88 }),
  Object.freeze({ x: 760, z: 650, radius: 110 }),
  Object.freeze({ x: 1690, z: 475, radius: 92 }),
]);
