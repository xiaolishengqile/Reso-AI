const FOLLOW_WORLD_SIZE = Object.freeze({ width: 1700, height: 1100 });
const MAX_FOLLOW_SCALE = 0.82;
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
  visibleHeightRatio = 1,
) {
  const visibleHeight = viewHeight * clamp(visibleHeightRatio, 0.1, 1);
  const overview = createOverviewTransform(
    viewWidth,
    visibleHeight,
    mapWidth,
    mapHeight,
  );
  const scale = Math.max(
    overview.scale,
    Math.min(
      MAX_FOLLOW_SCALE,
      Math.min(
        viewWidth / FOLLOW_WORLD_SIZE.width,
        visibleHeight / FOLLOW_WORLD_SIZE.height,
      ),
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
      visibleHeight / 2 - focus.z * scale,
      visibleHeight - mapHeight * scale,
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
  dialogueActive = false,
} = {}) {
  if (dialogueActive) return "follow";
  if (moving) return "follow";
  if (elapsedSeconds < INTRO_OVERVIEW_SECONDS) return "overview";
  return overviewRequested ? "overview" : "follow";
}
