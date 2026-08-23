import { drawCharacter } from "../../entities/character.js";

function companionId(characterId) {
  return characterId === "boy" ? "girl" : "boy";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getStoryMapViewport(positionX, visibleRatio = 0.58) {
  const ratio = clamp(visibleRatio, 0.35, 1);
  const sourceX = clamp(positionX - ratio / 2, 0, 1 - ratio);
  return Object.freeze({
    sourceX,
    sourceWidth: ratio,
    playerX: clamp((positionX - sourceX) / ratio, 0, 1),
  });
}

export function getStoryFrameState(
  story,
  stage,
  companionMood = "",
  position = { x: 0.6, y: 0.68 },
  traveling = false,
) {
  const distant = ["疏离", "失落", "压力", "退缩", "不安"].includes(companionMood);
  const viewport = getStoryMapViewport(position.x);
  return {
    sky: story?.theme?.sky ?? "#9fcbd4",
    ground: story?.theme?.ground ?? "#566b65",
    accent: story?.theme?.accent ?? "#f0c98d",
    prop: story?.theme?.prop ?? "city",
    sourceX: viewport.sourceX,
    sourceWidth: viewport.sourceWidth,
    playerX: viewport.playerX,
    companionX: clamp(
      viewport.playerX + (traveling ? -0.1 : distant ? 0.2 : 0.12),
      0.04,
      0.96,
    ),
    playerY: clamp(position.y, 0.3, 0.82),
    stageId: stage?.id ?? "",
  };
}

export function getStoryCharacterDirections(traveling) {
  return traveling
    ? {
      player: { x: 1, z: 0 },
      companion: { x: 1, z: 0 },
    }
    : {
      player: { x: 1, z: 0 },
      companion: { x: -1, z: 0 },
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
  const position = frame.position ?? { x: 0.6, y: 0.68 };
  const state = getStoryFrameState(
    frame.story,
    frame.stage,
    frame.companionMood,
    position,
    frame.traveling,
  );
  const image = frame.mapImage;
  const hasMapImage = Boolean(
    image
    && image.complete !== false
    && image.naturalWidth > 0
    && image.naturalHeight > 0,
  );
  if (hasMapImage) {
    context.drawImage(
      image,
      image.naturalWidth * state.sourceX,
      0,
      image.naturalWidth * state.sourceWidth,
      image.naturalHeight,
      0,
      0,
      width,
      height,
    );
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, state.sky);
    gradient.addColorStop(1, state.ground);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    drawProp(context, state.prop, width, height, state.accent);
  }

  const shade = context.createLinearGradient(0, height * 0.48, 0, height);
  shade.addColorStop(0, "rgba(17, 27, 28, 0)");
  shade.addColorStop(1, "rgba(17, 27, 28, 0.22)");
  context.fillStyle = shade;
  context.fillRect(0, height * 0.48, width, height * 0.52);
  const scale = Math.max(1.45, Math.min(width, height) / 290);
  const directions = getStoryCharacterDirections(frame.traveling);
  drawCharacter(context, {
    characterId: playerCharacterId,
    position: { x: width * state.playerX, z: height * state.playerY },
    direction: directions.player,
    elapsedSeconds,
    moving: frame.traveling,
    scale,
  });
  drawCharacter(context, {
    characterId: companionCharacterId,
    position: { x: width * state.companionX, z: height * state.playerY },
    direction: directions.companion,
    elapsedSeconds: elapsedSeconds + (frame.traveling ? 0.08 : 0),
    moving: frame.traveling,
    scale,
  });
}
