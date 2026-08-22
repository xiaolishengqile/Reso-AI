export const MAP_SIZE = Object.freeze({ width: 5300, height: 2200 });

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

export const CLOUD_COVER_ASSET_URL = assetUrl(
  "assets/effects/cloud-cover.png",
);

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

function sceneIsland(
  id,
  unlockOrder,
  assetUrl,
  sceneBounds,
  cover = null,
  rotation = 0,
) {
  return Object.freeze({
    id,
    kind: "scene",
    unlockOrder,
    assetUrl,
    bounds: sceneBounds,
    cloudCover: cover,
    rotation,
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

const HOME_BOUNDS = bounds(1750, 1580, 740, 580);
const MOUNTAIN_BOUNDS = bounds(1080, 1050, 760, 590);
const OFFICE_BOUNDS = bounds(80, 100, 760, 600);

export const ISLANDS = Object.freeze([
  sceneIsland("home", 0, assetUrl("assets/islands/home.png"), HOME_BOUNDS),
  sceneIsland(
    "mountain",
    1,
    assetUrl("assets/islands/mountain.png"),
    MOUNTAIN_BOUNDS,
    null,
    -0.29,
  ),
  sceneIsland(
    "office",
    2,
    assetUrl("assets/islands/office.png"),
    OFFICE_BOUNDS,
    cloudCover(OFFICE_BOUNDS, 0.94),
  ),
  futureIsland(3, bounds(1500, 110, 620, 480)),
  futureIsland(4, bounds(2160, 380, 620, 480)),
  futureIsland(5, bounds(2670, 900, 620, 480)),
  futureIsland(6, bounds(3300, 1320, 620, 480)),
  futureIsland(7, bounds(3890, 940, 620, 450)),
  futureIsland(8, bounds(4320, 260, 620, 460)),
  futureIsland(9, bounds(4650, 1010, 600, 470)),
]);

function islandWalkEllipse(island) {
  return Object.freeze({
    x: island.bounds.x + island.bounds.width / 2,
    z: island.bounds.z + island.bounds.height * 0.52,
    radiusX: island.bounds.width * 0.43,
    radiusZ: island.bounds.height * 0.37,
    rotation: island.rotation ?? 0,
  });
}

function ellipseEdgePoint(ellipse, toward) {
  const dx = toward.x - ellipse.x;
  const dz = toward.z - ellipse.z;
  const length = Math.hypot(dx, dz);
  const direction = { x: dx / length, z: dz / length };
  const cosine = Math.cos(ellipse.rotation);
  const sine = Math.sin(ellipse.rotation);
  const localDirection = {
    x: direction.x * cosine + direction.z * sine,
    z: -direction.x * sine + direction.z * cosine,
  };
  const distance = 1 / Math.sqrt(
    localDirection.x ** 2 / ellipse.radiusX ** 2
      + localDirection.z ** 2 / ellipse.radiusZ ** 2,
  );
  return Object.freeze({
    x: ellipse.x + direction.x * distance,
    z: ellipse.z + direction.z * distance,
  });
}

function bridgeBetween(fromIsland, toIsland) {
  const fromEllipse = islandWalkEllipse(fromIsland);
  const toEllipse = islandWalkEllipse(toIsland);
  return Object.freeze({
    id: fromIsland.id + "-" + toIsland.id,
    fromIslandId: fromIsland.id,
    toIslandId: toIsland.id,
    from: ellipseEdgePoint(fromEllipse, toEllipse),
    to: ellipseEdgePoint(toEllipse, fromEllipse),
    width: 110,
    requiredOrder: toIsland.unlockOrder,
  });
}

export const BRIDGES = Object.freeze(
  ISLANDS.slice(0, -1).map((island, index) => (
    bridgeBetween(island, ISLANDS[index + 1])
  )),
);

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

export const LOCKED_GATES = Object.freeze(
  BRIDGES
    .filter(({ requiredOrder }) => requiredOrder >= 2)
    .map((bridge) => gateAcrossBridge(bridge)),
);

function ellipseArea(
  centerX,
  centerZ,
  radiusX,
  radiusZ,
  rotation = 0,
  segments = 16,
) {
  return freezeArea(Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radiusX;
    const localZ = Math.sin(angle) * radiusZ;
    return {
      x: centerX + localX * Math.cos(rotation) - localZ * Math.sin(rotation),
      z: centerZ + localX * Math.sin(rotation) + localZ * Math.cos(rotation),
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
  ...ISLANDS.map((island) => {
    const ellipse = islandWalkEllipse(island);
    return ellipseArea(
      ellipse.x,
      ellipse.z,
      ellipse.radiusX,
      ellipse.radiusZ,
      ellipse.rotation,
    );
  }),
  ...BRIDGES.map((bridge) => bridgeArea(bridge)),
]);

export const PLAYER_START = Object.freeze({ x: 2130, z: 1880 });
export const PLAYER_RADIUS = 15;
export const PLAYER_SPEED = 145;

export const LOCATIONS = Object.freeze([
  Object.freeze({
    id: "home",
    name: "家庭小屋",
    unlockOrder: 0,
    x: 2120,
    z: 1770,
    hitRadius: 130,
    interactionRadius: 235,
    approach: Object.freeze({ x: 2130, z: 1880 }),
    accent: "#b77b56",
    description: "旅程从熟悉的家和院子开始。",
    sceneDescription: "这里是玩家的出生地和家庭场景，不需要解锁。",
  }),
  Object.freeze({
    id: "mountain",
    name: "爬山岛",
    unlockOrder: 1,
    unlocksOrder: 2,
    x: 1510,
    z: 1290,
    hitRadius: 145,
    interactionRadius: 285,
    approach: Object.freeze({ x: 1380, z: 1280 }),
    accent: "#9b745c",
    description: "第一站：沿着山路走向云端。",
    sceneDescription: "走过绳桥就能开始爬山。完成这段旅程后，工作岛将会解锁。",
    completionLabel: "完成爬山，解锁工作岛",
  }),
  Object.freeze({
    id: "office",
    name: "工作岛",
    unlockOrder: 2,
    x: 500,
    z: 300,
    hitRadius: 135,
    interactionRadius: 305,
    approach: Object.freeze({ x: 640, z: 450 }),
    accent: "#647f8a",
    description: "第二站：进入办公室，开始新的故事。",
    lockedDescription: "工作岛尚未解锁，请先完成爬山。",
    sceneDescription: "桥的另一端是办公室场景，这里将承载工作与成长的故事。",
  }),
]);

export const OBSTACLES = Object.freeze([
  Object.freeze({ x: 2120, z: 1770, radius: 88 }),
  Object.freeze({ x: 1510, z: 1290, radius: 90 }),
  Object.freeze({ x: 500, z: 300, radius: 92 }),
]);
