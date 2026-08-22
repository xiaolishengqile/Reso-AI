import { drawCharacter } from "../../entities/character.js";

const FRAME_STATES = Object.freeze({
  arrival: Object.freeze({ playerAction: "walking", elderAction: "seated", focus: "road" }),
  "elder-intro": Object.freeze({ playerAction: "turning", elderAction: "calling", focus: "elder" }),
  "elder-choice": Object.freeze({ playerAction: "listening", elderAction: "seated", focus: "elder" }),
  "traveler-record": Object.freeze({ playerAction: "receiving-map", elderAction: "giving-map", focus: "record" }),
  complete: Object.freeze({ playerAction: "receiving-map", elderAction: "waiting", focus: "record" }),
});

export function resolveHomeFrameState(stageId, choiceId = null) {
  let state = FRAME_STATES[stageId] ?? FRAME_STATES.arrival;
  if (stageId === "elder-response") {
    state = {
      playerAction: "listening",
      elderAction: choiceId === "A"
        ? "offering-tea"
        : choiceId === "C" ? "giving-map" : "waiting",
      focus: "elder",
    };
  }
  return {
    scene: "fog-valley",
    ...state,
    fogStrength: 0.45,
  };
}

export function resolveHomeActorScale(width, height) {
  const scale = Math.max(1.2, Math.min(2.4, Math.min(width, height) / 380));
  return Math.round(scale * 100) / 100;
}

function drawMorning(context, width, height) {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#a8d4d4");
  sky.addColorStop(0.55, "#d7ded0");
  sky.addColorStop(1, "#738f72");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(76, 105, 86, 0.52)";
  context.beginPath();
  context.moveTo(0, height * 0.57);
  context.bezierCurveTo(width * 0.2, height * 0.35, width * 0.34, height * 0.5, width * 0.52, height * 0.31);
  context.bezierCurveTo(width * 0.7, height * 0.14, width * 0.82, height * 0.46, width, height * 0.25);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();
}

function drawRoadAndBridge(context, width, height) {
  context.strokeStyle = "#c7aa78";
  context.lineWidth = Math.max(36, width * 0.055);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(width * 0.12, height);
  context.bezierCurveTo(width * 0.24, height * 0.73, width * 0.51, height * 0.68, width * 0.67, height * 0.42);
  context.stroke();

  context.strokeStyle = "#6d5743";
  context.lineWidth = Math.max(7, width * 0.009);
  context.beginPath();
  context.moveTo(width * 0.63, height * 0.49);
  context.lineTo(width * 0.77, height * 0.31);
  context.stroke();
  context.strokeStyle = "#9c784e";
  context.lineWidth = Math.max(22, width * 0.03);
  context.beginPath();
  context.moveTo(width * 0.63, height * 0.49);
  context.lineTo(width * 0.77, height * 0.31);
  context.stroke();
}

function drawCottage(context, width, height, elapsedSeconds) {
  const x = width * 0.79;
  const y = height * 0.41;
  context.fillStyle = "#e0c79e";
  context.fillRect(x, y, width * 0.13, height * 0.16);
  context.fillStyle = "#77503c";
  context.beginPath();
  context.moveTo(x - width * 0.018, y);
  context.lineTo(x + width * 0.065, y - height * 0.09);
  context.lineTo(x + width * 0.15, y);
  context.closePath();
  context.fill();
  context.fillStyle = "#5b4637";
  context.fillRect(x + width * 0.09, y - height * 0.1, width * 0.025, height * 0.08);
  context.fillStyle = "rgba(237, 242, 230, 0.42)";
  for (let index = 0; index < 3; index += 1) {
    context.beginPath();
    context.ellipse(
      x + width * (0.105 + Math.sin(elapsedSeconds + index) * 0.008),
      y - height * (0.14 + index * 0.06),
      width * (0.022 + index * 0.008),
      height * 0.025,
      -0.3,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function drawElder(context, width, height, action) {
  const x = width * 0.58;
  const ground = height * 0.72;
  const scale = resolveHomeActorScale(width, height) / 1.5;
  context.strokeStyle = "#604d3f";
  context.lineWidth = 4 * scale;
  context.beginPath();
  context.moveTo(x - 36 * scale, ground - 26 * scale);
  context.lineTo(x + 44 * scale, ground - 26 * scale);
  context.moveTo(x - 28 * scale, ground - 26 * scale);
  context.lineTo(x - 32 * scale, ground + 30 * scale);
  context.moveTo(x + 36 * scale, ground - 26 * scale);
  context.lineTo(x + 40 * scale, ground + 30 * scale);
  context.stroke();

  context.fillStyle = "#594f49";
  context.beginPath();
  context.ellipse(x, ground - 70 * scale, 23 * scale, 46 * scale, 0.08, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#dec3a6";
  context.beginPath();
  context.arc(x, ground - 132 * scale, 19 * scale, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#e8e4d8";
  context.beginPath();
  context.arc(x, ground - 139 * scale, 19 * scale, Math.PI, Math.PI * 2);
  context.fill();

  const handX = action === "calling" || action === "offering-tea" || action === "giving-map"
    ? x - 62 * scale
    : x - 30 * scale;
  context.strokeStyle = "#dec3a6";
  context.lineWidth = 4 * scale;
  context.beginPath();
  context.moveTo(x - 15 * scale, ground - 95 * scale);
  context.lineTo(handX, ground - (action === "calling" ? 145 : 90) * scale);
  context.stroke();
  context.fillStyle = action === "giving-map" ? "#dfd4ad" : "#a46f45";
  context.fillRect(handX - 10 * scale, ground - 108 * scale, 20 * scale, 17 * scale);
}

function drawFog(context, width, height, strength, elapsedSeconds) {
  context.fillStyle = `rgba(236, 244, 235, ${strength})`;
  for (let index = 0; index < 6; index += 1) {
    const drift = Math.sin(elapsedSeconds * 0.25 + index) * width * 0.035;
    context.beginPath();
    context.ellipse(
      width * (index / 5) + drift,
      height * (0.19 + (index % 3) * 0.22),
      width * 0.18,
      height * 0.055,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

export function drawHomeFrame(context, frame = {}) {
  if (!context) return;
  const width = Math.max(1, frame.width ?? 1);
  const height = Math.max(1, frame.height ?? 1);
  const elapsedSeconds = frame.elapsedSeconds ?? 0;
  drawMorning(context, width, height);
  drawRoadAndBridge(context, width, height);
  drawCottage(context, width, height, elapsedSeconds);
  drawFog(context, width, height, frame.fogStrength ?? 0.45, elapsedSeconds);
  drawElder(context, width, height, frame.elderAction ?? "seated");

  const moving = frame.playerAction === "walking";
  const playerX = frame.focus === "road" ? width * 0.31 : width * 0.42;
  drawCharacter(context, {
    characterId: frame.characterId ?? "boy",
    position: { x: playerX, z: height * 0.76 },
    direction: frame.playerAction === "turning" || frame.focus === "elder"
      ? { x: 1, z: 0 }
      : { x: 0, z: -1 },
    elapsedSeconds,
    moving,
    scale: resolveHomeActorScale(width, height),
  });

  context.fillStyle = "rgba(244, 236, 204, 0.76)";
  context.font = `${Math.max(14, width * 0.018)}px serif`;
  context.fillText("雾谷", width * 0.78, height * 0.64);
}
