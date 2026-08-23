import {
  createEvidence,
  normalizeEvidence,
  validateEvidence,
} from "../../profile/evidence.js";
import { getMountainEvidenceDefinition } from "./evidenceSchema.js";
import { FREE_RESPONSE_OPTION_ID } from "../../shared/freeResponse.js";

export const MOUNTAIN_PROGRESS_KEY = "reso-ai.mountain-progress";

const PROGRESS_VERSION = 2;
const INITIAL_STAGE_ID = "invitation";

function copyEvidence(evidence) {
  return evidence.map((item) => ({
    ...item,
    signals: item.signals.map((signal) => ({ ...signal })),
    contextTags: [...item.contextTags],
  }));
}

function createMountainEvidence(stage, option, details) {
  const definition = getMountainEvidenceDefinition(stage.id, option.id);
  const isFreeResponse = option.id === FREE_RESPONSE_OPTION_ID;
  if (!definition && !isFreeResponse) {
    throw new Error(`缺少爬山岛证据定义：${stage.id}/${option.id}`);
  }
  return createEvidence({
    islandId: "mountain",
    stageId: stage.id,
    optionId: option.id,
    optionText: option.text,
    target: isFreeResponse ? option.target : definition.target,
    summary: isFreeResponse ? option.summary : definition.summary,
    signals: isFreeResponse ? option.signals : definition.signals,
    contextTags: [
      stage.scene,
      ...(stage.contextTags ?? []),
      ...(isFreeResponse ? option.contextTags ?? [] : []),
    ],
    pressure: stage.id === "slip" || stage.id === "storm-thought" ? "high" : "medium",
    companionMood: details.companionMood ?? null,
    elapsedMs: details.elapsedMs ?? null,
    answeredAt: details.answeredAt ?? Date.now(),
  });
}

export function createMountainProgress(characterId, previous = null) {
  const isReplay = Boolean(
    Number.isFinite(previous?.firstCompletedAt)
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
    firstCompletedAt: isReplay ? previous.firstCompletedAt : null,
    completedAt: null,
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

export function completeMountainProgress(progress, now = Date.now()) {
  return {
    ...progress,
    completed: true,
    firstCompletedAt: progress.firstCompletedAt ?? now,
    completedAt: now,
  };
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
    && typeof progress.completed === "boolean"
    && (progress.firstCompletedAt === null || Number.isFinite(progress.firstCompletedAt))
    && (progress.completedAt === null || Number.isFinite(progress.completedAt))
  );
}

function migrateLegacyEvidence(evidence) {
  const definition = getMountainEvidenceDefinition(evidence?.stageId, evidence?.optionId);
  if (!definition) return null;
  return createEvidence({
    ...evidence,
    islandId: "mountain",
    target: definition.target,
    summary: definition.summary,
    signals: definition.signals,
  });
}

function migrateLegacyProgress(progress, characterId) {
  if (
    progress?.version !== 1
    || progress.characterId !== characterId
    || typeof progress.currentStageId !== "string"
    || !Array.isArray(progress.answers)
    || !Array.isArray(progress.officialEvidence)
    || typeof progress.completed !== "boolean"
  ) return null;
  const officialEvidence = progress.officialEvidence.map(migrateLegacyEvidence);
  if (officialEvidence.some((item) => !item)) return null;
  const latestEvidenceAt = Math.max(
    0,
    ...officialEvidence.map(({ answeredAt }) => answeredAt).filter(Number.isFinite),
  );
  const replayEvidenceComplete = progress.isReplay === true
    && officialEvidence.length === 7
    && new Set(officialEvidence.map(({ stageId }) => stageId)).size === 7;
  const firstCompletedAt = progress.completed || replayEvidenceComplete
    ? (latestEvidenceAt || Date.now())
    : null;
  return {
    ...progress,
    version: PROGRESS_VERSION,
    officialEvidence,
    isReplay: Boolean(progress.isReplay),
    firstCompletedAt,
    completedAt: progress.completed ? firstCompletedAt : null,
  };
}

export function loadMountainProgress(storage, characterId) {
  try {
    const stored = storage?.getItem(MOUNTAIN_PROGRESS_KEY);
    if (!stored) return createMountainProgress(characterId);
    const parsed = JSON.parse(stored);
    const migrated = migrateLegacyProgress(parsed, characterId);
    const progress = {
      ...(migrated ?? parsed),
      officialEvidence: Array.isArray((migrated ?? parsed)?.officialEvidence)
        ? (migrated ?? parsed).officialEvidence.map((evidence) => normalizeEvidence(evidence))
        : (migrated ?? parsed)?.officialEvidence,
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
    if (!storage?.setItem || !isValidProgress(progress, progress?.characterId)) return false;
    storage.setItem(MOUNTAIN_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
