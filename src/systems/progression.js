export const INITIAL_UNLOCK_ORDER = 1;

export function isLocationUnlocked(location) {
  return Boolean(location);
}

export function advanceUnlockOrder(unlockedOrder, completedLocation) {
  return Math.max(unlockedOrder, completedLocation.unlocksOrder ?? unlockedOrder);
}

export function canTraversePoint(point, unlockedOrder, gates, radius = 0) {
  return gates.every((gate) => (
    unlockedOrder >= gate.requiredOrder
    || point.x + radius < gate.minX
    || point.x - radius > gate.maxX
    || point.z + radius < gate.minZ
    || point.z - radius > gate.maxZ
  ));
}
