export const JOURNEY_VISITS_KEY = "reso-ai.journey-visits";

function readStore(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(JOURNEY_VISITS_KEY) ?? "null");
    return parsed && typeof parsed === "object" && parsed.players
      ? parsed
      : { version: 1, players: {} };
  } catch {
    return { version: 1, players: {} };
  }
}

export function loadVisitedLocationIds(storage, characterId) {
  const locations = readStore(storage).players?.[characterId];
  return Array.isArray(locations)
    ? [...new Set(locations.filter((id) => typeof id === "string"))]
    : [];
}

export function markLocationVisited(storage, characterId, locationId) {
  if (!characterId || !locationId) return false;
  const state = readStore(storage);
  const visited = loadVisitedLocationIds(storage, characterId);
  if (!visited.includes(locationId)) visited.push(locationId);
  try {
    storage?.setItem?.(JOURNEY_VISITS_KEY, JSON.stringify({
      ...state,
      version: 1,
      players: { ...state.players, [characterId]: visited },
    }));
    return true;
  } catch {
    return false;
  }
}
