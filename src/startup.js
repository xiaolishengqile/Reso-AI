import { getScene } from "./scenes/registry.js";

export function resolveInitialScene(profile, homeProgress) {
  return profile?.completed === true && homeProgress?.completed === true
    ? null
    : getScene("home");
}
