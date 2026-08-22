function drawGround(context, island) {
  const { x, z, width, height } = island.bounds;
  const theme = island.theme;
  context.save();
  context.shadowColor = "rgba(52, 77, 76, 0.22)";
  context.shadowBlur = 24;
  context.shadowOffsetY = 16;
  context.fillStyle = "#655b52";
  context.beginPath();
  context.ellipse(x + width / 2, z + height * 0.61, width * 0.43, height * 0.35, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = "transparent";
  context.fillStyle = theme.ground;
  context.beginPath();
  context.ellipse(x + width / 2, z + height * 0.5, width * 0.45, height * 0.34, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = theme.detail;
  context.beginPath();
  context.ellipse(x + width / 2, z + height * 0.45, width * 0.34, height * 0.22, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBuilding(context, island) {
  const { x, z, width, height } = island.bounds;
  const theme = island.theme;
  const centerX = x + width / 2;
  const baseZ = z + height * 0.53;
  context.save();
  context.fillStyle = theme.accent;
  context.fillRect(centerX - 78, baseZ - 92, 156, 104);
  context.fillStyle = "#fff8df";
  context.fillRect(centerX - 18, baseZ - 42, 36, 54);
  context.fillStyle = "rgba(89, 73, 75, 0.7)";
  context.fillRect(centerX - 58, baseZ - 65, 26, 25);
  context.fillRect(centerX + 32, baseZ - 65, 26, 25);
  context.fillStyle = theme.detail;
  context.beginPath();
  context.moveTo(centerX - 100, baseZ - 90);
  context.lineTo(centerX, baseZ - 155);
  context.lineTo(centerX + 100, baseZ - 90);
  context.closePath();
  context.fill();
  context.restore();
}

function drawSymbol(context, island) {
  const { x, z, width, height } = island.bounds;
  const { prop, accent, detail } = island.theme;
  const centerX = x + width / 2;
  const centerZ = z + height * 0.3;
  context.save();
  context.fillStyle = accent;
  context.strokeStyle = accent;
  context.lineWidth = 13;
  context.lineCap = "round";

  if (prop === "money") {
    context.beginPath();
    context.arc(centerX, centerZ, 62, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = detail;
    context.fillRect(centerX - 8, centerZ - 38, 16, 76);
  } else if (prop === "social") {
    for (const offset of [-58, 0, 58]) {
      context.beginPath();
      context.arc(centerX + offset, centerZ - 30, 24, 0, Math.PI * 2);
      context.fill();
      context.fillRect(centerX + offset - 30, centerZ + 2, 60, 55);
    }
  } else if (prop === "travel") {
    context.beginPath();
    context.moveTo(centerX - 88, centerZ + 50);
    context.lineTo(centerX, centerZ - 65);
    context.lineTo(centerX + 88, centerZ + 50);
    context.stroke();
    context.fillStyle = detail;
    context.fillRect(centerX - 14, centerZ - 12, 28, 62);
  } else if (prop === "future") {
    for (const [offset, towerHeight] of [[-70, 75], [-18, 130], [45, 100]]) {
      context.fillRect(centerX + offset, centerZ - towerHeight / 2, 45, towerHeight);
    }
  } else if (prop === "wish") {
    context.beginPath();
    context.moveTo(centerX, centerZ + 58);
    context.bezierCurveTo(centerX - 120, centerZ - 15, centerX - 58, centerZ - 95, centerX, centerZ - 35);
    context.bezierCurveTo(centerX + 58, centerZ - 95, centerX + 120, centerZ - 15, centerX, centerZ + 58);
    context.fill();
  } else {
    drawBuilding(context, island);
  }
  context.restore();
}

export function drawGeneratedIsland(context, island) {
  if (!island?.bounds || !island?.theme) return;
  drawGround(context, island);
  drawSymbol(context, island);
}
