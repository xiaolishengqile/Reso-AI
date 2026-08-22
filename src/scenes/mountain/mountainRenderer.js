import { drawCharacter } from "../../entities/character.js";

const PALETTES = Object.freeze({
  cafe: Object.freeze({ sky: "#f3d6b0", base: "#c98259", accent: "#7a4939", light: "#fff2d6" }),
  mountain: Object.freeze({ sky: "#91bed0", base: "#567760", accent: "#314b49", light: "#d8e8d7" }),
  storm: Object.freeze({ sky: "#4c6175", base: "#3c574e", accent: "#24343d", light: "#b7ced0" }),
  apartment: Object.freeze({ sky: "#19233d", base: "#594a45", accent: "#dca765", light: "#f6d59d" }),
});

const WAYPOINTS = Object.freeze({
  cafe: { player: [0.39, 0.69], companion: [0.61, 0.69], action: "standing", scale: 1.15 },
  foot: { player: [0.28, 0.79], companion: [0.34, 0.75], action: "walking", scale: 1 },
  lower: { player: [0.42, 0.67], companion: [0.48, 0.63], action: "walking", scale: 1.04 },
  middle: { player: [0.58, 0.53], companion: [0.64, 0.49], action: "tired", scale: 1.1 },
  cliff: { player: [0.7, 0.39], companion: [0.63, 0.43], action: "slipping", companionAction: "supporting", scale: 1.22 },
  shelter: { player: [0.47, 0.56], companion: [0.55, 0.56], action: "hugging", companionAction: "comforting", scale: 1.3 },
  summit: { player: [0.71, 0.23], companion: [0.63, 0.27], action: "climbing", scale: 0.82 },
  return: { player: [0.42, 0.58], companion: [0.55, 0.62], action: "distant", scale: 0.94 },
  apartment: { player: [0.7, 0.72], companion: [0.65, 0.72], action: "standing", scale: 1.15 },
});

const WAYPOINT_ALIASES = Object.freeze({
  "cafe-table": "cafe",
  "lower-cliff": "lower",
  "mid-cliff": "middle",
  "storm-cliff": "cliff",
  "cave-entrance": "cliff",
  cave: "shelter",
  "apartment-window": "apartment",
  "apartment-mirror": "apartment",
  "apartment-door": "apartment",
});

function clampSize(value) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getMountainScenePalette(scene, weather = "clear") {
  if (scene === "mountain" && weather === "storm") return PALETTES.storm;
  return PALETTES[scene] ?? PALETTES.mountain;
}

export function getMountainActorLayout(waypoint, width, height) {
  const point = WAYPOINTS[WAYPOINT_ALIASES[waypoint] ?? waypoint] ?? WAYPOINTS.foot;
  const canvasWidth = clampSize(width);
  const canvasHeight = clampSize(height);
  const player = {
    x: canvasWidth * point.player[0],
    y: canvasHeight * point.player[1],
    direction: { x: 1, z: 0 },
    action: point.action,
  };
  const companionAction = point.companionAction ?? point.action;
  return {
    player,
    companion: {
      x: canvasWidth * point.companion[0],
      y: canvasHeight * point.companion[1],
      direction: { x: -1, z: 0 },
      action: companionAction,
    },
    camera: { scale: point.scale },
  };
}

function fillBackdrop(context, width, height, palette) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.sky);
  gradient.addColorStop(1, palette.base);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawCafe(context, width, height, palette) {
  fillBackdrop(context, width, height, palette);
  context.fillStyle = palette.light;
  context.fillRect(width * 0.08, height * 0.1, width * 0.37, height * 0.34);
  context.fillStyle = "#a8c9d3";
  context.fillRect(width * 0.1, height * 0.13, width * 0.33, height * 0.28);
  context.strokeStyle = palette.accent;
  context.lineWidth = Math.max(2, width * 0.007);
  context.beginPath();
  context.moveTo(width * 0.265, height * 0.13);
  context.lineTo(width * 0.265, height * 0.41);
  context.moveTo(width * 0.1, height * 0.27);
  context.lineTo(width * 0.43, height * 0.27);
  context.stroke();
  context.fillStyle = "#5d392c";
  context.fillRect(0, height * 0.72, width, height * 0.28);
  context.fillStyle = "#a96443";
  context.fillRect(width * 0.25, height * 0.63, width * 0.5, height * 0.06);
  context.fillStyle = "#f8eee0";
  for (const x of [0.44, 0.56]) {
    context.beginPath();
    context.arc(width * x, height * 0.59, width * 0.025, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#2d3c50";
  context.fillRect(width * 0.485, height * 0.56, width * 0.055, height * 0.035);
}

function drawMountain(context, width, height, palette) {
  fillBackdrop(context, width, height, palette);
  context.fillStyle = "rgba(224, 235, 232, 0.42)";
  context.beginPath();
  context.moveTo(0, height * 0.58);
  context.lineTo(width * 0.2, height * 0.25);
  context.lineTo(width * 0.4, height * 0.57);
  context.lineTo(width * 0.62, height * 0.18);
  context.lineTo(width, height * 0.61);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();
  context.fillStyle = palette.base;
  context.beginPath();
  context.moveTo(0, height * 0.83);
  context.lineTo(width * 0.18, height * 0.58);
  context.lineTo(width * 0.37, height * 0.69);
  context.lineTo(width * 0.56, height * 0.38);
  context.lineTo(width * 0.78, height * 0.58);
  context.lineTo(width, height * 0.42);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();
  context.strokeStyle = "#caa56e";
  context.lineWidth = Math.max(7, width * 0.018);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(width * 0.24, height * 0.84);
  context.bezierCurveTo(width * 0.42, height * 0.72, width * 0.43, height * 0.56, width * 0.66, height * 0.34);
  context.stroke();
  context.fillStyle = "#263b37";
  context.beginPath();
  context.arc(width * 0.48, height * 0.58, width * 0.09, Math.PI, Math.PI * 2);
  context.fill();
  context.fillStyle = "#35424a";
  context.beginPath();
  context.moveTo(width * 0.76, height * 0.28);
  context.lineTo(width * 0.88, height * 0.75);
  context.lineTo(width * 0.68, height * 0.75);
  context.closePath();
  context.fill();
}

function drawApartment(context, width, height, palette) {
  fillBackdrop(context, width, height, palette);
  context.fillStyle = "#0c1427";
  context.fillRect(width * 0.1, height * 0.1, width * 0.43, height * 0.45);
  context.fillStyle = palette.light;
  for (let x = 0.14; x < 0.5; x += 0.08) {
    for (let y = 0.15; y < 0.5; y += 0.1) context.fillRect(width * x, height * y, width * 0.02, height * 0.025);
  }
  context.fillStyle = "#5e493d";
  context.fillRect(0, height * 0.76, width, height * 0.24);
  context.fillStyle = "#725b45";
  context.fillRect(width * 0.72, height * 0.7, width * 0.12, height * 0.14);
  context.fillStyle = "#6b4d35";
  context.beginPath();
  context.ellipse(width * 0.78, height * 0.85, width * 0.11, height * 0.035, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#d4e4ec";
  context.fillRect(width * 0.52, height * 0.6, width * 0.11, height * 0.1);
  context.fillStyle = "#334963";
  context.fillRect(width * 0.535, height * 0.615, width * 0.08, height * 0.05);
}

function drawStorm(context, width, height, elapsedSeconds) {
  context.fillStyle = "rgba(22, 35, 53, 0.45)";
  context.beginPath();
  context.ellipse(width * 0.3, height * 0.13, width * 0.27, height * 0.11, 0, 0, Math.PI * 2);
  context.ellipse(width * 0.57, height * 0.11, width * 0.3, height * 0.13, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(210, 231, 240, 0.58)";
  context.lineWidth = 2;
  for (let x = -height; x < width + height; x += 28) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - height * 0.16, height);
    context.stroke();
  }
  if (Math.floor(elapsedSeconds * 2) % 5 === 0) {
    context.strokeStyle = "#f6edb6";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(width * 0.78, 0);
    context.lineTo(width * 0.72, height * 0.2);
    context.lineTo(width * 0.8, height * 0.2);
    context.lineTo(width * 0.7, height * 0.4);
    context.stroke();
  }
  context.fillStyle = "rgba(222, 239, 240, 0.23)";
  context.fillRect(0, height * 0.68, width, height * 0.12);
  context.fillStyle = "#e5eff0";
  context.fillText("体温下降", width * 0.05, height * 0.1);
}

function drawActor(context, characterId, actor, scale, elapsedSeconds) {
  const moving = ["walking", "climbing", "slipping"].includes(actor.action);
  const adjustments = {
    standing: [0, 0, 0], walking: [0, 0, 0], climbing: [0, 0, -0.18],
    tired: [0, 5, 0.15], slipping: [4, 8, 0.38], supporting: [-3, 2, -0.16],
    hugging: [3, 2, 0.08], comforting: [-3, 2, -0.08], distant: [0, 0, 0],
    commanding: [2, -1, -0.1], lecturing: [-2, -1, 0.1],
  }[actor.action] ?? [0, 0, 0];
  context.save();
  context.translate(actor.x, actor.y);
  context.translate(adjustments[0], adjustments[1]);
  context.rotate(adjustments[2]);
  drawCharacter(context, {
    characterId,
    position: { x: 0, z: 0 },
    direction: actor.direction,
    elapsedSeconds,
    moving,
    scale: scale * (actor.action === "tired" ? 0.94 : 1),
  });
  context.restore();
}

export function drawMountainFrame(context, frame = {}) {
  if (!context) return;
  const width = clampSize(frame.width);
  const height = clampSize(frame.height);
  const scene = frame.scene ?? "mountain";
  const weather = frame.weather ?? "clear";
  const palette = getMountainScenePalette(scene, weather);
  const defaultLayout = getMountainActorLayout(frame.waypoint ?? scene, width, height);
  const layout = {
    ...defaultLayout,
    player: { ...defaultLayout.player, action: frame.playerAction ?? defaultLayout.player.action },
    companion: { ...defaultLayout.companion, action: frame.companionAction ?? defaultLayout.companion.action },
  };
  const elapsedSeconds = frame.elapsedSeconds ?? 0;

  if (scene === "cafe") drawCafe(context, width, height, palette);
  else if (scene === "apartment") drawApartment(context, width, height, palette);
  else drawMountain(context, width, height, palette);
  if (scene === "mountain" && weather === "storm") drawStorm(context, width, height, elapsedSeconds);

  drawActor(context, frame.playerCharacterId ?? "boy", layout.player, layout.camera.scale, elapsedSeconds);
  if (frame.showCompanion !== false) {
    drawActor(context, frame.companionCharacterId ?? "girl", layout.companion, layout.camera.scale, elapsedSeconds + 0.3);
  }
}
