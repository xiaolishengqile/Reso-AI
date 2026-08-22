import { createEvidence } from "../../profile/evidence.js";
import {
  advanceStoryProgress,
  completeStoryProgress,
  createStoryProgress,
  loadStoryProgress,
  recordStoryChoice,
  saveStoryProgress,
} from "./progress.js";
import { adaptStoryText, getStoryStage } from "./story.js";
import { drawStoryFrame } from "./storyRenderer.js";

const EVIDENCE_COUNT = 6;

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
  element.setAttribute?.("aria-hidden", String(hidden));
}

export function createStoryScene({
  characterId,
  elements,
  storage = globalThis.localStorage,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
  drawFrame = drawStoryFrame,
} = {}) {
  if (!["boy", "girl"].includes(characterId)) throw new Error("连续剧情需要有效的玩家角色");
  if (!elements) throw new Error("连续剧情缺少页面节点");

  const canvasContext = elements.canvas?.getContext?.("2d") ?? null;
  let story = null;
  let progress = null;
  let currentStage = null;
  let callbacks = null;
  let pendingStageId = null;
  let stageStartedAt = 0;
  let frameId = null;
  let isOpen = false;
  let submitting = false;
  let completedCallbackSent = false;
  let companionMood = "";

  function now() {
    return windowTarget?.performance?.now?.() ?? Date.now();
  }

  function persist(nextProgress) {
    progress = nextProgress;
    const saved = saveStoryProgress(storage, progress);
    setHidden(elements.saveWarning, saved);
    return saved;
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

  function render(timestamp = now()) {
    if (!isOpen || !story || !currentStage) return;
    if (canvasContext && elements.canvas) {
      const ratio = Math.min(windowTarget?.devicePixelRatio ?? 1, 2);
      const width = elements.canvas.width / ratio;
      const height = elements.canvas.height / ratio;
      canvasContext.setTransform?.(ratio, 0, 0, ratio, 0, 0);
      drawFrame(canvasContext, {
        width,
        height,
        story,
        stage: currentStage,
        companionMood,
        playerCharacterId: characterId,
        elapsedSeconds: timestamp / 1000,
      });
    }
    frameId = windowTarget?.requestAnimationFrame?.(render) ?? null;
  }

  function stopAnimation() {
    if (frameId !== null) windowTarget?.cancelAnimationFrame?.(frameId);
    frameId = null;
  }

  function progressLabel(stage) {
    if (stage.kind === "complete") return `${story.title} · 六组选择已完成`;
    const answered = progress.answers.length;
    const mode = progress.isReplay ? "重温旅程 · " : answered > 0 ? "继续旅程 · " : "";
    return `${mode}第 ${Math.min(answered + 1, EVIDENCE_COUNT)} / ${EVIDENCE_COUNT} 组选择`;
  }

  function showStage(stage) {
    currentStage = stage;
    pendingStageId = null;
    submitting = false;
    stageStartedAt = now();
    elements.root?.setAttribute?.("aria-busy", "false");
    elements.title.textContent = stage.title;
    elements.text.textContent = adaptStoryText(
      [stage.narration, stage.prompt].filter(Boolean).join("\n"),
      characterId,
    );
    elements.progress.textContent = progressLabel(stage);
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, stage.kind !== "complete");
    elements.continueButton.disabled = false;
    elements.continueButton.textContent = stage.kind === "complete" ? "完成这座岛" : "继续剧情";
    if (stage.kind === "complete") return;

    for (const option of stage.choices) {
      const button = documentTarget?.createElement?.("button");
      if (!button) continue;
      button.type = "button";
      button.dataset.optionId = option.id;
      button.textContent = adaptStoryText(option.text, characterId);
      button.addEventListener("click", () => selectOption(stage, option));
      elements.choices.append?.(button);
    }
  }

  function showFeedback(stage, option) {
    companionMood = option.companionMood;
    elements.title.textContent = stage.title;
    elements.text.textContent = adaptStoryText(option.feedback, characterId);
    elements.progress.textContent = "你们正在消化刚才的选择";
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, false);
    elements.continueButton.textContent = "继续剧情";
    elements.root?.setAttribute?.("aria-busy", "false");
  }

  function selectOption(stage, option) {
    if (!isOpen || submitting || currentStage?.id !== stage.id) return;
    submitting = true;
    for (const button of elements.choices.children ?? []) button.disabled = true;
    const evidence = createEvidence({
      islandId: story.id,
      stageId: stage.id,
      optionId: option.id,
      optionText: adaptStoryText(option.text, characterId),
      target: option.target,
      summary: option.summary,
      signals: option.signals,
      contextTags: [...(story.contextTags ?? []), ...(option.contextTags ?? [])],
      pressure: stage.pressure ?? "medium",
      companionMood: option.companionMood,
      elapsedMs: Math.max(0, Math.round(now() - stageStartedAt)),
      answeredAt: Date.now(),
    });
    const selected = recordStoryChoice(progress, evidence);
    pendingStageId = stage.nextStageId;
    persist(advanceStoryProgress(selected, stage.nextStageId));
    showFeedback(stage, option);
  }

  function hide(notifyMap) {
    if (!isOpen) return;
    const closeCallback = callbacks?.close;
    isOpen = false;
    stopAnimation();
    setHidden(elements.root, true);
    callbacks = null;
    if (notifyMap) closeCallback?.();
  }

  function finish() {
    if (completedCallbackSent) return;
    completedCallbackSent = true;
    persist(completeStoryProgress(progress));
    const completeCallback = callbacks?.complete;
    hide(false);
    completeCallback?.();
  }

  function continueStory() {
    if (currentStage?.kind === "complete") {
      finish();
      return;
    }
    const nextStage = getStoryStage(story, pendingStageId ?? progress.currentStageId);
    if (nextStage) showStage(nextStage);
  }

  function open(nextStory, nextCallbacks = {}) {
    if (!nextStory) throw new Error("缺少要打开的剧情");
    story = nextStory;
    callbacks = nextCallbacks;
    completedCallbackSent = false;
    companionMood = "";
    progress = loadStoryProgress(
      storage,
      characterId,
      story.id,
      story.initialStageId,
    );
    if (progress.completed) {
      progress = createStoryProgress(characterId, story.id, story.initialStageId, progress);
      persist(progress);
    }
    currentStage = getStoryStage(story, progress.currentStageId);
    if (!currentStage) {
      progress = advanceStoryProgress(progress, story.initialStageId);
      persist(progress);
      currentStage = getStoryStage(story, story.initialStageId);
    }
    isOpen = true;
    setHidden(elements.root, false);
    setHidden(elements.saveWarning, true);
    resizeCanvas();
    showStage(currentStage);
    stopAnimation();
    render(now());
  }

  function close() {
    hide(true);
  }

  elements.continueButton?.addEventListener?.("click", continueStory);
  elements.closeButton?.addEventListener?.("click", close);
  windowTarget?.addEventListener?.("resize", resizeCanvas);

  return Object.freeze({
    open,
    close,
    dispose() {
      hide(false);
      elements.continueButton?.removeEventListener?.("click", continueStory);
      elements.closeButton?.removeEventListener?.("click", close);
      windowTarget?.removeEventListener?.("resize", resizeCanvas);
    },
  });
}
