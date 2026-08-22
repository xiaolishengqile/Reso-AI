import { getScene } from "./scenes/registry.js";

export function resolveInitialScene(profile) {
  return profile?.completed === true ? null : getScene("home");
}
