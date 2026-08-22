import {
  createEvidence,
  normalizeEvidence,
  validateEvidence,
} from "../../profile/evidence.js";

export const MOUNTAIN_PROGRESS_KEY = "reso-ai.mountain-progress";

const PROGRESS_VERSION = 1;
const INITIAL_STAGE_ID = "invitation";

function copyEvidence(evidence) {
  return evidence.map((item) => ({
    ...item,
    signals: item.signals.map((signal) => ({ ...signal })),
    contextTags: [...item.contextTags],
  }));
}

function createMountainEvidence(stage, option, details) {
  return createEvidence({
    islandId: "mountain",
    stageId: stage.id,
    optionId: option.id,
    optionText: option.text,
    target: stage.evidenceTarget ?? "self",
    summary: option.summary ?? option.analysis,
    signals: option.signals ?? option.dimensions.map((dimension) => ({
      dimension,
      value: "observed",
      weight: 1,
    })),
    contextTags: [stage.scene, ...(stage.contextTags ?? [])],
    pressure: stage.id === "slip" || stage.id === "storm-thought" ? "high" : "medium",
    companionMood: details.companionMood ?? null,
    elapsedMs: details.elapsedMs ?? null,
    answeredAt: details.answeredAt ?? Date.now(),
  });
}

export function createMountainProgress(characterId, previous = null) {
  const isReplay = Boolean(
    previous?.completed
    && previous.version === PROGRESS_VERSION
    && previous.characterId === characterId,
  );

  return {
    version: PROGRESS_VERSION,
    characterId,
    currentStageId: INITIAL_STAGE_ID,
    currentAnswer: null,
    answers: [],
    officialEvidence: isReplay ? copyEvidence(previous.officialEvidence ?? []) : [],
    actionId: null,
    isReplay,
    completed: false,
  };
}

export function recordMountainSelection(progress, stage, option, details = {}) {
  if (!stage.recordsEvidence) {
    return {
      ...progress,
      currentAnswer: option.id,
      actionId: option.id,
    };
  }

  if (progress.answers.some(({ stageId }) => stageId === stage.id)) return progress;

  const answer = { stageId: stage.id, optionId: option.id };
  return {
    ...progress,
    currentAnswer: option.id,
    answers: [...progress.answers, answer],
    officialEvidence: progress.isReplay
      ? progress.officialEvidence
      : [...progress.officialEvidence, createMountainEvidence(stage, option, details)],
  };
}

export function advanceMountainProgress(progress, nextStageId) {
  return { ...progress, currentStageId: nextStageId, currentAnswer: null };
}

export function completeMountainProgress(progress) {
  return { ...progress, completed: true };
}

function isValidProgress(progress, characterId) {
  return Boolean(
    progress
    && progress.version === PROGRESS_VERSION
    && progress.characterId === characterId
    && typeof progress.currentStageId === "string"
    && Array.isArray(progress.answers)
    && Array.isArray(progress.officialEvidence)
    && progress.officialEvidence.every((evidence) => validateEvidence(evidence).length === 0)
    && typeof progress.completed === "boolean",
  );
}

export function loadMountainProgress(storage, characterId) {
  try {
    const stored = storage?.getItem(MOUNTAIN_PROGRESS_KEY);
    if (!stored) return createMountainProgress(characterId);
    const parsed = JSON.parse(stored);
    const progress = {
      ...parsed,
      officialEvidence: Array.isArray(parsed?.officialEvidence)
        ? parsed.officialEvidence.map((evidence) => normalizeEvidence(evidence))
        : parsed?.officialEvidence,
    };
    return isValidProgress(progress, characterId)
      ? progress
      : createMountainProgress(characterId);
  } catch {
    return createMountainProgress(characterId);
  }
}

export function saveMountainProgress(storage, progress) {
  try {
    if (!storage?.setItem) return false;
    storage.setItem(MOUNTAIN_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
