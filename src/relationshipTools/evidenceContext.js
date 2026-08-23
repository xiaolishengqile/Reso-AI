import { EVIDENCE_VERSION, validateEvidence } from "../profile/evidence.js";
import { resolveFixedManualVariables } from "../personalManual/matrix.js";

export const MOUNTAIN_STAGE_IDS = Object.freeze([
  "invitation",
  "fatigue",
  "slip",
  "storm-thought",
  "cave-repair",
  "home-message",
  "city-realization",
]);

export const MANUAL_ISLAND_IDS = Object.freeze([
  "mountain",
  "office",
  "dining",
  "cohabitation",
  "money",
  "social",
  "travel",
  "future",
]);

const MOUNTAIN_ORDER = new Map(MOUNTAIN_STAGE_IDS.map((id, index) => [id, index]));
const ISLAND_ORDER = new Map(MANUAL_ISLAND_IDS.map((id, index) => [id, index]));

function cleanNickname(profile) {
  return typeof profile?.nickname === "string" ? profile.nickname.trim().slice(0, 20) : "";
}

function evidenceRef(evidence) {
  return `${evidence.islandId}/${evidence.stageId}/${evidence.optionId}@${evidence.answeredAt}`;
}

function projectEvidence(evidence) {
  return {
    evidenceRef: evidenceRef(evidence),
    islandId: evidence.islandId,
    stageId: evidence.stageId,
    optionId: evidence.optionId,
    optionText: evidence.optionText,
    summary: evidence.summary,
    signals: evidence.signals.map(({ dimension, value, weight }) => ({
      dimension,
      value,
      weight,
    })),
    contextTags: [...evidence.contextTags],
    pressure: evidence.pressure,
    answeredAt: evidence.answeredAt,
  };
}

function validMountainEvidence(progress) {
  if (!Number.isFinite(progress?.firstCompletedAt)) return null;
  const byStage = new Map(
    (progress.officialEvidence ?? [])
      .filter((item) => item?.islandId === "mountain")
      .map((item) => [item.stageId, item]),
  );
  const ordered = MOUNTAIN_STAGE_IDS.map((stageId) => byStage.get(stageId));
  return ordered.some((item) => !item || item.official !== true || validateEvidence(item).length > 0)
    ? null
    : ordered;
}

function signature(prefix, characterId, evidence) {
  return [
    prefix,
    characterId,
    ...evidence.map((item) => [
      item.version,
      item.islandId,
      item.stageId,
      item.optionId,
      item.answeredAt,
    ].join("/")),
  ].join("|");
}

function compareEvidence(left, right) {
  const islandDelta = (ISLAND_ORDER.get(left.islandId) ?? 99)
    - (ISLAND_ORDER.get(right.islandId) ?? 99);
  if (islandDelta !== 0) return islandDelta;
  if (left.islandId === "mountain") {
    return (MOUNTAIN_ORDER.get(left.stageId) ?? 99)
      - (MOUNTAIN_ORDER.get(right.stageId) ?? 99);
  }
  return left.answeredAt - right.answeredAt || left.stageId.localeCompare(right.stageId);
}

export function createIcebreakerContext({ characterId, mountainProgress, profile = null } = {}) {
  const evidence = validMountainEvidence(mountainProgress);
  if (!evidence || typeof characterId !== "string" || !characterId) return null;
  const projected = evidence.map(projectEvidence);
  const evidenceSignature = signature("icebreaker", characterId, evidence);
  return {
    signature: evidenceSignature,
    request: {
      protocolVersion: 1,
      characterId,
      evidenceSignature,
      travelerNickname: cleanNickname(profile),
      evidence: projected,
    },
  };
}

export function createPersonalManualContext({
  characterId,
  mountainProgress,
  storyProgress = {},
  profile = null,
} = {}) {
  const mountainEvidence = validMountainEvidence(mountainProgress);
  if (!mountainEvidence || typeof characterId !== "string" || !characterId) return null;

  const completedIslands = ["mountain"];
  const evidence = [...mountainEvidence];
  for (const islandId of MANUAL_ISLAND_IDS.slice(1)) {
    const progress = storyProgress?.[islandId];
    if (!Number.isFinite(progress?.firstCompletedAt)) continue;
    const valid = (progress.officialEvidence ?? []).filter((item) => (
      item?.islandId === islandId
      && item.official === true
      && validateEvidence(item).length === 0
    ));
    if (valid.length === 0) continue;
    completedIslands.push(islandId);
    evidence.push(...valid);
  }
  evidence.sort(compareEvidence);
  const projected = evidence.map(projectEvidence);
  const evidenceSignature = signature("manual", characterId, evidence);
  const fixedVariables = resolveFixedManualVariables(evidence);
  return {
    signature: evidenceSignature,
    completedIslands,
    evidenceCount: evidence.length,
    request: {
      protocolVersion: 1,
      evidenceVersion: EVIDENCE_VERSION,
      characterId,
      evidenceSignature,
      travelerNickname: cleanNickname(profile),
      completedIslands,
      evidence: projected,
      fixedVariables,
    },
  };
}
