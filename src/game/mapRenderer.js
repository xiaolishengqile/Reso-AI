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

export function drawLockedLocation(context, location, elapsedSeconds) {
  const drift = Math.sin(elapsedSeconds * 0.8) * 5;
  context.save();
  context.fillStyle = "rgba(222, 239, 241, 0.72)";
  for (const cloud of [
    { x: -74, z: 5, radius: 78 },
    { x: 4, z: -22, radius: 98 },
    { x: 92, z: 12, radius: 72 },
  ]) {
    context.beginPath();
    context.ellipse(
      location.x + cloud.x + drift,
      location.z + cloud.z,
      cloud.radius,
      cloud.radius * 0.48,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  const lockX = location.approach.x - 52;
  const lockZ = location.approach.z - 20;
  context.fillStyle = "rgba(255, 247, 218, 0.94)";
  context.strokeStyle = "#70594c";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(lockX, lockZ, 30, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(lockX, lockZ - 7, 10, Math.PI, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#70594c";
  context.fillRect(lockX - 13, lockZ - 7, 26, 21);
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
