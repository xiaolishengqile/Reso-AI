export const INITIAL_UNLOCK_ORDER = 1;

export function isLocationUnlocked(location, unlockedOrder) {
  return location.unlockOrder <= unlockedOrder;
}

export function advanceUnlockOrder(unlockedOrder, completedLocation) {
  return Math.max(unlockedOrder, completedLocation.unlocksOrder ?? unlockedOrder);
}

export function canTraversePoint(point, unlockedOrder, gates) {
  return gates.every((gate) => (
    unlockedOrder >= gate.requiredOrder
    || point.x < gate.minX
    || point.x > gate.maxX
    || point.z < gate.minZ
    || point.z > gate.maxZ
  ));
}
