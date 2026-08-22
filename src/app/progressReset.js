import { TRAVELER_PROFILE_KEY } from "../profile/travelerProfile.js";
import { HOME_PROGRESS_KEY } from "../scenes/home/progress.js";
import { MOUNTAIN_PROGRESS_KEY } from "../scenes/mountain/progress.js";
import { STORY_PROGRESS_KEY } from "../scenes/story/progress.js";

const GAME_PROGRESS_KEYS = Object.freeze([
  TRAVELER_PROFILE_KEY,
  HOME_PROGRESS_KEY,
  MOUNTAIN_PROGRESS_KEY,
  STORY_PROGRESS_KEY,
]);

export function requestGameReset({ storage, confirmReset, reload } = {}) {
  if (confirmReset?.() !== true) return false;
  try {
    for (const key of GAME_PROGRESS_KEYS) storage?.removeItem?.(key);
    reload?.();
    return true;
  } catch {
    return false;
  }
}
