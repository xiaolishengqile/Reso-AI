export function normalizeDirection(direction) {
  const length = Math.hypot(direction.x, direction.z);
  if (length <= 1) return { x: direction.x, z: direction.z };
  return { x: direction.x / length, z: direction.z / length };
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

export function moveActor({
  position,
  direction,
  speed,
  deltaSeconds,
  radius,
  bounds,
  obstacles,
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

  return collides(candidate, radius, obstacles)
    ? { x: position.x, z: position.z }
    : candidate;
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
