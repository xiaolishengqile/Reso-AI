export function getIslandRenderState(islands) {
  return islands.map((island) => ({
    ...island,
    showAsset: Boolean(island.assetUrl),
    showGenerated: false,
    showCloud: false,
  }));
}

export function createIslandImageStore(windowTarget, islands, onError) {
  const images = new Map();
  const listeners = new Map();
  for (const island of islands) {
    if (!island.assetUrl) continue;
    const image = new windowTarget.Image();
    const handleError = () => onError?.(island);
    image.addEventListener("error", handleError);
    image.src = island.assetUrl;
    images.set(island.id, image);
    listeners.set(island.id, handleError);
  }
  return Object.freeze({
    get(islandId) {
      return images.get(islandId);
    },
    dispose() {
      for (const [islandId, image] of images) {
        image.removeEventListener("error", listeners.get(islandId));
        image.src = "";
      }
      images.clear();
      listeners.clear();
    },
  });
}

export function drawWorldBackdrop(context, mapSize, elapsedSeconds) {
  const gradient = context.createLinearGradient(0, 0, 0, mapSize.height);
  gradient.addColorStop(0, "#9ed8eb");
  gradient.addColorStop(0.52, "#bce8ef");
  gradient.addColorStop(1, "#a7d9e9");
  context.fillStyle = gradient;
  context.fillRect(0, 0, mapSize.width, mapSize.height);

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 5;
  context.lineCap = "round";
  const drift = (elapsedSeconds * 7) % 180;
  for (let z = 150; z < mapSize.height; z += 240) {
    for (let x = -100; x < mapSize.width; x += 360) {
      context.beginPath();
      context.moveTo(x + drift, z);
      context.bezierCurveTo(
        x + 60 + drift,
        z - 18,
        x + 110 + drift,
        z + 18,
        x + 175 + drift,
        z,
      );
      context.stroke();
    }
  }
  context.restore();
}

const FOG_LAYERS = Object.freeze([
  { x: 0.08, z: 0.2, radiusX: 0.18, radiusZ: 0.11, speed: 9, phase: 0 },
  { x: 0.34, z: 0.42, radiusX: 0.22, radiusZ: 0.13, speed: 6, phase: 1.3 },
  { x: 0.62, z: 0.26, radiusX: 0.2, radiusZ: 0.12, speed: 8, phase: 2.4 },
  { x: 0.88, z: 0.56, radiusX: 0.24, radiusZ: 0.14, speed: 5, phase: 3.1 },
  { x: 0.12, z: 0.78, radiusX: 0.26, radiusZ: 0.15, speed: 7, phase: 4.2 },
]);

export function drawWorldFog(context, mapSize, elapsedSeconds = 0) {
  context.save();
  context.globalCompositeOperation = "screen";

  const veil = context.createLinearGradient(0, 0, mapSize.width, mapSize.height);
  veil.addColorStop(0, "rgba(242, 248, 246, 0.16)");
  veil.addColorStop(0.5, "rgba(255, 255, 255, 0.035)");
  veil.addColorStop(1, "rgba(238, 247, 248, 0.14)");
  context.fillStyle = veil;
  context.fillRect(0, 0, mapSize.width, mapSize.height);

  for (const layer of FOG_LAYERS) {
    const radiusX = mapSize.width * layer.radiusX;
    const radiusZ = mapSize.height * layer.radiusZ;
    const wrapWidth = mapSize.width + radiusX * 2;
    const x = ((mapSize.width * layer.x + elapsedSeconds * layer.speed + radiusX)
      % wrapWidth) - radiusX;
    const z = mapSize.height * layer.z
      + Math.sin(elapsedSeconds * 0.09 + layer.phase) * mapSize.height * 0.025;
    const gradient = context.createRadialGradient(x, z, 0, x, z, radiusX);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
    gradient.addColorStop(0.58, "rgba(244, 250, 249, 0.13)");
    gradient.addColorStop(1, "rgba(235, 245, 247, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, z, radiusX, radiusZ, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function bridgeGeometry(bridge) {
  const dx = bridge.to.x - bridge.from.x;
  const dz = bridge.to.z - bridge.from.z;
  return {
    length: Math.hypot(dx, dz),
    angle: Math.atan2(dz, dx),
  };
}

function drawBridge(context, bridge) {
  const geometry = bridgeGeometry(bridge);
  context.save();
  context.translate(bridge.from.x, bridge.from.z);
  context.rotate(geometry.angle);

  context.strokeStyle = "rgba(74, 61, 48, 0.2)";
  context.lineWidth = bridge.width + 22;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(0, 10);
  context.lineTo(geometry.length, 10);
  context.stroke();

  context.strokeStyle = "#bf8f50";
  context.lineWidth = bridge.width - 22;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(geometry.length, 0);
  context.stroke();

  context.strokeStyle = "#73513c";
  context.lineWidth = 5;
  for (let x = 8; x < geometry.length; x += 26) {
    context.beginPath();
    context.moveTo(x, -bridge.width / 2 + 10);
    context.lineTo(x, bridge.width / 2 - 10);
    context.stroke();
  }

  context.lineWidth = 4;
  context.strokeStyle = "#6c523f";
  for (const side of [-1, 1]) {
    const z = side * bridge.width / 2;
    context.beginPath();
    context.moveTo(0, z);
    context.quadraticCurveTo(geometry.length / 2, z + side * 13, geometry.length, z);
    context.stroke();
  }
  context.restore();

}

export function drawBridges(context, bridges) {
  for (const bridge of bridges) {
    drawBridge(context, bridge);
  }
}

function drawIslandAsset(context, island, image) {
  if (!image?.complete || image.naturalWidth <= 0) return;
  const { x, z, width, height } = island.bounds;
  context.save();
  context.shadowColor = "rgba(52, 77, 76, 0.2)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 16;
  context.translate(x + width / 2, z + height / 2);
  context.rotate(island.rotation ?? 0);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

export function drawIslandLayers(
  context,
  islands,
  imageStore,
) {
  const states = getIslandRenderState(islands);
  for (const island of states) {
    if (island.showAsset) {
      drawIslandAsset(context, island, imageStore.get(island.id));
    }
  }
}

function drawDecorationFallback(context, decoration) {
  const { x, z, width, height } = decoration;
  context.save();
  context.translate(x, z);
  context.fillStyle = "#6b4d38";
  context.fillRect(-width * 0.42, -height * 0.48, width * 0.84, height * 0.12);
  context.fillRect(-width * 0.35, -height * 0.42, width * 0.08, height * 0.4);
  context.fillRect(width * 0.27, -height * 0.42, width * 0.08, height * 0.4);
  context.fillStyle = "#514942";
  context.beginPath();
  context.ellipse(0, -height * 0.42, width * 0.25, height * 0.26, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#dec3a6";
  context.beginPath();
  context.arc(0, -height * 0.73, width * 0.17, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f0eadc";
  context.beginPath();
  context.arc(0, -height * 0.8, width * 0.17, Math.PI, Math.PI * 2);
  context.fill();
  context.fillStyle = "#b17b4e";
  context.fillRect(width * 0.12, -height * 0.48, width * 0.16, height * 0.12);
  context.restore();
}

export function drawWorldDecorations(context, decorations, imageStore) {
  for (const decoration of decorations) {
    const image = imageStore?.get?.(decoration.id);
    if (image?.complete && image.naturalWidth > 0) {
      context.save();
      context.drawImage(
        image,
        decoration.x - decoration.width / 2,
        decoration.z - decoration.height,
        decoration.width,
        decoration.height,
      );
      context.restore();
    } else {
      drawDecorationFallback(context, decoration);
    }
  }
}

export function drawLocationGlow(context, location, active, elapsedSeconds) {
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

export function drawTarget(context, target, elapsedSeconds) {
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
