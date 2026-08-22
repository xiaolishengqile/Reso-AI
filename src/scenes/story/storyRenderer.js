import { drawCharacter } from "../../entities/character.js";

function companionId(characterId) {
  return characterId === "boy" ? "girl" : "boy";
}

export function getStoryFrameState(story, stage, companionMood = "") {
  const distant = ["疏离", "失落", "压力", "退缩", "不安"].includes(companionMood);
  return {
    sky: story?.theme?.sky ?? "#9fcbd4",
    ground: story?.theme?.ground ?? "#566b65",
    accent: story?.theme?.accent ?? "#f0c98d",
    prop: story?.theme?.prop ?? "city",
    playerX: 0.6,
    companionX: distant ? 0.86 : 0.74,
    stageId: stage?.id ?? "",
  };
}

function drawProp(context, prop, width, height, accent) {
  context.fillStyle = accent;
  context.strokeStyle = "rgba(53, 48, 43, 0.5)";
  context.lineWidth = 3;
  if (prop === "office") {
    context.fillRect(width * 0.48, height * 0.58, width * 0.38, height * 0.05);
    for (let index = 0; index < 3; index += 1) {
      context.strokeRect(width * (0.5 + index * 0.12), height * 0.3, width * 0.09, height * 0.16);
    }
    return;
  }
  if (prop === "restaurant") {
    context.beginPath();
    context.ellipse(width * 0.72, height * 0.65, width * 0.2, height * 0.06, 0, 0, Math.PI * 2);
    context.fill();
    return;
  }
  if (prop === "home") {
    context.fillRect(width * 0.5, height * 0.36, width * 0.35, height * 0.25);
    context.fillStyle = "rgba(255,255,255,0.45)";
    context.fillRect(width * 0.64, height * 0.42, width * 0.08, height * 0.1);
    return;
  }
  if (prop === "money") {
    for (let index = 0; index < 4; index += 1) {
      context.beginPath();
      context.arc(width * (0.56 + index * 0.07), height * (0.58 - index * 0.035), 18, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }
  if (prop === "social") {
    for (let index = 0; index < 7; index += 1) {
      context.beginPath();
      context.arc(width * (0.5 + index * 0.055), height * (0.3 + (index % 2) * 0.05), 8, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }
  if (prop === "travel") {
    context.beginPath();
    context.moveTo(width * 0.46, height * 0.6);
    context.lineTo(width * 0.63, height * 0.28);
    context.lineTo(width * 0.82, height * 0.6);
    context.closePath();
    context.fill();
    return;
  }
  context.beginPath();
  context.arc(width * 0.72, height * 0.36, Math.min(width, height) * 0.11, 0, Math.PI * 2);
  context.fill();
}

export function drawStoryFrame(context, frame) {
  const {
    width,
    height,
    elapsedSeconds = 0,
    playerCharacterId,
    companionCharacterId = companionId(playerCharacterId),
  } = frame;
  const state = getStoryFrameState(frame.story, frame.stage, frame.companionMood);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, state.sky);
  gradient.addColorStop(1, state.ground);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(255,255,255,0.15)";
  for (let index = 0; index < 6; index += 1) {
    context.beginPath();
    context.arc(
      width * (0.44 + index * 0.1),
      height * (0.16 + Math.sin(elapsedSeconds * 0.35 + index) * 0.025),
      22 + index * 4,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  drawProp(context, state.prop, width, height, state.accent);
  const scale = Math.max(1.45, Math.min(width, height) / 290);
  drawCharacter(context, {
    characterId: playerCharacterId,
    position: { x: width * state.playerX, z: height * 0.78 },
    direction: { x: 1, z: 0 },
    elapsedSeconds,
    scale,
  });
  drawCharacter(context, {
    characterId: companionCharacterId,
    position: { x: width * state.companionX, z: height * 0.78 },
    direction: { x: -1, z: 0 },
    elapsedSeconds,
    scale,
  });
}
