import {
  adaptMountainText,
  getCompanionCharacterId,
  getMountainStage,
} from "./story.js";
import {
  advanceMountainProgress,
  completeMountainProgress,
  createMountainProgress,
  loadMountainProgress,
  recordMountainSelection,
  saveMountainProgress,
} from "./progress.js";
import { drawMountainFrame } from "./mountainRenderer.js";

const EVIDENCE_STAGE_COUNT = 7;

function getWeather(stage) {
  return stage.id === "storm-thought" || stage.id === "storm-action"
    ? "storm"
    : "clear";
}

const CHOICE_ACTIONS = Object.freeze({
  slip: Object.freeze({
    command: Object.freeze({ playerAction: "commanding", companionAction: "slipping" }),
    support: Object.freeze({ playerAction: "supporting", companionAction: "slipping" }),
    freeze: Object.freeze({ playerAction: "distant", companionAction: "slipping" }),
  }),
  "cave-repair": Object.freeze({
    lecture: Object.freeze({ playerAction: "lecturing", companionAction: "tired" }),
    hug: Object.freeze({ playerAction: "hugging", companionAction: "comforting" }),
    space: Object.freeze({ playerAction: "distant", companionAction: "distant" }),
  }),
});

const ACTION_ROUTE_WAYPOINTS = Object.freeze({
  summit: "summit",
  retreat: "return",
  shelter: "shelter",
});

export function resolveMountainFrameState(
  stage,
  progress = {},
  { selectedOptionId = null, isRouteFeedback = false } = {},
) {
  if (!stage) return null;
  const choiceActions = selectedOptionId
    ? CHOICE_ACTIONS[stage.id]?.[selectedOptionId]
    : null;
  const waypoint = isRouteFeedback && stage.id === "cave-repair"
    ? ACTION_ROUTE_WAYPOINTS[progress.actionId] ?? stage.waypoint
    : stage.waypoint;
  return {
    scene: stage.scene,
    weather: getWeather(stage),
    waypoint,
    showCompanion: stage.scene !== "apartment",
    ...choiceActions,
  };
}

export function getMountainRouteFeedback(actionId) {
  return {
    summit: "雨势稍缓后，你们继续向山顶前行。",
    retreat: "雨势稍缓后，你们选择沿来路安全下撤。",
    shelter: "你们继续在岩洞避雨，天气缓和后再结伴返程。",
  }[actionId] ?? "";
}

export function getMountainFeedbackText(stage, option) {
  return stage && option ? option.feedback : "";
}

function getProgressLabel(stage, answeredCount) {
  if (stage.kind === "action") return "暴雨行动不会记录为画像证据";
  if (stage.kind === "complete") return "七组画像选择已完成";
  return `第 ${answeredCount + 1} / ${EVIDENCE_STAGE_COUNT} 组选择`;
}

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
  element.setAttribute?.("aria-hidden", String(hidden));
}

export function createMountainScene({
  characterId,
  elements,
  storage = globalThis.localStorage,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
  drawFrame = drawMountainFrame,
} = {}) {
  if (!characterId || !getCompanionCharacterId(characterId)) {
    throw new Error("爬山剧情需要有效的玩家角色");
  }
  if (!elements) throw new Error("爬山剧情缺少页面节点");

  const companionCharacterId = getCompanionCharacterId(characterId);
  const canvasContext = elements.canvas?.getContext?.("2d") ?? null;
  let progress = null;
  let callbacks = null;
  let currentStage = null;
  let submitting = false;
  let completed = false;
  let stageStartedAt = 0;
  let frameId = null;
  let isOpen = false;
  let pendingStageId = null;
  let routeFeedbackPending = false;
  let frameState = null;
  let activeWaypoint = null;
  let transition = null;

  function now() {
    return windowTarget?.performance?.now?.() ?? Date.now();
  }

  function persist(nextProgress) {
    progress = nextProgress;
    const saved = saveMountainProgress(storage, progress);
    setHidden(elements.saveWarning, saved);
    return saved;
  }

  function setStageBusy(isBusy) {
    elements.root?.setAttribute?.("aria-busy", String(isBusy));
  }

  function canAnimateTransition() {
    return Boolean(canvasContext && windowTarget?.requestAnimationFrame);
  }

  function resizeCanvas() {
    if (!elements.canvas) return;
    const rect = elements.canvas.getBoundingClientRect?.();
    const width = Math.max(1, rect?.width ?? elements.canvas.clientWidth ?? 1);
    const height = Math.max(1, rect?.height ?? elements.canvas.clientHeight ?? 1);
    const ratio = Math.min(windowTarget?.devicePixelRatio ?? 1, 2);
    elements.canvas.width = Math.round(width * ratio);
    elements.canvas.height = Math.round(height * ratio);
  }

  function renderFrame(timestamp = now()) {
    if (!isOpen || !currentStage) return;
    const transitionCompleted = updateTransition(timestamp);
    if (canvasContext && elements.canvas) {
      const ratio = Math.min(windowTarget?.devicePixelRatio ?? 1, 2);
      const width = elements.canvas.width / ratio;
      const height = elements.canvas.height / ratio;
      canvasContext.setTransform?.(ratio, 0, 0, ratio, 0, 0);
      drawFrame(canvasContext, {
        width,
        height,
        ...frameState,
        playerCharacterId: characterId,
        companionCharacterId,
        elapsedSeconds: timestamp / 1000,
      });
    }
    if (transitionCompleted) completeTransition();
    frameId = windowTarget?.requestAnimationFrame?.(renderFrame) ?? null;
  }

  function stopAnimation() {
    if (frameId !== null) windowTarget?.cancelAnimationFrame?.(frameId);
    frameId = null;
  }

  function updateTransition(timestamp) {
    if (!transition) return false;
    if (transition.startedAt === null) transition.startedAt = timestamp;
    const transitionProgress = Math.min(
      1,
      Math.max(0, (timestamp - transition.startedAt) / 800),
    );
    frameState = {
      ...transition.targetFrameState,
      fromWaypoint: transition.fromWaypoint,
      transitionProgress,
    };
    return transitionProgress === 1;
  }

  function completeTransition() {
    const completedTransition = transition;
    if (!completedTransition) return;
    transition = null;
    frameState = completedTransition.targetFrameState;
    activeWaypoint = completedTransition.targetFrameState.waypoint;
    completedTransition.onComplete();
  }

  function beginTransition(targetFrameState, onComplete) {
    const fromWaypoint = activeWaypoint ?? currentStage?.waypoint ?? targetFrameState.waypoint;
    if (!canAnimateTransition()) {
      frameState = targetFrameState;
      activeWaypoint = targetFrameState.waypoint;
      onComplete();
      return;
    }
    transition = {
      fromWaypoint,
      targetFrameState,
      startedAt: null,
      onComplete,
    };
    frameState = { ...targetFrameState, fromWaypoint, transitionProgress: 0 };
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, true);
    elements.text.textContent = "";
    elements.progress.textContent = "正在前往下一段旅程";
    setStageBusy(true);
  }

  function showStage(stage) {
    currentStage = stage;
    frameState = resolveMountainFrameState(stage, progress);
    activeWaypoint = stage.waypoint;
    submitting = false;
    routeFeedbackPending = false;
    stageStartedAt = now();
    setStageBusy(false);
    elements.title.textContent = stage.title;
    elements.text.textContent = adaptMountainText(
      [stage.narration, stage.prompt].filter(Boolean).join("\n"),
      characterId,
    );
    elements.progress.textContent = getProgressLabel(stage, progress.answers.length);
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, stage.kind !== "complete");
    elements.continueButton.disabled = false;
    elements.continueButton.textContent = "完成这段旅程";

    if (stage.kind === "complete") return;
    for (const option of stage.choices) {
      const button = documentTarget?.createElement?.("button");
      if (!button) continue;
      button.type = "button";
      button.textContent = adaptMountainText(option.text, characterId);
      button.dataset.optionId = option.id;
      button.addEventListener("click", () => selectOption(stage, option));
      elements.choices.append?.(button);
    }
  }

  function showFeedback(option, nextStageId) {
    frameState = resolveMountainFrameState(currentStage, progress, {
      selectedOptionId: option.id,
    });
    elements.text.textContent = adaptMountainText(
      getMountainFeedbackText(currentStage, option, progress),
      characterId,
    );
    elements.progress.textContent = "剧情正在前往下一段旅程";
    setStageBusy(false);
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, false);
    elements.continueButton.textContent = "继续剧情";
    pendingStageId = nextStageId;
    routeFeedbackPending = currentStage.id === "cave-repair";
  }

  function showRouteFeedback() {
    frameState = resolveMountainFrameState(currentStage, progress, {
      isRouteFeedback: true,
    });
    elements.title.textContent = "雨后的去向";
    elements.text.textContent = getMountainRouteFeedback(progress.actionId);
    elements.progress.textContent = "雨后的路线";
    setStageBusy(false);
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, false);
    elements.continueButton.textContent = "继续剧情";
  }

  function selectOption(stage, option) {
    if (!isOpen || submitting || stage.id !== currentStage?.id) return;
    submitting = true;
    for (const button of elements.choices.children ?? []) button.disabled = true;
    const selected = recordMountainSelection(progress, stage, option, {
      elapsedMs: Math.max(0, Math.round(now() - stageStartedAt)),
      companionMood: option.companionMood ?? null,
      answeredAt: Date.now(),
    });
    const nextProgress = advanceMountainProgress(selected, stage.nextStageId);
    persist(nextProgress);
    showFeedback(option, stage.nextStageId);
  }

  function finish() {
    if (!isOpen || completed) return;
    completed = true;
    elements.continueButton.disabled = true;
    persist(completeMountainProgress(progress));
    callbacks?.complete?.();
    hide(false);
  }

  function onContinue() {
    if (currentStage?.kind === "complete") {
      finish();
      return;
    }
    if (routeFeedbackPending) {
      routeFeedbackPending = false;
      beginTransition(
        resolveMountainFrameState(currentStage, progress, { isRouteFeedback: true }),
        showRouteFeedback,
      );
      return;
    }
    const nextStage = getMountainStage(pendingStageId);
    pendingStageId = null;
    if (nextStage) {
      beginTransition(
        resolveMountainFrameState(nextStage, progress),
        () => showStage(nextStage),
      );
    }
  }

  function hide(notifyMap) {
    if (!isOpen) return;
    isOpen = false;
    stopAnimation();
    transition = null;
    setStageBusy(false);
    setHidden(elements.root, true);
    if (notifyMap) callbacks?.close?.();
  }

  function close() {
    hide(true);
  }

  function open(nextCallbacks = {}) {
    callbacks = nextCallbacks;
    completed = false;
    progress = loadMountainProgress(storage, characterId);
    if (progress.completed) {
      // 重新进入已完成剧情时保留首次正式证据，并从序幕开始重玩。
      progress = createMountainProgress(characterId, progress);
      persist(progress);
    }
    let stage = getMountainStage(progress.currentStageId);
    let savedRecovery = true;
    if (!stage) {
      progress = advanceMountainProgress(progress, "invitation");
      savedRecovery = persist(progress);
      stage = getMountainStage(progress.currentStageId);
    }
    isOpen = true;
    setHidden(elements.root, false);
    resizeCanvas();
    setHidden(elements.saveWarning, savedRecovery);
    showStage(stage);
    stopAnimation();
    renderFrame(now());
  }

  function dispose() {
    close();
    elements.closeButton?.removeEventListener?.("click", close);
    elements.continueButton?.removeEventListener?.("click", onContinue);
    windowTarget?.removeEventListener?.("resize", resizeCanvas);
  }

  elements.closeButton?.addEventListener?.("click", close);
  elements.continueButton?.addEventListener?.("click", onContinue);
  windowTarget?.addEventListener?.("resize", resizeCanvas);

  return Object.freeze({ open, close, dispose });
}
