import { TRAVELER_PROFILE_KEY } from "../profile/travelerProfile.js";
import { PARTNER_PREFERENCES_KEY } from "../profile/partnerPreferences.js";
import { HOME_PROGRESS_KEY } from "../scenes/home/progress.js";
import { MOUNTAIN_PROGRESS_KEY } from "../scenes/mountain/progress.js";
import { STORY_PROGRESS_KEY } from "../scenes/story/progress.js";
import { JOURNEY_VISITS_KEY } from "../game/journeyProgress.js";

const GAME_PROGRESS_KEYS = Object.freeze([
  TRAVELER_PROFILE_KEY,
  HOME_PROGRESS_KEY,
  MOUNTAIN_PROGRESS_KEY,
  STORY_PROGRESS_KEY,
  JOURNEY_VISITS_KEY,
  PARTNER_PREFERENCES_KEY,
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
