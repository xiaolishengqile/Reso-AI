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

export const WORLD_DECORATIONS = Object.freeze([
  Object.freeze({
    id: "fog-valley-elder",
    sceneId: "home",
    assetUrl: assetUrl("assets/characters/elder-bench.png"),
    x: 1950,
    z: 1840,
    width: 96,
    height: 118,
  }),
]);

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
  theme = null,
) {
  return Object.freeze({
    id,
    kind: "scene",
    unlockOrder,
    assetUrl,
    renderMode: assetUrl ? "asset" : "generated",
    bounds: sceneBounds,
    cloudCover: cover,
    rotation,
    theme,
  });
}

function generatedIsland(id, unlockOrder, sceneBounds, theme) {
  return sceneIsland(
    id,
    unlockOrder,
    null,
    sceneBounds,
    cloudCover(sceneBounds),
    0,
    Object.freeze(theme),
  );
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
  generatedIsland("dining", 3, bounds(1500, 110, 620, 480), {
    ground: "#bd8a62", accent: "#f4d091", detail: "#f8ebce", prop: "dining",
  }),
  generatedIsland("cohabitation", 4, bounds(2160, 380, 620, 480), {
    ground: "#8f9f83", accent: "#e9c8a0", detail: "#dfe9d7", prop: "cohabitation",
  }),
  generatedIsland("money", 5, bounds(2670, 900, 620, 480), {
    ground: "#8c9675", accent: "#e8c46f", detail: "#e6edd2", prop: "money",
  }),
  generatedIsland("social", 6, bounds(3300, 1320, 620, 480), {
    ground: "#7e718b", accent: "#efb3c5", detail: "#e7dcef", prop: "social",
  }),
  generatedIsland("travel", 7, bounds(3890, 940, 620, 450), {
    ground: "#c39c68", accent: "#f3d78b", detail: "#d4edf0", prop: "travel",
  }),
  generatedIsland("future", 8, bounds(4320, 260, 620, 460), {
    ground: "#777998", accent: "#edc2aa", detail: "#ddd9f1", prop: "future",
  }),
  generatedIsland("wish", 9, bounds(4650, 1010, 600, 470), {
    ground: "#8b7698", accent: "#f2c5d5", detail: "#f5e9c8", prop: "wish",
  }),
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
    unlockOrder: 0,
    x: 2120,
    z: 1770,
    hitRadius: 130,
    interactionRadius: 235,
    approach: Object.freeze({ x: 2130, z: 1880 }),
  }),
  Object.freeze({
    id: "mountain",
    unlockOrder: 1,
    x: 1510,
    z: 1290,
    hitRadius: 145,
    interactionRadius: 285,
    approach: Object.freeze({ x: 1380, z: 1280 }),
  }),
  Object.freeze({
    id: "office",
    unlockOrder: 2,
    x: 500,
    z: 300,
    hitRadius: 135,
    interactionRadius: 305,
    approach: Object.freeze({ x: 640, z: 450 }),
  }),
  ...ISLANDS.slice(3).map((island) => {
    const center = {
      x: island.bounds.x + island.bounds.width / 2,
      z: island.bounds.z + island.bounds.height * 0.52,
    };
    return Object.freeze({
      id: island.id,
      unlockOrder: island.unlockOrder,
      x: center.x,
      z: center.z,
      hitRadius: 125,
      interactionRadius: 285,
      approach: Object.freeze({ ...center }),
    });
  }),
]);

export const OBSTACLES = Object.freeze([
  Object.freeze({ x: 2120, z: 1770, radius: 88 }),
  Object.freeze({ x: 1510, z: 1290, radius: 90 }),
  Object.freeze({ x: 500, z: 300, radius: 92 }),
]);
