import {
  BRIDGES,
  CLOUD_COVER_ASSET_URL,
  ISLANDS,
  LOCATIONS,
  LOCKED_GATES,
  MAP_SIZE,
  OBSTACLES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAYER_START,
  WALKABLE_AREAS,
  WORLD_BOUNDS,
} from "../config/world.js";
import { drawCharacter } from "../entities/character.js";
import {
  createIslandImageStore,
  drawBridges,
  drawIslandLayers,
  drawLocationGlow,
  drawTarget,
  drawWorldBackdrop,
} from "./mapRenderer.js";
import {
  createFollowTransform,
  createOverviewTransform,
  resolveCameraMode,
  stepCamera,
} from "../systems/camera.js";
import { createInput } from "../systems/createInput.js";
import {
  directionFromMovement,
  directionToTarget,
  findNearbyLocation,
  getStallDuration,
  isCircleInPolygons,
  moveActor,
  screenToMap,
} from "../systems/movement.js";
import {
  advanceUnlockOrder,
  canTraversePoint,
  INITIAL_UNLOCK_ORDER,
  isLocationUnlocked,
} from "../systems/progression.js";
import { createSceneManager } from "../scenes/createSceneManager.js";
import {
  createSceneLocations,
  getSceneJourneyStatus,
  getSceneLegendState,
} from "../scenes/registry.js";

const BACKGROUND_ERROR_MESSAGE = "手绘地图底图加载失败，请刷新页面重试。";

export function getLocationInteraction(
  clickedLocation,
  nearbyLocation,
  unlocked = true,
) {
  if (!clickedLocation) {
    return Object.freeze({
      canEnter: false,
      canApproach: false,
      message: "请选择一个地点。",
    });
  }
  if (!unlocked) {
    return Object.freeze({
      canEnter: false,
      canApproach: false,
      message: clickedLocation.lockedDescription
        ?? `${clickedLocation.name}尚未解锁，请先完成爬山。`,
    });
  }
  if (clickedLocation.id === nearbyLocation?.id) {
    return Object.freeze({
      canEnter: true,
      canApproach: false,
      message: `准备进入「${clickedLocation.name}」`,
    });
  }
  return Object.freeze({
    canEnter: false,
    canApproach: true,
    message: `正在前往「${clickedLocation.name}」`,
  });
}

export function findLocationAtPoint(point, locations) {
  return locations
    .map((location) => ({
      location,
      distance: Math.hypot(point.x - location.x, point.z - location.z),
    }))
    .filter(({ location, distance }) => distance <= location.hitRadius)
    .sort((left, right) => left.distance - right.distance)[0]?.location ?? null;
}

export function getExplorationStatus({
  backgroundFailed,
  failedAssetName,
  nearbyLocation,
  nearbyUnlocked = true,
  journeyStatus = "继续探索人生群岛",
}) {
  if (backgroundFailed) {
    return failedAssetName
      ? "“" + failedAssetName + "”素材加载失败，请刷新页面重试。"
      : BACKGROUND_ERROR_MESSAGE;
  }
  if (nearbyLocation && !nearbyUnlocked) {
    return nearbyLocation.lockedDescription;
  }
  return nearbyLocation
    ? `已抵达「${nearbyLocation.name}」附近 · 点击地标进入`
    : journeyStatus;
}

export function resolveStatusUpdate({
  backgroundFailed,
  failedAssetName,
  message,
  now,
  lockMilliseconds,
}) {
  return backgroundFailed
    ? {
        message: failedAssetName
          ? "“" + failedAssetName + "”素材加载失败，请刷新页面重试。"
          : BACKGROUND_ERROR_MESSAGE,
        lockedUntil: Number.POSITIVE_INFINITY,
      }
    : { message, lockedUntil: now + lockMilliseconds };
}

export function createGame({
  canvas,
  ui,
  characterId,
  windowTarget = window,
}) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法创建二维画布");

  const input = createInput(windowTarget);
  const locations = createSceneLocations(LOCATIONS);
  const player = { x: PLAYER_START.x, z: PLAYER_START.z };
  let transform = createOverviewTransform(
    1,
    1,
    MAP_SIZE.width,
    MAP_SIZE.height,
  );
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let pointerTarget = null;
  let targetLocationId = null;
  let hoveredLocation = null;
  let nearbyLocation = null;
  let unlockedOrder = INITIAL_UNLOCK_ORDER;
  let backgroundFailed = false;
  let failedAssetName = null;
  let stalledSeconds = 0;
  let lastDirection = { x: 0, z: 1 };
  let statusLockedUntil = 0;
  let previousTime = 0;
  let elapsedSinceStart = 0;
  let frameId = 0;
  let started = false;
  let overviewRequested = false;

  function completeScene(scene) {
    const nextOrder = advanceUnlockOrder(unlockedOrder, scene);
    if (nextOrder === unlockedOrder) return;
    unlockedOrder = nextOrder;
    updateLegend();
    showLocationCard(hoveredLocation);
    setStatus(scene.completionMessage ?? "场景已完成。", 2600);
  }

  const sceneManager = createSceneManager({ ui, onComplete: completeScene });

  function setOverviewRequested(requested) {
    overviewRequested = requested;
    ui.overviewButton?.classList.toggle("is-active", requested);
    ui.overviewButton?.setAttribute("aria-pressed", String(requested));
    ui.overviewButton?.setAttribute(
      "aria-label",
      requested ? "返回人物近景" : "查看全岛",
    );
  }

  function toggleOverview() {
    setOverviewRequested(!overviewRequested);
  }

  function canStandAt(point) {
    return isCircleInPolygons(point, PLAYER_RADIUS, WALKABLE_AREAS)
      && canTraversePoint(
        point,
        unlockedOrder,
        LOCKED_GATES,
        PLAYER_RADIUS,
      );
  }

  function setStatus(message, lockMilliseconds = 0) {
    const update = resolveStatusUpdate({
      backgroundFailed,
      failedAssetName,
      message,
      now: windowTarget.performance.now(),
      lockMilliseconds,
    });
    if (ui.status) ui.status.textContent = update.message;
    statusLockedUntil = update.lockedUntil;
  }

  function updateLegend() {
    for (const item of ui.legendItems ?? []) {
      const location = locations.find(({ id }) => id === item.dataset.locationId);
      if (!location) continue;
      const unlocked = isLocationUnlocked(location, unlockedOrder);
      item.classList.toggle("is-locked", !unlocked);
      const state = item.querySelector("[data-location-state]");
      if (!state) continue;
      state.textContent = getSceneLegendState(
        location,
        unlocked,
        unlockedOrder,
      );
    }
  }

  function showLocationCard(location) {
    ui.locationCard?.classList.toggle("is-visible", Boolean(location));
    if (!location) return;
    if (ui.locationName) ui.locationName.textContent = location.name;
    if (ui.locationDescription) {
      ui.locationDescription.textContent = isLocationUnlocked(location, unlockedOrder)
        ? location.description
        : location.lockedDescription;
    }
    if (ui.locationHint) {
      ui.locationHint.textContent = isLocationUnlocked(location, unlockedOrder)
        ? "靠近后点击进入"
        : "完成爬山后解锁";
    }
  }

  function setHoveredLocation(location) {
    if (hoveredLocation === location) return;
    hoveredLocation = location;
    canvas.classList.toggle("is-pointing", Boolean(location));
    showLocationCard(location);
  }

  function eventToMap(event) {
    const rect = canvas.getBoundingClientRect();
    return screenToMap(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      transform,
    );
  }

  function onPointerMove(event) {
    setHoveredLocation(findLocationAtPoint(eventToMap(event), locations));
  }

  function onPointerLeave() {
    setHoveredLocation(null);
  }

  function onCanvasClick(event) {
    const point = eventToMap(event);
    const location = findLocationAtPoint(point, locations);
    if (location) {
      const interaction = getLocationInteraction(
        location,
        nearbyLocation,
        isLocationUnlocked(location, unlockedOrder),
      );
      setStatus(interaction.message, 1800);
      if (interaction.canEnter) {
        pointerTarget = null;
        targetLocationId = null;
        stalledSeconds = 0;
        sceneManager.open(location, {
          canComplete: Boolean(
            location.completionLabel
              && unlockedOrder < location.unlocksOrder,
          ),
        });
      } else if (interaction.canApproach) {
        pointerTarget = location.approach;
        targetLocationId = location.id;
        stalledSeconds = 0;
      }
      return;
    }

    if (canStandAt(point)) {
      pointerTarget = point;
      targetLocationId = null;
      stalledSeconds = 0;
      setStatus("沿着地图前往标记位置", 900);
    } else {
      setStatus("那里是云海，旅人无法抵达。", 1300);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || canvas.clientWidth || windowTarget.innerWidth);
    height = Math.max(1, rect.height || canvas.clientHeight || windowTarget.innerHeight);
    pixelRatio = Math.min(windowTarget.devicePixelRatio ?? 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    transform = createOverviewTransform(
      width,
      height,
      MAP_SIZE.width,
      MAP_SIZE.height,
    );
  }

  function update(deltaSeconds) {
    let direction = input.getDirection();
    if (direction.x !== 0 || direction.z !== 0) {
      pointerTarget = null;
      targetLocationId = null;
      stalledSeconds = 0;
    } else if (pointerTarget) {
      const targetDirection = directionToTarget(player, pointerTarget, 8);
      direction = targetDirection;
      if (targetDirection.arrived) {
        const arrivedLocation = locations.find(
          ({ id }) => id === targetLocationId,
        );
        pointerTarget = null;
        targetLocationId = null;
        stalledSeconds = 0;
        if (arrivedLocation) setStatus(`已抵达「${arrivedLocation.name}」附近`, 1400);
      }
    }

    const wantsToMove = direction.x !== 0 || direction.z !== 0;
    let moving = false;
    if (wantsToMove) {
      const previousPosition = { x: player.x, z: player.z };
      const next = moveActor({
        position: player,
        direction,
        speed: PLAYER_SPEED,
        deltaSeconds,
        radius: PLAYER_RADIUS,
        bounds: WORLD_BOUNDS,
        obstacles: OBSTACLES,
        isWalkable: canStandAt,
      });
      player.x = next.x;
      player.z = next.z;
      const actualDirection = directionFromMovement(
        previousPosition,
        next,
        lastDirection,
      );
      moving = actualDirection !== lastDirection;
      if (moving) lastDirection = actualDirection;

      if (pointerTarget) {
        stalledSeconds = getStallDuration(
          previousPosition,
          next,
          stalledSeconds,
          deltaSeconds,
        );
        if (stalledSeconds >= 0.35) {
          pointerTarget = null;
          targetLocationId = null;
          stalledSeconds = 0;
          setStatus("前方道路不通，请换个位置。", 1600);
        }
      }
    }

    nearbyLocation = findNearbyLocation(player, locations);
    if (windowTarget.performance.now() >= statusLockedUntil) {
      setStatus(getExplorationStatus({
        backgroundFailed,
        nearbyLocation,
        nearbyUnlocked: !nearbyLocation
          || isLocationUnlocked(nearbyLocation, unlockedOrder),
        journeyStatus: getSceneJourneyStatus(locations, unlockedOrder),
      }));
    }
    return moving;
  }

  function render(elapsedSeconds, moving) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#9ed8eb";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(transform.offsetX, transform.offsetY);
    context.scale(transform.scale, transform.scale);
    drawWorldBackdrop(context, MAP_SIZE, elapsedSeconds);
    drawBridges(context, BRIDGES, unlockedOrder);
    drawIslandLayers(
      context,
      ISLANDS,
      islandImages,
      unlockedOrder,
      elapsedSeconds,
      effectImages.get("cloud-cover"),
    );
    for (const location of locations) {
      if (isLocationUnlocked(location, unlockedOrder)) {
        drawLocationGlow(
          context,
          location,
          location === hoveredLocation || location === nearbyLocation,
          elapsedSeconds,
        );
      }
    }
    drawTarget(context, pointerTarget, elapsedSeconds);
    drawCharacter(context, {
      characterId,
      position: player,
      direction: lastDirection,
      elapsedSeconds,
      moving,
    });
    context.restore();
  }

  function tick(time) {
    const deltaSeconds = Math.min((time - previousTime) / 1000 || 0, 0.033);
    previousTime = time;
    elapsedSinceStart += deltaSeconds;
    const moving = update(deltaSeconds);
    if (moving && overviewRequested) setOverviewRequested(false);
    const cameraMode = resolveCameraMode({
      elapsedSeconds: elapsedSinceStart,
      overviewRequested,
      moving,
    });
    const cameraTarget = cameraMode === "follow"
      ? createFollowTransform(
          width,
          height,
          MAP_SIZE.width,
          MAP_SIZE.height,
          player,
        )
      : createOverviewTransform(
          width,
          height,
          MAP_SIZE.width,
          MAP_SIZE.height,
        );
    transform = stepCamera(transform, cameraTarget, deltaSeconds);
    render(time / 1000, moving);
    frameId = windowTarget.requestAnimationFrame(tick);
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onCanvasClick);
  ui.overviewButton?.addEventListener("click", toggleOverview);
  windowTarget.addEventListener("resize", resize);
  const islandImages = createIslandImageStore(windowTarget, ISLANDS, (island) => {
    backgroundFailed = true;
    failedAssetName = locations.find(({ id }) => id === island.id)?.name
      ?? island.id;
    setStatus(getExplorationStatus({
      backgroundFailed,
      failedAssetName,
      nearbyLocation,
    }));
  });
  const effectImages = createIslandImageStore(windowTarget, [
    { id: "cloud-cover", assetUrl: CLOUD_COVER_ASSET_URL },
  ]);

  return Object.freeze({
    start() {
      if (started) return;
      started = true;
      resize();
      updateLegend();
      setOverviewRequested(false);
      previousTime = windowTarget.performance.now();
      frameId = windowTarget.requestAnimationFrame(tick);
    },
    dispose() {
      windowTarget.cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onCanvasClick);
      ui.overviewButton?.removeEventListener("click", toggleOverview);
      windowTarget.removeEventListener("resize", resize);
      islandImages.dispose();
      effectImages.dispose();
      sceneManager.dispose();
      input.dispose();
    },
  });
}
