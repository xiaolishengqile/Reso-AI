export const CHARACTER_OPTIONS = Object.freeze([
  Object.freeze({
    id: "boy",
    name: "男生",
    description: "蓬松短发、圆框眼镜和深色长裤",
    hair: "#8d6d5a",
    shirt: "#f2e8db",
    trousers: "#625b54",
  }),
  Object.freeze({
    id: "girl",
    name: "女生",
    description: "柔软长发、圆框眼镜和蓝灰长裤",
    hair: "#95755f",
    shirt: "#f3eee7",
    trousers: "#737c86",
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

  context.beginPath();
  context.moveTo(-8, -18);
  context.lineTo(-12 - sway, -5);
  context.moveTo(8, -18);
  context.lineTo(12 + sway, -5);
  context.stroke();
}

function drawHairBack(context, profile, view) {
  context.fillStyle = profile.hair;
  context.strokeStyle = "#51453f";
  context.lineWidth = 2;
  context.beginPath();
  if (profile.id === "girl") {
    context.ellipse(view === "side" ? 1 : 0, -29, 14, 17, 0, 0, Math.PI * 2);
    context.lineTo(12, -12);
    context.quadraticCurveTo(0, -6, -12, -12);
  } else {
    context.ellipse(view === "side" ? 1 : 0, -31, 13, 12, 0, 0, Math.PI * 2);
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

  context.fillStyle = "#433d39";
  context.beginPath();
  if (side) {
    context.arc(5, -30, 1.1, 0, Math.PI * 2);
  } else {
    context.arc(-4, -30, 1.1, 0, Math.PI * 2);
    context.arc(4, -30, 1.1, 0, Math.PI * 2);
  }
  context.fill();

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
}) {
  const profile = getCharacterProfile(characterId);
  const facing = getCharacterFacing(direction);
  const sway = moving ? Math.sin(elapsedSeconds * 11) * 1.2 : 0;
  const bob = moving ? Math.abs(Math.sin(elapsedSeconds * 11)) * -1.2 : 0;

  context.save();
  context.translate(Math.round(position.x), Math.round(position.z + bob));
  context.scale((facing.flip ? -1 : 1) * scale, scale);

  context.fillStyle = "rgba(65, 54, 43, 0.22)";
  context.beginPath();
  context.ellipse(0, 9, 13, 4.5, 0, 0, Math.PI * 2);
  context.fill();

  if (profile.id === "girl") drawHairBack(context, profile, facing.view);
  drawBody(context, profile, sway);
  if (profile.id !== "girl") drawHairBack(context, profile, facing.view);
  drawHead(context, profile, facing.view);
  context.restore();
}

export function renderCharacterPreview(canvas, characterId) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawCharacter(context, {
    characterId,
    position: { x: canvas.width / 2, z: canvas.height - 20 },
    direction: { x: 0, z: 1 },
    scale: 2.25,
  });
}
