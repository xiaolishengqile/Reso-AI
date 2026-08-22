const ASSET_BASE_URL = import.meta.env?.BASE_URL ?? "./";

function point(x, y) {
  return Object.freeze({ x, y });
}

function createMap(id, yValues) {
  const xValues = [0.17, 0.31, 0.45, 0.59, 0.73, 0.87];
  return Object.freeze({
    id,
    assetUrl: `${ASSET_BASE_URL}assets/story-maps/${id}.png`,
    entry: point(0.07, 0.76),
    stops: Object.freeze(xValues.map((x, index) => point(x, yValues[index]))),
    exit: point(0.95, 0.72),
  });
}

const MAPS = Object.freeze([
  createMap("office", [0.7, 0.62, 0.68, 0.58, 0.66, 0.56]),
  createMap("dining", [0.72, 0.64, 0.7, 0.61, 0.67, 0.59]),
  createMap("cohabitation", [0.69, 0.6, 0.67, 0.57, 0.65, 0.6]),
  createMap("money", [0.71, 0.62, 0.69, 0.59, 0.66, 0.57]),
  createMap("social", [0.7, 0.59, 0.66, 0.56, 0.64, 0.58]),
  createMap("travel", [0.72, 0.61, 0.68, 0.56, 0.64, 0.59]),
  createMap("future", [0.7, 0.6, 0.67, 0.57, 0.64, 0.58]),
]);

const MAP_BY_ID = new Map(MAPS.map((map) => [map.id, map]));

export function getStoryMap(storyId) {
  return MAP_BY_ID.get(storyId) ?? null;
}

export function getStoryStop(story, stageId) {
  const map = getStoryMap(story?.id);
  if (!map) return null;
  const stage = story?.stages?.find(({ id }) => id === stageId);
  if (!stage) return map.entry;
  if (stage.kind === "complete") return map.exit;
  const choiceStages = story.stages.filter(({ kind }) => kind === "choice");
  const index = choiceStages.findIndex(({ id }) => id === stageId);
  return map.stops[index] ?? map.entry;
}

export function createStoryTravel(from, to, startedAt, durationMs = 1400) {
  return Object.freeze({
    from: point(from.x, from.y),
    to: point(to.x, to.y),
    startedAt,
    durationMs: Math.max(1, durationMs),
  });
}

export function getStoryTravelFrame(travel, timestamp) {
  const progress = Math.max(
    0,
    Math.min(1, (timestamp - travel.startedAt) / travel.durationMs),
  );
  const eased = progress * progress * (3 - 2 * progress);
  return Object.freeze({
    progress,
    position: point(
      travel.from.x + (travel.to.x - travel.from.x) * eased,
      travel.from.y + (travel.to.y - travel.from.y) * eased,
    ),
    arrived: progress >= 1,
  });
}
