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
import {
  createStoryTravel,
  getStoryMap,
  getStoryStop,
  getStoryTravelFrame,
} from "./storyMap.js";
import { drawStoryFrame } from "./storyRenderer.js";

const EVIDENCE_COUNT = 6;
const TRAVEL_DURATION_MS = 1400;
const INTERACTIVE_CLICK_SELECTOR = "button, input, textarea, select, option, label, form";

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
  let storyMap = null;
  let mapImage = null;
  let progress = null;
  let currentStage = null;
  let pendingStage = null;
  let currentPosition = null;
  let travel = null;
  let dialoguePhase = "moving";
  let narrationBeats = [];
  let narrationBeatIndex = 0;
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

  function loadMapImage() {
    const ImageConstructor = windowTarget?.Image;
    mapImage = ImageConstructor && storyMap?.assetUrl
      ? new ImageConstructor()
      : null;
    if (mapImage) mapImage.src = storyMap.assetUrl;
  }

  function render(timestamp = now()) {
    if (!isOpen || !story || !currentStage) return;
    let traveling = Boolean(travel);
    if (travel) {
      const travelFrame = getStoryTravelFrame(travel, timestamp);
      currentPosition = travelFrame.position;
      if (travelFrame.arrived) {
        traveling = false;
        showStage(pendingStage ?? currentStage, timestamp);
      }
    }
    if (canvasContext && elements.canvas) {
      const ratio = Math.min(windowTarget?.devicePixelRatio ?? 1, 2);
      const width = elements.canvas.width / ratio;
      const height = elements.canvas.height / ratio;
      canvasContext.setTransform?.(ratio, 0, 0, ratio, 0, 0);
      drawFrame(canvasContext, {
        width,
        height,
        story,
        storyMap,
        mapImage,
        stage: currentStage,
        position: currentPosition,
        traveling,
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

  function renderNarrationBeat() {
    elements.text.textContent = narrationBeats[narrationBeatIndex] ?? "";
    elements.continueButton.textContent = currentStage?.kind === "complete"
      && narrationBeatIndex === narrationBeats.length - 1
      ? "完成这座岛"
      : "点击继续";
  }

  function showQuestion() {
    dialoguePhase = "question";
    elements.root.dataset.storyPhase = dialoguePhase;
    elements.text.textContent = adaptStoryText(currentStage.prompt, characterId);
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, true);
    for (const option of currentStage.choices) {
      const button = documentTarget?.createElement?.("button");
      if (!button) continue;
      button.type = "button";
      button.dataset.optionId = option.id;
      button.textContent = adaptStoryText(option.text, characterId);
      button.addEventListener("click", (event) => {
        event?.stopPropagation?.();
        selectOption(currentStage, option);
      });
      elements.choices.append?.(button);
    }
  }

  function showStage(stage, timestamp = now()) {
    currentStage = stage;
    pendingStage = null;
    travel = null;
    pendingStageId = null;
    submitting = false;
    stageStartedAt = timestamp;
    currentPosition = getStoryStop(story, stage.id) ?? currentPosition;
    dialoguePhase = stage.kind === "complete" ? "complete" : "narration";
    narrationBeats = adaptStoryText(stage.narration, characterId)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    narrationBeatIndex = 0;
    elements.root?.setAttribute?.("aria-busy", "false");
    elements.root.dataset.storyPhase = dialoguePhase;
    elements.title.textContent = stage.title;
    elements.progress.textContent = progressLabel(stage);
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, false);
    elements.continueButton.disabled = false;
    renderNarrationBeat();
  }

  function beginTravel(stage) {
    if (!stage) return;
    currentStage = stage;
    pendingStage = stage;
    dialoguePhase = "moving";
    elements.root.dataset.storyPhase = dialoguePhase;
    elements.root?.setAttribute?.("aria-busy", "true");
    elements.title.textContent = `前往「${stage.title}」`;
    elements.text.textContent = "你们沿着岛上的道路，走向下一段故事。";
    elements.progress.textContent = progressLabel(stage);
    elements.choices.replaceChildren?.();
    setHidden(elements.continueButton, true);
    const destination = getStoryStop(story, stage.id) ?? currentPosition;
    travel = createStoryTravel(
      currentPosition ?? destination,
      destination,
      now(),
      TRAVEL_DURATION_MS,
    );
  }

  function showFeedback(stage, option) {
    dialoguePhase = "feedback";
    elements.root.dataset.storyPhase = dialoguePhase;
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
    elements.continueButton.disabled = true;
    if (!persist(completeStoryProgress(progress))) {
      elements.continueButton.disabled = false;
      return;
    }
    completedCallbackSent = true;
    const completeCallback = callbacks?.complete;
    hide(false);
    completeCallback?.();
  }

  function continueStory() {
    if (!currentStage || dialoguePhase === "moving" || dialoguePhase === "question") return;
    if (dialoguePhase === "feedback") {
      beginTravel(getStoryStage(story, pendingStageId ?? progress.currentStageId));
      return;
    }
    if (narrationBeatIndex < narrationBeats.length - 1) {
      narrationBeatIndex += 1;
      renderNarrationBeat();
      return;
    }
    if (currentStage.kind === "complete") {
      finish();
      return;
    }
    showQuestion();
  }

  function clickToContinue(event) {
    if (event?.target?.closest?.(INTERACTIVE_CLICK_SELECTOR)) return;
    continueStory();
  }

  function open(nextStory, nextCallbacks = {}) {
    if (!nextStory) throw new Error("缺少要打开的剧情");
    story = nextStory;
    storyMap = getStoryMap(story.id);
    callbacks = nextCallbacks;
    completedCallbackSent = false;
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
    companionMood = progress.companionMood ?? "";
    currentPosition = storyMap?.entry ?? { x: 0.08, y: 0.74 };
    loadMapImage();
    isOpen = true;
    setHidden(elements.root, false);
    setHidden(elements.saveWarning, true);
    resizeCanvas();
    beginTravel(currentStage);
    stopAnimation();
    render(now());
  }

  function close() {
    hide(true);
  }

  function onContinueClick(event) {
    event?.stopPropagation?.();
    continueStory();
  }

  function onCloseClick(event) {
    event?.stopPropagation?.();
    close();
  }

  elements.root?.addEventListener?.("click", clickToContinue);
  elements.continueButton?.addEventListener?.("click", onContinueClick);
  elements.closeButton?.addEventListener?.("click", onCloseClick);
  windowTarget?.addEventListener?.("resize", resizeCanvas);

  return Object.freeze({
    open,
    close,
    dispose() {
      hide(false);
      elements.root?.removeEventListener?.("click", clickToContinue);
      elements.continueButton?.removeEventListener?.("click", onContinueClick);
      elements.closeButton?.removeEventListener?.("click", onCloseClick);
      windowTarget?.removeEventListener?.("resize", resizeCanvas);
    },
  });
}
