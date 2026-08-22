export function normalizeDirection(direction) {
  const length = Math.hypot(direction.x, direction.z);
  if (length <= 1) return { x: direction.x, z: direction.z };
  return { x: direction.x / length, z: direction.z / length };
}

export function directionToTarget(position, target, arrivalRadius = 6) {
  const x = target.x - position.x;
  const z = target.z - position.z;
  const distance = Math.hypot(x, z);
  if (distance <= arrivalRadius) return { x: 0, z: 0, arrived: true };
  return { x: x / distance, z: z / distance, arrived: false };
}

export function createCoverTransform(
  viewWidth,
  viewHeight,
  mapWidth,
  mapHeight,
) {
  const scale = Math.max(viewWidth / mapWidth, viewHeight / mapHeight);
  return {
    scale,
    offsetX: (viewWidth - mapWidth * scale) / 2,
    offsetY: (viewHeight - mapHeight * scale) / 2,
  };
}

export function screenToMap(point, transform) {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    z: (point.y - transform.offsetY) / transform.scale,
  };
}

export function isPointInPolygon(point, polygon) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses =
      (a.z > point.z) !== (b.z > point.z) &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function isCircleInPolygon(point, radius, polygon) {
  if (!isPointInPolygon(point, polygon)) return false;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4;
    const edge = {
      x: point.x + Math.cos(angle) * radius,
      z: point.z + Math.sin(angle) * radius,
    };
    if (!isPointInPolygon(edge, polygon)) return false;
  }
  return true;
}

export function getStallDuration(
  previousPosition,
  nextPosition,
  currentDuration,
  deltaSeconds,
) {
  const displacement = Math.hypot(
    nextPosition.x - previousPosition.x,
    nextPosition.z - previousPosition.z,
  );
  return displacement < 0.01 ? currentDuration + deltaSeconds : 0;
}

function collides(position, radius, obstacles) {
  return obstacles.some((obstacle) => (
    Math.hypot(position.x - obstacle.x, position.z - obstacle.z)
      < radius + obstacle.radius
  ));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function canOccupy(position, radius, obstacles, isWalkable) {
  return !collides(position, radius, obstacles) && isWalkable?.(position) !== false;
}

export function moveActor({
  position,
  direction,
  speed,
  deltaSeconds,
  radius,
  bounds,
  obstacles,
  isWalkable,
}) {
  const normalized = normalizeDirection(direction);
  const distance = speed * deltaSeconds;
  const candidate = {
    x: clamp(
      position.x + normalized.x * distance,
      bounds.minX + radius,
      bounds.maxX - radius,
    ),
    z: clamp(
      position.z + normalized.z * distance,
      bounds.minZ + radius,
      bounds.maxZ - radius,
    ),
  };

  if (canOccupy(candidate, radius, obstacles, isWalkable)) return candidate;

  const slideX = { x: candidate.x, z: position.z };
  if (canOccupy(slideX, radius, obstacles, isWalkable)) return slideX;

  const slideZ = { x: position.x, z: candidate.z };
  return canOccupy(slideZ, radius, obstacles, isWalkable)
    ? slideZ
    : { x: position.x, z: position.z };
}

export function distanceToLocation(position, location) {
  return Math.hypot(position.x - location.x, position.z - location.z);
}

export function findNearbyLocation(position, locations) {
  return locations
    .map((location) => ({
      location,
      distance: distanceToLocation(position, location),
    }))
    .filter(({ location, distance }) => distance <= location.interactionRadius)
    .sort((left, right) => left.distance - right.distance)[0]?.location ?? null;
}
