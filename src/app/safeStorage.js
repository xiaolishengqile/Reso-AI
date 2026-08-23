export function getSafeStorage(target = globalThis) {
  try {
    return target?.localStorage ?? null;
  } catch {
    return null;
  }
}
