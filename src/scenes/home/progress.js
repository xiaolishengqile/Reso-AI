import { HOME_STAGES } from "./story.js";

export const HOME_PROGRESS_KEY = "reso-ai.home-progress";

const PROGRESS_VERSION = 1;
const CHOICE_IDS = new Set(["A", "B", "C", "D"]);
const STAGE_IDS = new Set(HOME_STAGES.map(({ id }) => id));
const STAGES_REQUIRING_CHOICE = new Set(["elder-response", "traveler-record", "complete"]);
const EMPTY_DRAFT = Object.freeze({ nickname: "", message: "", mbtiType: "" });

function copyDraft(draft = EMPTY_DRAFT) {
  return {
    nickname: typeof draft.nickname === "string" ? draft.nickname : "",
    message: typeof draft.message === "string" ? draft.message : "",
    mbtiType: typeof draft.mbtiType === "string" ? draft.mbtiType : "",
  };
}

export function createHomeProgress(characterId) {
  return {
    version: PROGRESS_VERSION,
    characterId,
    currentStageId: "arrival",
    choiceId: null,
    draft: copyDraft(),
    completed: false,
  };
}

export function advanceHomeProgress(progress, currentStageId) {
  return STAGE_IDS.has(currentStageId) ? { ...progress, currentStageId } : progress;
}

export function saveHomeChoice(progress, choiceId) {
  return CHOICE_IDS.has(choiceId) ? { ...progress, choiceId } : progress;
}

export function saveHomeDraft(progress, draft) {
  return { ...progress, draft: copyDraft(draft) };
}

export function completeHomeProgress(progress) {
  return { ...progress, currentStageId: "complete", completed: true };
}

function isValidProgress(progress, characterId) {
  return Boolean(
    progress
    && progress.version === PROGRESS_VERSION
    && progress.characterId === characterId
    && STAGE_IDS.has(progress.currentStageId)
    && (progress.choiceId === null || CHOICE_IDS.has(progress.choiceId))
    && (!STAGES_REQUIRING_CHOICE.has(progress.currentStageId) || CHOICE_IDS.has(progress.choiceId))
    && progress.draft
    && ["nickname", "message", "mbtiType"].every((key) => typeof progress.draft[key] === "string")
    && typeof progress.completed === "boolean"
    && (!progress.completed || progress.currentStageId === "complete")
  );
}

export function loadHomeProgress(storage, characterId) {
  try {
    const stored = storage?.getItem?.(HOME_PROGRESS_KEY);
    if (!stored) return createHomeProgress(characterId);
    const progress = JSON.parse(stored);
    return isValidProgress(progress, characterId) ? progress : createHomeProgress(characterId);
  } catch {
    return createHomeProgress(characterId);
  }
}

export function saveHomeProgress(storage, progress) {
  try {
    if (!storage?.setItem || !isValidProgress(progress, progress?.characterId)) return false;
    storage.setItem(HOME_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
