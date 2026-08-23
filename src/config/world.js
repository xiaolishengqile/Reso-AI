export const MAP_SIZE = Object.freeze({ width: 6500, height: 4000 });

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

export const WORLD_DECORATIONS = Object.freeze([
  Object.freeze({
    id: "fog-valley-elder",
    sceneId: "home",
    assetUrl: assetUrl("assets/characters/elder-bench.png"),
    x: 350,
    z: 3270,
    width: 96,
    height: 118,
    interactionRadius: 110,
  }),
]);

function freezeArea(points) {
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

function bounds(x, z, width, height) {
  return Object.freeze({ x, z, width, height });
}

function sceneIsland(
  id,
  unlockOrder,
  assetUrl,
  sceneBounds,
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
    rotation,
    theme,
  });
}

function illustratedIsland(id, unlockOrder, sceneBounds, theme) {
  return sceneIsland(
    id,
    unlockOrder,
    assetUrl(`assets/islands/${id}.png`),
    sceneBounds,
    0,
    Object.freeze(theme),
  );
}

const HOME_BOUNDS = bounds(150, 3010, 880, 680);
const MOUNTAIN_BOUNDS = bounds(860, 2625, 800, 620);
const OFFICE_BOUNDS = bounds(1535, 2280, 750, 580);

export const ISLANDS = Object.freeze([
  sceneIsland("home", 0, assetUrl("assets/islands/home.png"), HOME_BOUNDS),
  sceneIsland(
    "mountain",
    1,
    assetUrl("assets/islands/mountain.png"),
    MOUNTAIN_BOUNDS,
    -0.12,
  ),
  sceneIsland(
    "office",
    2,
    assetUrl("assets/islands/office.png"),
    OFFICE_BOUNDS,
  ),
  illustratedIsland("dining", 3, bounds(2190, 1993, 700, 540), {
    ground: "#bd8a62", accent: "#f4d091", detail: "#f8ebce", prop: "dining",
  }),
  illustratedIsland("cohabitation", 4, bounds(2805, 1697, 650, 505), {
    ground: "#8f9f83", accent: "#e9c8a0", detail: "#dfe9d7", prop: "cohabitation",
  }),
  illustratedIsland("money", 5, bounds(3375, 1423, 610, 475), {
    ground: "#8c9675", accent: "#e8c46f", detail: "#e6edd2", prop: "money",
  }),
  illustratedIsland("social", 6, bounds(3890, 1167, 580, 450), {
    ground: "#7e718b", accent: "#efb3c5", detail: "#e7dcef", prop: "social",
  }),
  illustratedIsland("travel", 7, bounds(4375, 910, 550, 425), {
    ground: "#c39c68", accent: "#f3d78b", detail: "#d4edf0", prop: "travel",
  }),
  illustratedIsland("future", 8, bounds(4830, 675, 520, 400), {
    ground: "#777998", accent: "#edc2aa", detail: "#ddd9f1", prop: "future",
  }),
  illustratedIsland("wish", 9, bounds(5295, 460, 490, 380), {
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
    width: 116 - fromIsland.unlockOrder * 5,
    requiredOrder: toIsland.unlockOrder,
  });
}

export const BRIDGES = Object.freeze(
  ISLANDS.slice(0, -1).map((island, index) => (
    bridgeBetween(island, ISLANDS[index + 1])
  )),
);

export const LOCKED_GATES = Object.freeze([]);

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

function bridgeArea(bridge, overlap = 48) {
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

export const PLAYER_START = Object.freeze({ x: 530, z: 3310 });
export const PLAYER_RADIUS = 15;
export const PLAYER_SPEED = 145;

export const LOCATIONS = Object.freeze([
  Object.freeze({
    id: "home",
    unlockOrder: 0,
    x: 520,
    z: 3200,
    hitRadius: 130,
    interactionRadius: 235,
    approach: Object.freeze({ x: 530, z: 3310 }),
  }),
  Object.freeze({
    id: "mountain",
    unlockOrder: 1,
    x: 1290,
    z: 2865,
    hitRadius: 145,
    interactionRadius: 285,
    approach: Object.freeze({ x: 1160, z: 3089 }),
  }),
  Object.freeze({
    id: "office",
    unlockOrder: 2,
    x: 1955,
    z: 2480,
    hitRadius: 135,
    interactionRadius: 305,
    approach: Object.freeze({ x: 1860, z: 2630 }),
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
  Object.freeze({ x: 520, z: 3200, radius: 88 }),
  Object.freeze({ x: 1290, z: 2865, radius: 90 }),
  Object.freeze({ x: 1955, z: 2480, radius: 92 }),
]);
