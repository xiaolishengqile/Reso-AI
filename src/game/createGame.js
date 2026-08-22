import * as THREE from "three";
import {
  LOCATIONS,
  OBSTACLES,
  PLAYER_START,
  WORLD_BOUNDS,
} from "../config/world.js";
import { createPlayer } from "../entities/createPlayer.js";
import { createInput } from "../systems/createInput.js";
import { findNearbyLocation, moveActor } from "../systems/movement.js";
import { createWorld } from "../world/createWorld.js";

const CAMERA_VIEW_HEIGHT = 28;
const CAMERA_OFFSET = new THREE.Vector3(18, 24, 22);

export function findLocationRoot(object) {
  let current = object;
  while (current) {
    if (current.userData?.locationId) return current;
    current = current.parent;
  }
  return null;
}

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
    message: `再靠近「${clickedLocation.name}」一些，入口才会回应。`,
  });
}

function disposeScene(scene) {
  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material].filter(Boolean);
    materials.forEach((material) => material.dispose?.());
  });
}

export function createGame({ canvas, ui, windowTarget = window }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(windowTarget.devicePixelRatio ?? 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-20, 20, 14, -14, 0.1, 120);
  const cameraFocus = new THREE.Vector3(0, 0, 1.5);
  camera.position.copy(cameraFocus).add(CAMERA_OFFSET);
  camera.lookAt(cameraFocus);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  const clock = new THREE.Clock();
  const input = createInput(windowTarget);
  const world = createWorld(scene);
  const player = createPlayer();
  player.group.position.set(PLAYER_START.x, 0.08, PLAYER_START.z);
  player.group.scale.setScalar(0.9);
  scene.add(player.group);

  let hoveredTarget = null;
  let elapsedSeconds = 0;
  let statusLockedUntil = 0;
  let started = false;

  function setStatus(message, lockMilliseconds = 0) {
    if (ui.status) ui.status.textContent = message;
    statusLockedUntil = performance.now() + lockMilliseconds;
  }

  function showLocationCard(location) {
    if (!ui.locationCard) return;
    ui.locationCard.classList.toggle("is-visible", Boolean(location));
    if (location) {
      if (ui.locationName) ui.locationName.textContent = location.name;
      if (ui.locationDescription) {
        ui.locationDescription.textContent = location.description;
      }
    }
  }

  function setHoveredTarget(target) {
    if (hoveredTarget === target) return;
    if (hoveredTarget?.userData.ring) {
      hoveredTarget.userData.ring.userData.hovered = false;
    }
    hoveredTarget = target;
    if (hoveredTarget?.userData.ring) {
      hoveredTarget.userData.ring.userData.hovered = true;
    }
    canvas.classList.toggle("is-pointing", Boolean(hoveredTarget));
    showLocationCard(hoveredTarget?.userData.location ?? null);
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function raycastLocation() {
    raycaster.setFromCamera(pointer, camera);
    const intersection = raycaster.intersectObjects(world.locationTargets, true)[0];
    const target = intersection ? findLocationRoot(intersection.object) : null;
    setHoveredTarget(target);
    return target;
  }

  function onPointerMove(event) {
    updatePointer(event);
    raycastLocation();
  }

  function onPointerLeave() {
    pointer.set(2, 2);
    setHoveredTarget(null);
  }

  function openLocationDialog(location) {
    if (ui.dialogTitle) ui.dialogTitle.textContent = location.name;
    if (ui.dialogDescription) {
      ui.dialogDescription.textContent = `${location.description} 独立场景将在下一阶段开放。`;
    }
    if (!ui.dialog) return;
    if (typeof ui.dialog.showModal === "function" && !ui.dialog.open) {
      ui.dialog.showModal();
    } else {
      ui.dialog.setAttribute("open", "");
    }
  }

  function onCanvasClick(event) {
    updatePointer(event);
    const clickedTarget = raycastLocation();
    if (!clickedTarget) return;

    const clickedLocation = clickedTarget.userData.location;
    const nearbyLocation = findNearbyLocation(player.group.position, LOCATIONS);
    const interaction = getLocationInteraction(clickedLocation, nearbyLocation);
    setStatus(interaction.message, 2200);
    if (interaction.canEnter) openLocationDialog(clickedLocation);
  }

  function closeDialog() {
    if (!ui.dialog) return;
    if (typeof ui.dialog.close === "function" && ui.dialog.open) {
      ui.dialog.close();
    } else {
      ui.dialog.removeAttribute("open");
    }
  }

  function resize() {
    const width = Math.max(1, windowTarget.innerWidth ?? canvas.clientWidth);
    const height = Math.max(1, windowTarget.innerHeight ?? canvas.clientHeight);
    const aspect = width / height;
    camera.left = (-CAMERA_VIEW_HEIGHT * aspect) / 2;
    camera.right = (CAMERA_VIEW_HEIGHT * aspect) / 2;
    camera.top = CAMERA_VIEW_HEIGHT / 2;
    camera.bottom = -CAMERA_VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(windowTarget.devicePixelRatio ?? 1, 1.5));
    renderer.setSize(width, height, false);
  }

  function animateWorld(deltaSeconds) {
    elapsedSeconds += deltaSeconds;
    for (const animated of world.animatedObjects) {
      if (animated.type === "cloud") {
        animated.object.userData.originY ??= animated.object.position.y;
        animated.object.position.x = animated.originX
          + Math.sin(elapsedSeconds * animated.speed + animated.phase) * 1.5;
        animated.object.position.y = animated.object.userData.originY
          + Math.sin(elapsedSeconds * 0.45 + animated.phase) * 0.18;
      }
      if (animated.type === "location") {
        const baseScale = animated.object.userData.baseScale ?? 1;
        const hoverScale = animated.object.userData.hovered ? 1.12 : 1;
        const pulse = 1 + Math.sin(elapsedSeconds * 2.2 + animated.phase) * 0.045;
        animated.object.scale.setScalar(baseScale * hoverScale * pulse);
        animated.object.rotation.y += deltaSeconds * 0.18;
      }
    }
  }

  function updateCamera(deltaSeconds) {
    const targetFocus = new THREE.Vector3(
      THREE.MathUtils.clamp(player.group.position.x * 0.42, -5.5, 5.5),
      0,
      THREE.MathUtils.clamp(player.group.position.z * 0.36, -3.8, 3.8),
    );
    const follow = 1 - Math.exp(-deltaSeconds * 3.4);
    cameraFocus.lerp(targetFocus, follow);
    camera.position.copy(cameraFocus).add(CAMERA_OFFSET);
    camera.lookAt(cameraFocus);
  }

  function updateProximityStatus() {
    if (performance.now() < statusLockedUntil) return;
    const nearby = findNearbyLocation(player.group.position, LOCATIONS);
    setStatus(
      nearby
        ? `已抵达「${nearby.name}」附近 · 点击发光地点`
        : "沿着道路探索，寻找三个发光地点",
    );
  }

  function tick() {
    const deltaSeconds = Math.min(clock.getDelta(), 0.033);
    const direction = input.getDirection();
    const next = moveActor({
      position: player.group.position,
      direction,
      speed: 5.4,
      deltaSeconds,
      radius: 0.45,
      bounds: WORLD_BOUNDS,
      obstacles: OBSTACLES,
    });
    player.group.position.set(next.x, 0.08, next.z);
    player.update(deltaSeconds, direction);
    animateWorld(deltaSeconds);
    updateCamera(deltaSeconds);
    updateProximityStatus();
    renderer.render(scene, camera);
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onCanvasClick);
  ui.closeButton?.addEventListener("click", closeDialog);
  windowTarget.addEventListener("resize", resize);

  return Object.freeze({
    start() {
      if (started) return;
      started = true;
      resize();
      clock.start();
      renderer.setAnimationLoop(tick);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onCanvasClick);
      ui.closeButton?.removeEventListener("click", closeDialog);
      windowTarget.removeEventListener("resize", resize);
      input.dispose();
      disposeScene(scene);
      renderer.dispose();
    },
  });
}
