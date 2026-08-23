const ASSET_BASE_URL = import.meta.env?.BASE_URL ?? "./";
const WALK_FRAMES = Object.freeze([0, 1, 2, 1]);
const WALK_FRAMES_PER_SECOND = 6;
const SPRITE_COLUMNS = 3;
const SPRITE_ROWS = 2;
const SPRITE_DRAW_SIZE = 60;
const spriteImages = new Map();

export const CHARACTER_OPTIONS = Object.freeze([
  Object.freeze({
    id: "boy",
    name: "男生",
    description: "蓬松短发、圆框眼镜和深色长裤",
    hairStyle: "short-tousled",
    glasses: true,
    sleeves: "long",
    hair: "#806451",
    shirt: "#f4ece1",
    trousers: "#5d554d",
    spriteUrl: `${ASSET_BASE_URL}assets/characters/boy-sprite-v2.png`,
    walkFacesRight: false,
  }),
  Object.freeze({
    id: "girl",
    name: "女生",
    description: "棕色长卷发、粉色短袖和蓝灰长裤",
    hairStyle: "long-wavy",
    glasses: false,
    sleeves: "short",
    hair: "#765746",
    shirt: "#d98f9b",
    trousers: "#747b84",
    spriteUrl: `${ASSET_BASE_URL}assets/characters/girl-sprite-v2.png`,
    walkFacesRight: true,
  }),
]);

export function getCharacterProfile(characterId) {
  return CHARACTER_OPTIONS.find(({ id }) => id === characterId)
    ?? CHARACTER_OPTIONS[0];
}

export function getCharacterFacing(direction) {
  if (Math.abs(direction.x) > Math.abs(direction.z)) {
    return { view: "side", flip: direction.x < 0 };
  }
  return {
    view: direction.z < 0 ? "back" : "front",
    flip: false,
  };
}

export function getCharacterAnimationFrame(direction, elapsedSeconds = 0, moving = false) {
  const { view } = getCharacterFacing(direction);
  if (view === "front") return { column: 0, row: 0 };
  if (view === "back") return { column: 2, row: 0 };
  if (!moving) return { column: 1, row: 0 };
  const index = Math.floor(Math.max(0, elapsedSeconds) * WALK_FRAMES_PER_SECOND)
    % WALK_FRAMES.length;
  return { column: WALK_FRAMES[index], row: 1 };
}

export function getCharacterSpriteFlip(characterId, frame, direction) {
  const facing = getCharacterFacing(direction);
  if (facing.view !== "side") return false;
  const profile = getCharacterProfile(characterId);
  const nativeFacesRight = frame.row === 1 && profile.walkFacesRight;
  const shouldFaceRight = !facing.flip;
  return nativeFacesRight !== shouldFaceRight;
}

export function getCharacterSpriteImage(characterId, ImageConstructor = globalThis.Image) {
  const profile = getCharacterProfile(characterId);
  if (typeof ImageConstructor !== "function") return null;
  if (!spriteImages.has(profile.id)) {
    const image = new ImageConstructor();
    image.decoding = "async";
    image.src = profile.spriteUrl;
    spriteImages.set(profile.id, image);
  }
  return spriteImages.get(profile.id);
}

function canDrawSprite(image) {
  return Boolean(
    image
    && image.complete !== false
    && image.naturalWidth > 0
    && image.naturalHeight > 0,
  );
}

function drawCharacterSprite(context, image, frame) {
  const frameWidth = image.naturalWidth / SPRITE_COLUMNS;
  const frameHeight = image.naturalHeight / SPRITE_ROWS;
  context.drawImage(
    image,
    frame.column * frameWidth,
    frame.row * frameHeight,
    frameWidth,
    frameHeight,
    -SPRITE_DRAW_SIZE / 2,
    10 - SPRITE_DRAW_SIZE,
    SPRITE_DRAW_SIZE,
    SPRITE_DRAW_SIZE,
  );
}

function drawBody(context, profile, sway) {
  context.strokeStyle = "#51453f";
  context.lineWidth = 2;
  context.lineCap = "round";

  context.fillStyle = profile.trousers;
  context.beginPath();
  context.moveTo(-8, -4);
  context.lineTo(8, -4);
  context.lineTo(7, 9);
  context.lineTo(1, 9);
  context.lineTo(0, 0);
  context.lineTo(-1, 9);
  context.lineTo(-7, 9);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = profile.shirt;
  context.beginPath();
  context.moveTo(-10, -21);
  context.quadraticCurveTo(0, -25, 10, -21);
  context.lineTo(9, -3);
  context.quadraticCurveTo(0, 1, -9, -3);
  context.closePath();
  context.fill();
  context.stroke();

  if (profile.sleeves === "short") {
    context.strokeStyle = profile.shirt;
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(-8, -18);
    context.lineTo(-11 - sway * 0.35, -13);
    context.moveTo(8, -18);
    context.lineTo(11 + sway * 0.35, -13);
    context.stroke();

    context.strokeStyle = "#f0cfb2";
    context.lineWidth = 4.5;
    context.beginPath();
    context.moveTo(-11 - sway * 0.35, -12);
    context.lineTo(-13 - sway, -5);
    context.moveTo(11 + sway * 0.35, -12);
    context.lineTo(13 + sway, -5);
    context.stroke();
    return;
  }

  context.strokeStyle = profile.shirt;
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(-8, -18);
  context.lineTo(-12 - sway, -5);
  context.moveTo(8, -18);
  context.lineTo(12 + sway, -5);
  context.stroke();

  context.fillStyle = "#f0cfb2";
  context.beginPath();
  context.arc(-12 - sway, -4, 2.2, 0, Math.PI * 2);
  context.arc(12 + sway, -4, 2.2, 0, Math.PI * 2);
  context.fill();
}

function drawHairBack(context, profile, view) {
  context.fillStyle = profile.hair;
  context.strokeStyle = "#51453f";
  context.lineWidth = 2;
  context.beginPath();
  if (profile.id === "girl") {
    if (view === "side") {
      context.moveTo(-6, -40);
      context.bezierCurveTo(14, -42, 17, -27, 12, -11);
      context.quadraticCurveTo(7, -6, 3, -12);
      context.quadraticCurveTo(-3, -8, -7, -14);
      context.bezierCurveTo(-14, -25, -15, -35, -6, -40);
    } else {
      context.moveTo(-10, -40);
      context.bezierCurveTo(-19, -34, -18, -19, -13, -9);
      context.quadraticCurveTo(-8, -5, -4, -11);
      context.quadraticCurveTo(0, -5, 4, -11);
      context.quadraticCurveTo(8, -5, 13, -9);
      context.bezierCurveTo(18, -19, 19, -34, 10, -40);
      context.closePath();
    }
  } else {
    context.moveTo(-12, -33);
    context.lineTo(-9, -40);
    context.lineTo(-4, -38);
    context.lineTo(0, -43);
    context.lineTo(4, -38);
    context.lineTo(10, -41);
    context.lineTo(13, -33);
    context.quadraticCurveTo(12, -22, 0, -20);
    context.quadraticCurveTo(-12, -22, -12, -33);
  }
  context.closePath();
  context.fill();
  context.stroke();
}

function drawHead(context, profile, view) {
  const side = view === "side";
  context.fillStyle = "#f0cfad";
  context.strokeStyle = "#51453f";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(side ? 2 : 0, -30, side ? 9 : 11, 11, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = profile.hair;
  context.beginPath();
  if (view === "back") {
    context.ellipse(0, -32, 11.5, 11, 0, 0, Math.PI * 2);
  } else if (side) {
    context.arc(0, -34, 10, Math.PI, Math.PI * 2);
    context.quadraticCurveTo(5, -28, 7, -24);
    context.quadraticCurveTo(-1, -27, -5, -26);
    context.closePath();
  } else {
    context.arc(0, -34, 11, Math.PI, Math.PI * 2);
    context.quadraticCurveTo(5, -28, 9, -27);
    context.lineTo(7, -36);
    context.quadraticCurveTo(0, -28, -8, -27);
    context.closePath();
  }
  context.fill();
  context.stroke();

  if (view === "back") return;

  if (profile.glasses) {
    context.strokeStyle = "#4d4541";
    context.lineWidth = 1.4;
    context.beginPath();
    if (side) {
      context.arc(5, -30, 3.7, 0, Math.PI * 2);
      context.moveTo(1.4, -30);
      context.lineTo(-3, -30);
    } else {
      context.arc(-4, -30, 3.5, 0, Math.PI * 2);
      context.arc(4, -30, 3.5, 0, Math.PI * 2);
      context.moveTo(-0.5, -30);
      context.lineTo(0.5, -30);
    }
    context.stroke();
  }

  context.fillStyle = "#433d39";
  context.beginPath();
  if (side) {
    context.arc(5, -30, 1.1, 0, Math.PI * 2);
  } else {
    context.arc(-4, -30, 1.1, 0, Math.PI * 2);
    context.arc(4, -30, 1.1, 0, Math.PI * 2);
  }
  context.fill();

  context.strokeStyle = "#51453f";
  context.lineWidth = 1.2;
  context.beginPath();
  if (side) context.arc(4, -25, 3, 0.25, 1.65);
  else context.arc(0, -25.5, 3.2, 0.3, Math.PI - 0.3);
  context.stroke();

  context.fillStyle = "rgba(205, 111, 104, 0.38)";
  context.beginPath();
  context.ellipse(side ? 4 : -7, -25.5, 2.7, 1.3, 0, 0, Math.PI * 2);
  if (!side) context.ellipse(7, -25.5, 2.7, 1.3, 0, 0, Math.PI * 2);
  context.fill();
}

export function drawCharacter(context, {
  characterId,
  position,
  direction,
  elapsedSeconds = 0,
  moving = false,
  scale = 1,
  spriteImage = null,
}) {
  const profile = getCharacterProfile(characterId);
  const facing = getCharacterFacing(direction);
  const image = spriteImage ?? getCharacterSpriteImage(characterId);
  const hasSprite = canDrawSprite(image);
  const animationFrame = getCharacterAnimationFrame(direction, elapsedSeconds, moving);
  const sway = moving ? Math.sin(elapsedSeconds * 11) * 1.2 : 0;
  const bob = moving
    ? (hasSprite ? Math.sin(elapsedSeconds * 12) * -0.35 : Math.abs(Math.sin(elapsedSeconds * 11)) * -1.2)
    : 0;
  const flip = hasSprite
    ? getCharacterSpriteFlip(characterId, animationFrame, direction)
    : facing.flip;

  context.save();
  context.translate(Math.round(position.x), Math.round(position.z + bob));
  context.scale((flip ? -1 : 1) * scale, scale);

  context.fillStyle = "rgba(65, 54, 43, 0.22)";
  context.beginPath();
  context.ellipse(0, 9, 13, 4.5, 0, 0, Math.PI * 2);
  context.fill();

  if (hasSprite) {
    drawCharacterSprite(
      context,
      image,
      animationFrame,
    );
    context.restore();
    return;
  }

  if (profile.id === "girl") drawHairBack(context, profile, facing.view);
  drawBody(context, profile, sway);
  if (profile.id !== "girl") drawHairBack(context, profile, facing.view);
  drawHead(context, profile, facing.view);
  context.restore();
}

export function renderCharacterPreview(canvas, characterId) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const spriteImage = getCharacterSpriteImage(characterId);
  const render = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawCharacter(context, {
      characterId,
      position: { x: canvas.width / 2, z: canvas.height - 20 },
      direction: { x: 0, z: 1 },
      scale: 2.25,
      spriteImage,
    });
  };
  render();
  if (!canDrawSprite(spriteImage)) spriteImage?.addEventListener?.("load", render, { once: true });
}
