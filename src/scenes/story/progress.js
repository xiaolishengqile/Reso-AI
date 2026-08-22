import { validateEvidence } from "../../profile/evidence.js";

export const STORY_PROGRESS_KEY = "reso-ai.story-progress";

const STORE_VERSION = 1;
const PROGRESS_VERSION = 1;

function copyEvidence(evidence = []) {
  return evidence.map((item) => ({
    ...item,
    signals: item.signals.map((signal) => ({ ...signal })),
    contextTags: [...item.contextTags],
  }));
}

export function createStoryProgress(
  characterId,
  islandId,
  initialStageId,
  previous = null,
) {
  const isReplay = Boolean(
    previous?.version === PROGRESS_VERSION
    && previous.characterId === characterId
    && previous.islandId === islandId
    && Number.isFinite(previous.firstCompletedAt),
  );
  return {
    version: PROGRESS_VERSION,
    characterId,
    islandId,
    currentStageId: initialStageId,
    answers: [],
    officialEvidence: isReplay ? copyEvidence(previous.officialEvidence) : [],
    isReplay,
    completed: false,
    firstCompletedAt: isReplay ? previous.firstCompletedAt : null,
    completedAt: null,
  };
}

export function recordStoryChoice(progress, evidence) {
  if (progress.answers.some(({ stageId }) => stageId === evidence.stageId)) return progress;
  if (validateEvidence(evidence).length > 0) return progress;
  return {
    ...progress,
    answers: [...progress.answers, {
      stageId: evidence.stageId,
      optionId: evidence.optionId,
    }],
    officialEvidence: progress.isReplay
      ? progress.officialEvidence
      : [...progress.officialEvidence, evidence],
  };
}

export function advanceStoryProgress(progress, stageId) {
  return typeof stageId === "string" && stageId
    ? { ...progress, currentStageId: stageId }
    : progress;
}

export function completeStoryProgress(progress, now = Date.now()) {
  return {
    ...progress,
    completed: true,
    firstCompletedAt: progress.firstCompletedAt ?? now,
    completedAt: now,
  };
}

function validProgress(progress, characterId, islandId) {
  return Boolean(
    progress
    && progress.version === PROGRESS_VERSION
    && progress.characterId === characterId
    && progress.islandId === islandId
    && typeof progress.currentStageId === "string"
    && progress.currentStageId
    && Array.isArray(progress.answers)
    && progress.answers.every((answer) => (
      typeof answer?.stageId === "string"
      && typeof answer?.optionId === "string"
    ))
    && Array.isArray(progress.officialEvidence)
    && progress.officialEvidence.every((item) => validateEvidence(item).length === 0)
    && typeof progress.isReplay === "boolean"
    && typeof progress.completed === "boolean"
    && (progress.firstCompletedAt === null || Number.isFinite(progress.firstCompletedAt))
    && (progress.completedAt === null || Number.isFinite(progress.completedAt))
  );
}

function loadStore(storage) {
  try {
    const stored = storage?.getItem?.(STORY_PROGRESS_KEY);
    if (!stored) return { version: STORE_VERSION, players: {} };
    const parsed = JSON.parse(stored);
    return parsed?.version === STORE_VERSION && parsed.players && typeof parsed.players === "object"
      ? parsed
      : { version: STORE_VERSION, players: {} };
  } catch {
    return { version: STORE_VERSION, players: {} };
  }
}

export function loadStoryProgress(storage, characterId, islandId, initialStageId) {
  const progress = loadStore(storage).players?.[characterId]?.[islandId];
  return validProgress(progress, characterId, islandId)
    ? progress
    : createStoryProgress(characterId, islandId, initialStageId);
}

export function saveStoryProgress(storage, progress) {
  try {
    if (!storage?.setItem || !validProgress(progress, progress?.characterId, progress?.islandId)) {
      return false;
    }
    const store = loadStore(storage);
    const players = { ...store.players };
    players[progress.characterId] = {
      ...players[progress.characterId],
      [progress.islandId]: progress,
    };
    storage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      version: STORE_VERSION,
      players,
    }));
    return true;
  } catch {
    return false;
  }
}

export function getCompletedStoryOrder(storage, characterId, stories) {
  const ordered = [...(stories ?? [])].sort(
    (left, right) => left.unlockOrder - right.unlockOrder,
  );
  let unlockedOrder = ordered[0]?.unlockOrder ?? 2;
  for (const story of ordered) {
    if (story.unlockOrder !== unlockedOrder) break;
    const progress = loadStoryProgress(
      storage,
      characterId,
      story.id,
      story.initialStageId,
    );
    if (!Number.isFinite(progress.firstCompletedAt)) break;
    unlockedOrder = story.unlocksOrder;
  }
  return unlockedOrder;
}
