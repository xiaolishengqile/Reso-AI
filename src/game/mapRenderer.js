export function getIslandRenderState(islands, unlockedOrder) {
  return islands.map((island) => ({
    ...island,
    showAsset: Boolean(island.assetUrl),
    showCloud: Boolean(
      island.cloudCover && island.unlockOrder > unlockedOrder,
    ),
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

function bridgeGeometry(bridge) {
  const dx = bridge.to.x - bridge.from.x;
  const dz = bridge.to.z - bridge.from.z;
  return {
    length: Math.hypot(dx, dz),
    angle: Math.atan2(dz, dx),
  };
}

function drawBridge(context, bridge, unlockedOrder) {
  const geometry = bridgeGeometry(bridge);
  const locked = unlockedOrder < bridge.requiredOrder;
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

  context.strokeStyle = locked ? "#b9aa90" : "#bf8f50";
  context.lineWidth = bridge.width - 22;
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(geometry.length, 0);
  context.stroke();

  context.strokeStyle = locked ? "#8d8376" : "#73513c";
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

  if (locked) drawBridgeLock(context, bridge, geometry);
}

function drawBridgeLock(context, bridge, geometry) {
  const x = (bridge.from.x + bridge.to.x) / 2;
  const z = (bridge.from.z + bridge.to.z) / 2;
  context.save();
  context.translate(x, z);
  context.rotate(geometry.angle);
  context.fillStyle = "rgba(247, 242, 222, 0.95)";
  context.strokeStyle = "#6f5b4e";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, 34, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(0, -7, 10, Math.PI, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#6f5b4e";
  context.fillRect(-13, -7, 26, 22);
  context.restore();
}

export function drawBridges(context, bridges, unlockedOrder) {
  for (const bridge of bridges) {
    drawBridge(context, bridge, unlockedOrder);
  }
}

function drawIslandAsset(context, island, image) {
  if (!image?.complete || image.naturalWidth <= 0) return;
  const { x, z, width, height } = island.bounds;
  context.save();
  context.shadowColor = "rgba(52, 77, 76, 0.2)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 16;
  context.drawImage(image, x, z, width, height);
  context.restore();
}

function roundedCloudBody(context, cover) {
  const left = cover.x + cover.width * 0.06;
  const right = cover.x + cover.width * 0.94;
  const top = cover.z + cover.height * 0.1;
  const bottom = cover.z + cover.height * 0.9;
  const radius = Math.min(cover.width, cover.height) * 0.16;
  context.beginPath();
  context.moveTo(left + radius, top);
  context.lineTo(right - radius, top);
  context.quadraticCurveTo(right, top, right, top + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(left + radius, bottom);
  context.quadraticCurveTo(left, bottom, left, bottom - radius);
  context.lineTo(left, top + radius);
  context.quadraticCurveTo(left, top, left + radius, top);
  context.closePath();
  context.fill();
}

export function drawCloudCover(context, island, elapsedSeconds) {
  const cover = island.cloudCover;
  if (!cover) return;
  const drift = Math.sin(elapsedSeconds * 0.65 + island.unlockOrder) * 8;
  const centerX = cover.x + cover.width / 2 + drift;
  const centerZ = cover.z + cover.height / 2;

  context.save();
  context.globalAlpha = cover.opacity;
  context.fillStyle = "#f4faf7";
  context.shadowColor = "rgba(73, 110, 122, 0.32)";
  context.shadowBlur = 32;
  context.shadowOffsetY = 18;
  roundedCloudBody(context, { ...cover, x: cover.x + drift });

  const puffRadius = cover.width / 7.4;
  for (let row = 0; row < 3; row += 1) {
    const z = cover.z + cover.height * (0.25 + row * 0.24);
    const count = row === 1 ? 6 : 5;
    for (let index = 0; index < count; index += 1) {
      const x = cover.x
        + cover.width * ((index + 0.5) / count)
        + drift
        + (row % 2 ? 0 : puffRadius * 0.12);
      const radius = puffRadius * (0.88 + ((index + row) % 3) * 0.12);
      context.beginPath();
      context.ellipse(x, z, radius, radius * 0.68, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.shadowColor = "transparent";
  context.globalAlpha = 1;
  context.textAlign = "center";
  context.fillStyle = "#79695f";
  context.font = "700 42px 'STKaiti', 'KaiTi', serif";
  context.fillText(
    island.kind === "future" ? "尚在云中" : "完成爬山后开启",
    centerX,
    centerZ + 8,
  );
  context.font = "600 24px 'STKaiti', 'KaiTi', serif";
  context.fillStyle = "#99867a";
  context.fillText(
    island.kind === "future" ? "第 " + island.unlockOrder + " 站" : "工作岛",
    centerX,
    centerZ + 48,
  );
  context.restore();
}

export function drawIslandLayers(
  context,
  islands,
  imageStore,
  unlockedOrder,
  elapsedSeconds,
) {
  const states = getIslandRenderState(islands, unlockedOrder);
  for (const island of states) {
    if (island.showAsset) {
      drawIslandAsset(context, island, imageStore.get(island.id));
    }
  }
  for (const island of states) {
    if (island.showCloud) drawCloudCover(context, island, elapsedSeconds);
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
