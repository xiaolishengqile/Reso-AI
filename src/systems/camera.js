const FOLLOW_WORLD_SIZE = Object.freeze({ width: 1700, height: 1100 });
const CAMERA_RESPONSE = 8;
const INTRO_OVERVIEW_SECONDS = 1.2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createOverviewTransform(
  viewWidth,
  viewHeight,
  mapWidth,
  mapHeight,
) {
  const scale = Math.min(viewWidth / mapWidth, viewHeight / mapHeight);
  return {
    scale,
    offsetX: (viewWidth - mapWidth * scale) / 2,
    offsetY: (viewHeight - mapHeight * scale) / 2,
  };
}

export function createFollowTransform(
  viewWidth,
  viewHeight,
  mapWidth,
  mapHeight,
  focus,
) {
  const overview = createOverviewTransform(
    viewWidth,
    viewHeight,
    mapWidth,
    mapHeight,
  );
  const scale = Math.max(
    overview.scale,
    Math.min(
      viewWidth / FOLLOW_WORLD_SIZE.width,
      viewHeight / FOLLOW_WORLD_SIZE.height,
    ),
  );
  return {
    scale,
    offsetX: clamp(
      viewWidth / 2 - focus.x * scale,
      viewWidth - mapWidth * scale,
      0,
    ),
    offsetY: clamp(
      viewHeight / 2 - focus.z * scale,
      viewHeight - mapHeight * scale,
      0,
    ),
  };
}

export function stepCamera(
  current,
  target,
  deltaSeconds,
  response = CAMERA_RESPONSE,
) {
  const amount = 1 - Math.exp(-response * Math.max(0, deltaSeconds));
  return {
    scale: current.scale + (target.scale - current.scale) * amount,
    offsetX: current.offsetX + (target.offsetX - current.offsetX) * amount,
    offsetY: current.offsetY + (target.offsetY - current.offsetY) * amount,
  };
}

export function resolveCameraMode({
  elapsedSeconds = 0,
  overviewRequested = false,
  moving = false,
} = {}) {
  if (moving) return "follow";
  if (elapsedSeconds < INTRO_OVERVIEW_SECONDS) return "overview";
  return overviewRequested ? "overview" : "follow";
}
