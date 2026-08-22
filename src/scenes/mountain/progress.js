export const MOUNTAIN_PROGRESS_KEY = "reso-ai.mountain-progress";

const PROGRESS_VERSION = 1;
const INITIAL_STAGE_ID = "invitation";

function copyEvidence(evidence) {
  return evidence.map((item) => ({
    ...item,
    dimensions: [...item.dimensions],
  }));
}

function createEvidence(stage, option, details) {
  return {
    island: "mountain",
    stageId: stage.id,
    optionId: option.id,
    optionText: option.text,
    analysis: option.analysis,
    dimensions: [...option.dimensions],
    companionMood: details.companionMood ?? null,
    elapsedMs: details.elapsedMs ?? null,
    answeredAt: details.answeredAt ?? Date.now(),
    confidence: "low",
  };
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
      : [...progress.officialEvidence, createEvidence(stage, option, details)],
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
    && progress.officialEvidence.every((evidence) => (
      evidence && Array.isArray(evidence.dimensions)
    ))
    && typeof progress.completed === "boolean",
  );
}

export function loadMountainProgress(storage, characterId) {
  try {
    const stored = storage?.getItem(MOUNTAIN_PROGRESS_KEY);
    if (!stored) return createMountainProgress(characterId);
    const progress = JSON.parse(stored);
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
