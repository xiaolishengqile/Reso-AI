import {
  createTravelerProfile,
  loadTravelerProfile,
  saveTravelerProfile,
  validateTravelerRecord,
} from "../../profile/travelerProfile.js";
import {
  advanceHomeProgress,
  completeHomeProgress,
  loadHomeProgress,
  saveHomeChoice,
  saveHomeDraft,
  saveHomeProgress,
} from "./progress.js";
import { getElderChoice, getHomeStage } from "./story.js";
import { drawHomeFrame, resolveHomeFrameState } from "./homeRenderer.js";

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
  element.setAttribute?.("aria-hidden", String(hidden));
}

function sameTraveler(existing, draft, choiceId) {
  const validation = validateTravelerRecord(draft);
  return Boolean(
    existing
    && validation.valid
    && existing.nickname === validation.value.nickname
    && existing.message === validation.value.message
    && existing.mbtiType === validation.value.mbtiType
    && existing.choiceId === choiceId,
  );
}

export function createHomeScene({
  characterId,
  elements,
  storage = globalThis.localStorage,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
  drawFrame = drawHomeFrame,
} = {}) {
  if (!["boy", "girl"].includes(characterId)) throw new Error("雾谷剧情需要有效的玩家角色");
  if (!elements) throw new Error("雾谷剧情缺少页面节点");

  const canvasContext = elements.canvas?.getContext?.("2d") ?? null;
  let progress = null;
  let currentStage = null;
  let callbacks = null;
  let frameId = null;
  let isOpen = false;
  let completedCallbackSent = false;
  let pendingProfile = null;

  function persist(nextProgress) {
    progress = nextProgress;
    const saved = saveHomeProgress(storage, progress);
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

  function renderFrame(timestamp = 0) {
    if (!isOpen || !currentStage) return;
    if (canvasContext && elements.canvas) {
      const ratio = Math.min(windowTarget?.devicePixelRatio ?? 1, 2);
      const width = elements.canvas.width / ratio;
      const height = elements.canvas.height / ratio;
      canvasContext.setTransform?.(ratio, 0, 0, ratio, 0, 0);
      drawFrame(canvasContext, {
        width,
        height,
        elapsedSeconds: timestamp / 1000,
        characterId,
        ...resolveHomeFrameState(currentStage.id, progress.choiceId),
      });
    }
    frameId = windowTarget?.requestAnimationFrame?.(renderFrame) ?? null;
  }

  function stopAnimation() {
    if (frameId !== null) windowTarget?.cancelAnimationFrame?.(frameId);
    frameId = null;
  }

  function showErrors(errors = {}) {
    elements.nicknameError.textContent = errors.nickname ?? "";
    elements.messageError.textContent = errors.message ?? "";
    elements.mbtiTypeError.textContent = errors.mbtiType ?? "";
  }

  function showStage(stage) {
    currentStage = stage;
    elements.title.textContent = stage.title;
    elements.choices.replaceChildren?.();
    setHidden(elements.recordForm, stage.kind !== "record");
    setHidden(elements.continueButton, stage.kind === "choice" || stage.kind === "record");
    elements.continueButton.disabled = false;
    elements.continueButton.textContent = stage.kind === "complete" ? "进入雾谷" : "继续";
    elements.progress.textContent = {
      arrival: "初到雾谷",
      "elder-intro": "路口相遇",
      "elder-choice": "选择你的回应",
      "elder-response": "听老人说",
      "traveler-record": "留下第一笔记录",
      complete: "雾谷序章完成",
    }[stage.id] ?? "雾谷序章";

    if (stage.kind === "response") {
      const choice = getElderChoice(progress.choiceId);
      elements.text.textContent = choice
        ? `你：${choice.playerLines[0]}\n\n${choice.response}`
        : stage.text;
    } else {
      elements.text.textContent = stage.text;
    }

    if (stage.kind === "choice") {
      for (const choice of stage.choices) {
        const button = documentTarget?.createElement?.("button");
        if (!button) continue;
        button.type = "button";
        button.dataset.choiceId = choice.id;
        button.textContent = `${choice.id} · ${choice.label}\n${choice.playerLines.join(" / ")}`;
        button.addEventListener("click", () => selectChoice(choice.id));
        elements.choices.append?.(button);
      }
    }

    if (stage.kind === "record") {
      elements.nickname.value = progress.draft.nickname;
      elements.message.value = progress.draft.message;
      elements.mbtiType.value = progress.draft.mbtiType;
      showErrors();
    }
  }

  function moveTo(stageId) {
    const stage = getHomeStage(stageId);
    if (!stage) return false;
    persist(advanceHomeProgress(progress, stageId));
    showStage(stage);
    return true;
  }

  function selectChoice(choiceId) {
    if (currentStage?.kind !== "choice") return;
    const choice = getElderChoice(choiceId);
    if (!choice) return;
    const selected = saveHomeChoice(progress, choiceId);
    persist(advanceHomeProgress(selected, currentStage.nextStageId));
    showStage(getHomeStage(currentStage.nextStageId));
  }

  function finish() {
    if (completedCallbackSent) return;
    completedCallbackSent = true;
    const complete = callbacks?.complete;
    close();
    complete?.();
  }

  function continueStory() {
    if (!currentStage) return;
    if (currentStage.kind === "complete") {
      finish();
      return;
    }
    if (currentStage.nextStageId) moveTo(currentStage.nextStageId);
  }

  function readDraft() {
    return {
      nickname: elements.nickname.value,
      message: elements.message.value,
      mbtiType: elements.mbtiType.value,
    };
  }

  function storeDraft() {
    if (!progress || currentStage?.kind !== "record") return;
    persist(saveHomeDraft(progress, readDraft()));
  }

  function submitRecord(event) {
    event?.preventDefault?.();
    if (currentStage?.kind !== "record" || !progress.choiceId) return;
    const draft = readDraft();
    const validation = validateTravelerRecord(draft);
    showErrors(validation.errors);
    if (!validation.valid) return;

    progress = saveHomeDraft(progress, validation.value);
    const existing = loadTravelerProfile(storage);
    if (existing && !sameTraveler(existing, validation.value, progress.choiceId)) {
      setHidden(elements.saveWarning, false);
      elements.saveWarning.textContent = "已有首次正式记录，当前内容不能覆盖。";
      return;
    }

    pendingProfile = existing ?? pendingProfile ?? createTravelerProfile({
      ...validation.value,
      choiceId: progress.choiceId,
    });
    if (!existing && !saveTravelerProfile(storage, pendingProfile)) {
      setHidden(elements.saveWarning, false);
      elements.saveWarning.textContent = "画像暂时无法保存，请重试。";
      return;
    }

    const completedProgress = completeHomeProgress(progress);
    if (!saveHomeProgress(storage, completedProgress)) {
      setHidden(elements.saveWarning, false);
      elements.saveWarning.textContent = "记录进度暂时无法保存，请重试。";
      return;
    }

    progress = completedProgress;
    setHidden(elements.saveWarning, true);
    showStage(getHomeStage("complete"));
  }

  function open(nextCallbacks = {}) {
    callbacks = nextCallbacks;
    completedCallbackSent = false;
    pendingProfile = null;
    progress = loadHomeProgress(storage, characterId);
    currentStage = getHomeStage(progress.currentStageId) ?? getHomeStage("arrival");
    isOpen = true;
    elements.root.hidden = false;
    setHidden(elements.saveWarning, true);
    showStage(currentStage);
    resizeCanvas();
    stopAnimation();
    frameId = windowTarget?.requestAnimationFrame?.(renderFrame) ?? null;
  }

  function close() {
    isOpen = false;
    stopAnimation();
    elements.root.hidden = true;
    callbacks = null;
  }

  elements.continueButton?.addEventListener("click", continueStory);
  elements.submitButton?.addEventListener("click", submitRecord);
  elements.recordForm?.addEventListener("submit", submitRecord);
  elements.nickname?.addEventListener("input", storeDraft);
  elements.message?.addEventListener("input", storeDraft);
  elements.mbtiType?.addEventListener("change", storeDraft);
  windowTarget?.addEventListener?.("resize", resizeCanvas);

  return Object.freeze({
    open,
    close,
    dispose() {
      close();
      elements.continueButton?.removeEventListener("click", continueStory);
      elements.submitButton?.removeEventListener("click", submitRecord);
      elements.recordForm?.removeEventListener("submit", submitRecord);
      elements.nickname?.removeEventListener("input", storeDraft);
      elements.message?.removeEventListener("input", storeDraft);
      elements.mbtiType?.removeEventListener("change", storeDraft);
      windowTarget?.removeEventListener?.("resize", resizeCanvas);
    },
  });
}
