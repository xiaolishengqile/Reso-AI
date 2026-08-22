import {
  LOCATIONS,
  MAP_SIZE,
  OBSTACLES,
  PLAYER_START,
  WALKABLE_POLYGON,
  WORLD_BOUNDS,
} from "../config/world.js";
import { createInput } from "../systems/createInput.js";
import {
  createCoverTransform,
  directionToTarget,
  findNearbyLocation,
  isPointInPolygon,
  moveActor,
  screenToMap,
} from "../systems/movement.js";

const PLAYER_RADIUS = 15;
const PLAYER_SPEED = 230;

export function getLocationInteraction(clickedLocation, nearbyLocation) {
  if (!clickedLocation) {
    return Object.freeze({ canEnter: false, message: "请选择一个地点。" });
  }
  if (clickedLocation.id === nearbyLocation?.id) {
    return Object.freeze({
      canEnter: true,
      message: `准备进入「${clickedLocation.name}」`,
    });
  }
  return Object.freeze({
    canEnter: false,
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

function drawLocationGlow(context, location, active, elapsedSeconds) {
  const pulse = 1 + Math.sin(elapsedSeconds * 2.2 + location.x) * 0.06;
  const radius = location.hitRadius * 0.44 * pulse;
  context.save();
  context.globalAlpha = active ? 0.82 : 0.2;
  context.strokeStyle = location.accent;
  context.lineWidth = active ? 4 : 2;
  context.setLineDash(active ? [10, 7] : [5, 12]);
  context.beginPath();
  context.ellipse(
    location.x,
    location.z + 18,
    radius,
    radius * 0.42,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();
}

function drawTarget(context, target, elapsedSeconds) {
  if (!target) return;
  const radius = 10 + Math.sin(elapsedSeconds * 4) * 2;
  context.save();
  context.strokeStyle = "rgba(112, 76, 51, 0.72)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(target.x, target.z, radius, radius * 0.45, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawPlayer(context, player, direction, elapsedSeconds, moving) {
  const sway = moving ? Math.sin(elapsedSeconds * 11) * 2 : 0;
  const side = direction.x < -0.2 ? -1 : direction.x > 0.2 ? 1 : 0;

  context.save();
  context.translate(Math.round(player.x), Math.round(player.z));
  context.fillStyle = "rgba(65, 54, 43, 0.22)";
  context.beginPath();
  context.ellipse(0, 4, 16, 6, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#58463d";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-5, -3);
  context.lineTo(-7 - sway, 8);
  context.moveTo(5, -3);
  context.lineTo(7 + sway, 8);
  context.stroke();

  context.fillStyle = "#426b78";
  context.strokeStyle = "#4f413a";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-12, -28);
  context.quadraticCurveTo(0, -35, 12, -28);
  context.lineTo(9, 0);
  context.quadraticCurveTo(0, 7, -9, 0);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#edcfaa";
  context.beginPath();
  context.arc(side * 2, -36, 8, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#c49b59";
  context.beginPath();
  context.ellipse(0, -42, 17, 6, -0.08 * side, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(-8, -44);
  context.quadraticCurveTo(0, -61, 9, -44);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

export function createGame({
  canvas,
  ui,
  windowTarget = window,
  imageUrl = "/assets/world-map-painted.jpg",
}) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法创建二维画布");

  const input = createInput(windowTarget);
  const background = new windowTarget.Image();
  const player = { x: PLAYER_START.x, z: PLAYER_START.z };
  let transform = createCoverTransform(1, 1, MAP_SIZE.width, MAP_SIZE.height);
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let pointerTarget = null;
  let targetLocationId = null;
  let hoveredLocation = null;
  let nearbyLocation = null;
  let lastDirection = { x: 0, z: 1 };
  let statusLockedUntil = 0;
  let previousTime = 0;
  let frameId = 0;
  let started = false;

  function setStatus(message, lockMilliseconds = 0) {
    if (ui.status) ui.status.textContent = message;
    statusLockedUntil = windowTarget.performance.now() + lockMilliseconds;
  }

  function showLocationCard(location) {
    ui.locationCard?.classList.toggle("is-visible", Boolean(location));
    if (!location) return;
    if (ui.locationName) ui.locationName.textContent = location.name;
    if (ui.locationDescription) {
      ui.locationDescription.textContent = location.description;
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
    setHoveredLocation(findLocationAtPoint(eventToMap(event), LOCATIONS));
  }

  function onPointerLeave() {
    setHoveredLocation(null);
  }

  function openLocationDialog(location) {
    if (ui.dialogTitle) ui.dialogTitle.textContent = location.name;
    if (ui.dialogDescription) {
      ui.dialogDescription.textContent = location.sceneDescription;
    }
    ui.dialog?.style.setProperty("--scene-accent", location.accent);
    if (typeof ui.dialog?.showModal === "function" && !ui.dialog.open) {
      ui.dialog.showModal();
    } else {
      ui.dialog?.setAttribute("open", "");
    }
  }

  function onCanvasClick(event) {
    const point = eventToMap(event);
    const location = findLocationAtPoint(point, LOCATIONS);
    if (location) {
      const interaction = getLocationInteraction(location, nearbyLocation);
      setStatus(interaction.message, 1800);
      if (interaction.canEnter) {
        pointerTarget = null;
        targetLocationId = null;
        openLocationDialog(location);
      } else {
        pointerTarget = location.approach;
        targetLocationId = location.id;
      }
      return;
    }

    if (isPointInPolygon(point, WALKABLE_POLYGON)) {
      pointerTarget = point;
      targetLocationId = null;
      setStatus("沿着地图前往标记位置", 900);
    } else {
      setStatus("那里是云海，旅人无法抵达。", 1300);
    }
  }

  function closeDialog() {
    if (typeof ui.dialog?.close === "function" && ui.dialog.open) {
      ui.dialog.close();
    } else {
      ui.dialog?.removeAttribute("open");
    }
  }

  function resize() {
    width = Math.max(1, windowTarget.innerWidth ?? canvas.clientWidth);
    height = Math.max(1, windowTarget.innerHeight ?? canvas.clientHeight);
    pixelRatio = Math.min(windowTarget.devicePixelRatio ?? 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    transform = createCoverTransform(width, height, MAP_SIZE.width, MAP_SIZE.height);
  }

  function update(deltaSeconds) {
    let direction = input.getDirection();
    if (direction.x !== 0 || direction.z !== 0) {
      pointerTarget = null;
      targetLocationId = null;
    } else if (pointerTarget) {
      const targetDirection = directionToTarget(player, pointerTarget, 8);
      direction = targetDirection;
      if (targetDirection.arrived) {
        const arrivedLocation = LOCATIONS.find(
          ({ id }) => id === targetLocationId,
        );
        pointerTarget = null;
        targetLocationId = null;
        if (arrivedLocation) setStatus(`已抵达「${arrivedLocation.name}」附近`, 1400);
      }
    }

    const moving = direction.x !== 0 || direction.z !== 0;
    if (moving) {
      lastDirection = direction;
      const next = moveActor({
        position: player,
        direction,
        speed: PLAYER_SPEED,
        deltaSeconds,
        radius: PLAYER_RADIUS,
        bounds: WORLD_BOUNDS,
        obstacles: OBSTACLES,
        isWalkable: (point) => isPointInPolygon(point, WALKABLE_POLYGON),
      });
      player.x = next.x;
      player.z = next.z;
    }

    nearbyLocation = findNearbyLocation(player, LOCATIONS);
    if (windowTarget.performance.now() >= statusLockedUntil) {
      setStatus(
        nearbyLocation
          ? `已抵达「${nearbyLocation.name}」附近 · 点击地标进入`
          : "沿着道路探索，寻找三个发光地点",
      );
    }
    return moving;
  }

  function render(elapsedSeconds, moving) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#b9def0";
    context.fillRect(0, 0, width, height);
    if (background.complete && background.naturalWidth > 0) {
      context.drawImage(
        background,
        transform.offsetX,
        transform.offsetY,
        MAP_SIZE.width * transform.scale,
        MAP_SIZE.height * transform.scale,
      );
    }

    context.save();
    context.translate(transform.offsetX, transform.offsetY);
    context.scale(transform.scale, transform.scale);
    for (const location of LOCATIONS) {
      drawLocationGlow(
        context,
        location,
        location === hoveredLocation || location === nearbyLocation,
        elapsedSeconds,
      );
    }
    drawTarget(context, pointerTarget, elapsedSeconds);
    drawPlayer(context, player, lastDirection, elapsedSeconds, moving);
    context.restore();
  }

  function tick(time) {
    const deltaSeconds = Math.min((time - previousTime) / 1000 || 0, 0.033);
    previousTime = time;
    const moving = update(deltaSeconds);
    render(time / 1000, moving);
    frameId = windowTarget.requestAnimationFrame(tick);
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onCanvasClick);
  ui.closeButton?.addEventListener("click", closeDialog);
  windowTarget.addEventListener("resize", resize);
  background.addEventListener("error", () => setStatus("手绘地图底图加载失败。"));
  background.src = imageUrl;

  return Object.freeze({
    start() {
      if (started) return;
      started = true;
      resize();
      previousTime = windowTarget.performance.now();
      frameId = windowTarget.requestAnimationFrame(tick);
    },
    dispose() {
      windowTarget.cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onCanvasClick);
      ui.closeButton?.removeEventListener("click", closeDialog);
      windowTarget.removeEventListener("resize", resize);
      input.dispose();
    },
  });
}
