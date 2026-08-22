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

const INTERACTIVE_CLICK_SELECTOR = "button, input, textarea, select, option, label, form";

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
} = {}) {
  if (!["boy", "girl"].includes(characterId)) throw new Error("雾谷剧情需要有效的玩家角色");
  if (!elements) throw new Error("雾谷剧情缺少页面节点");

  let progress = null;
  let currentStage = null;
  let currentBeats = [];
  let currentBeatIndex = 0;
  let callbacks = null;
  let completedCallbackSent = false;
  let pendingProfile = null;

  function persist(nextProgress) {
    progress = nextProgress;
    const saved = saveHomeProgress(storage, progress);
    setHidden(elements.saveWarning, saved);
    return saved;
  }

  function showErrors(errors = {}) {
    elements.nicknameError.textContent = errors.nickname ?? "";
    elements.messageError.textContent = errors.message ?? "";
    elements.mbtiTypeError.textContent = errors.mbtiType ?? "";
  }

  function getStageText(stage) {
    if (stage.kind !== "response") return stage.text;
    const choice = getElderChoice(progress.choiceId);
    return choice ? `你：${choice.playerLines[0]}\n${choice.response}` : stage.text;
  }

  function createStageBeats(stage) {
    const text = getStageText(stage);
    if (stage.kind === "choice" || stage.kind === "record") return [text];
    return text.split("\n").map((line) => line.trim()).filter(Boolean);
  }

  function renderCurrentBeat() {
    elements.text.textContent = currentBeats[currentBeatIndex] ?? "";
    elements.continueButton.textContent = currentStage?.kind === "complete"
      && currentBeatIndex === currentBeats.length - 1
      ? "进入雾谷"
      : "点击继续";
  }

  function showStage(stage) {
    currentStage = stage;
    currentBeats = createStageBeats(stage);
    currentBeatIndex = 0;
    elements.root.dataset.stageKind = stage.kind;
    elements.root.dataset.stageId = stage.id;
    elements.title.textContent = stage.title;
    elements.choices.replaceChildren?.();
    setHidden(elements.recordForm, stage.kind !== "record");
    setHidden(elements.continueButton, stage.kind === "choice" || stage.kind === "record");
    elements.continueButton.disabled = false;
    elements.progress.textContent = {
      arrival: "初到雾谷",
      "elder-intro": "路口相遇",
      "elder-choice": "选择你的回应",
      "elder-response": "听老人说",
      "traveler-record": "留下第一笔记录",
      complete: "雾谷序章完成",
    }[stage.id] ?? "雾谷序章";

    renderCurrentBeat();

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
    if (currentStage.kind === "choice" || currentStage.kind === "record") return;
    if (currentBeatIndex < currentBeats.length - 1) {
      currentBeatIndex += 1;
      renderCurrentBeat();
      return;
    }
    if (currentStage.kind === "complete") {
      finish();
      return;
    }
    if (currentStage.nextStageId) moveTo(currentStage.nextStageId);
  }

  function clickToContinue(event) {
    if (event?.target?.closest?.(INTERACTIVE_CLICK_SELECTOR)) return;
    continueStory();
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
    const choice = getElderChoice(progress.choiceId);
    if (!choice) return;
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
      analysis: choice.analysis,
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
    const profile = loadTravelerProfile(storage);
    if (profile && !progress.completed) {
      progress = completeHomeProgress(saveHomeDraft(
        saveHomeChoice(progress, profile.choiceId),
        profile,
      ));
      saveHomeProgress(storage, progress);
    } else if (progress.completed && !profile) {
      const repairStageId = progress.choiceId ? "traveler-record" : "elder-choice";
      progress = advanceHomeProgress({ ...progress, completed: false }, repairStageId);
      saveHomeProgress(storage, progress);
    }
    currentStage = getHomeStage(progress.currentStageId) ?? getHomeStage("arrival");
    elements.root.hidden = false;
    setHidden(elements.saveWarning, true);
    showStage(currentStage);
  }

  function close() {
    elements.root.hidden = true;
    callbacks = null;
  }

  elements.continueButton?.addEventListener("click", continueStory);
  elements.root?.addEventListener("click", clickToContinue);
  elements.submitButton?.addEventListener("click", submitRecord);
  elements.recordForm?.addEventListener("submit", submitRecord);
  elements.nickname?.addEventListener("input", storeDraft);
  elements.message?.addEventListener("input", storeDraft);
  elements.mbtiType?.addEventListener("change", storeDraft);

  return Object.freeze({
    open,
    close,
    dispose() {
      close();
      elements.continueButton?.removeEventListener("click", continueStory);
      elements.root?.removeEventListener("click", clickToContinue);
      elements.submitButton?.removeEventListener("click", submitRecord);
      elements.recordForm?.removeEventListener("submit", submitRecord);
      elements.nickname?.removeEventListener("input", storeDraft);
      elements.message?.removeEventListener("input", storeDraft);
      elements.mbtiType?.removeEventListener("change", storeDraft);
    },
  });
}
