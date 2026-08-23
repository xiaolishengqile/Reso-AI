import { getMountainEntryMedia, getMountainStageMedia } from "./media.js";
import { getCompanionCharacterId, getMountainStage, MOUNTAIN_STAGES } from "./story.js";
import {
  advanceMountainProgress,
  completeMountainProgress,
  createMountainProgress,
  loadMountainProgress,
  recordMountainSelection,
  saveMountainProgress,
} from "./progress.js";
import {
  createFreeResponseChoice,
  createFreeResponseInput,
} from "../../shared/freeResponse.js";

const EVIDENCE_STAGES = MOUNTAIN_STAGES.filter(({ recordsEvidence }) => recordsEvidence);
const EVIDENCE_STAGE_COUNT = EVIDENCE_STAGES.length;

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
  element.setAttribute?.("aria-hidden", String(hidden));
}

function adaptVideoStoryText(text) {
  return typeof text === "string" ? text.replaceAll("{companion}", "她") : "";
}

function getQuestionNumber(stage) {
  const index = EVIDENCE_STAGES.findIndex(({ id }) => id === stage.id);
  return index < 0 ? EVIDENCE_STAGE_COUNT : index + 1;
}

export function createMountainScene({
  characterId,
  elements,
  storage = globalThis.localStorage,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
} = {}) {
  if (!characterId || !getCompanionCharacterId(characterId)) {
    throw new Error("爬山剧情需要有效的玩家角色");
  }
  if (!elements) throw new Error("爬山剧情缺少页面节点");

  let progress = null;
  let callbacks = null;
  let currentStage = null;
  let activeSources = [];
  let activeSourceIndex = 0;
  let stageStartedAt = 0;
  let journeyMode = null;
  let submitting = false;
  let completed = false;
  let isOpen = false;
  let playbackToken = 0;
  let freeResponseInput = null;

  function clearFreeResponseInput() {
    freeResponseInput?.destroy();
    freeResponseInput = null;
  }

  function now() {
    return windowTarget?.performance?.now?.() ?? Date.now();
  }

  function showWarning(message) {
    if (!elements.saveWarning) return;
    elements.saveWarning.textContent = message;
    setHidden(elements.saveWarning, false);
  }

  function clearWarning() {
    setHidden(elements.saveWarning, true);
  }

  function persist(nextProgress) {
    progress = nextProgress;
    const saved = saveMountainProgress(storage, progress);
    if (saved) clearWarning();
    else showWarning("进度暂时无法保存，请稍后重试。");
    return saved;
  }

  function setImage(source, alt) {
    elements.image.src = source;
    elements.image.alt = alt;
    elements.image.setAttribute?.("aria-label", alt);
    setHidden(elements.image, false);
    elements.video?.pause?.();
    setHidden(elements.video, true);
  }

  function setPanelBase() {
    clearFreeResponseInput();
    setHidden(elements.panel, false);
    setHidden(elements.startButton, true);
    setHidden(elements.playButton, true);
    setHidden(elements.continueButton, true);
    elements.continueButton.disabled = false;
    elements.choices.replaceChildren?.();
  }

  function showEntry(stage) {
    currentStage = stage;
    activeSources = [];
    activeSourceIndex = 0;
    submitting = false;
    playbackToken += 1;
    const entryMedia = getMountainEntryMedia();
    setImage(entryMedia.sources[0], entryMedia.alt);
    setPanelBase();
    elements.progress.textContent = journeyMode
      ? `${journeyMode} · 星空谷`
      : "第一站 · 星空谷";
    elements.title.textContent = "星空谷";
    elements.text.textContent = "";
    elements.startButton.textContent = journeyMode === "重温旅程"
      ? "重温旅程"
      : journeyMode
        ? "继续旅程"
        : "开始旅程";
    setHidden(elements.startButton, false);
  }

  function showQuestion(stage) {
    setPanelBase();
    stageStartedAt = now();
    submitting = false;
    elements.progress.textContent = `第 ${getQuestionNumber(stage)} / ${EVIDENCE_STAGE_COUNT} 组选择`;
    elements.title.textContent = stage.title;
    elements.text.textContent = adaptVideoStoryText(stage.prompt);

    for (const option of stage.choices) {
      const button = documentTarget?.createElement?.("button");
      if (!button) continue;
      button.type = "button";
      button.textContent = adaptVideoStoryText(option.text);
      button.dataset.optionId = option.id;
      button.addEventListener("click", () => selectOption(stage, option));
      elements.choices.append?.(button);
    }
    freeResponseInput = createFreeResponseInput({
      container: elements.choices,
      documentTarget,
      windowTarget,
      onSubmit: (value) => selectOption(
        stage,
        createFreeResponseChoice(
          stage,
          value,
          "你把真实想法说了出来，她认真听完，点头表示理解。",
        ),
      ),
    });
  }

  function showComplete() {
    setPanelBase();
    elements.progress.textContent = "七组画像选择已完成";
    elements.title.textContent = "旅程余韵";
    elements.text.textContent = "";
    elements.continueButton.textContent = "完成这段旅程";
    setHidden(elements.continueButton, false);
  }

  function showPlayPrompt() {
    setPanelBase();
    elements.progress.textContent = "视频等待播放";
    elements.title.textContent = "继续播放剧情";
    elements.text.textContent = "浏览器暂停了自动播放，请点击继续播放。";
    elements.playButton.textContent = "继续播放";
    setHidden(elements.playButton, false);
  }

  function playActiveVideo() {
    if (!isOpen || !currentStage || !activeSources.length) return;
    const source = activeSources[activeSourceIndex];
    const token = ++playbackToken;
    elements.video.src = source;
    elements.video.currentTime = 0;
    elements.video.setAttribute?.("aria-label", getMountainStageMedia(currentStage.id)?.alt ?? "爬山剧情视频");
    setHidden(elements.image, true);
    setHidden(elements.video, false);
    setHidden(elements.panel, true);
    elements.video.load?.();
    const playResult = elements.video.play?.();
    if (playResult?.catch) {
      playResult.catch(() => {
        if (isOpen && token === playbackToken) showPlayPrompt();
      });
    }
  }

  function showImageStage(stage, stageMedia) {
    playbackToken += 1;
    setImage(stageMedia.sources[0], stageMedia.alt);
    if (stage.kind === "complete") showComplete();
    else showQuestion(stage);
  }

  function startStageMedia(stage) {
    if (!isOpen || !stage) return;
    currentStage = stage;
    activeSourceIndex = 0;
    submitting = false;
    const stageMedia = getMountainStageMedia(stage.id);
    if (!stageMedia) {
      showQuestion(stage);
      return;
    }
    activeSources = [...stageMedia.sources];
    if (stageMedia.type === "image") {
      showImageStage(stage, stageMedia);
      return;
    }
    playActiveVideo();
  }

  function onVideoEnded() {
    if (!isOpen || !currentStage) return;
    if (activeSourceIndex + 1 < activeSources.length) {
      activeSourceIndex += 1;
      playActiveVideo();
      return;
    }
    showQuestion(currentStage);
  }

  function onVideoError() {
    if (!isOpen || !currentStage) return;
    playbackToken += 1;
    showQuestion(currentStage);
    showWarning("视频暂时无法播放，已跳过本段并进入问题。");
  }

  function skipVideo() {
    if (!isOpen || !elements.panel?.hidden) return false;
    elements.video?.pause?.();
    onVideoEnded();
    return true;
  }

  function selectOption(stage, option) {
    if (!isOpen || submitting || stage.id !== currentStage?.id) return;
    submitting = true;
    for (const button of elements.choices.children ?? []) button.disabled = true;
    freeResponseInput?.setDisabled(true);

    const selected = recordMountainSelection(progress, stage, option, {
      elapsedMs: Math.max(0, Math.round(now() - stageStartedAt)),
      companionMood: option.companionMood ?? null,
      answeredAt: Date.now(),
    });
    const nextProgress = advanceMountainProgress(selected, stage.nextStageId);
    persist(nextProgress);
    const nextStage = getMountainStage(stage.nextStageId);
    if (nextStage) startStageMedia(nextStage);
  }

  function finish() {
    if (!isOpen || completed) return;
    elements.continueButton.disabled = true;
    if (!persist(completeMountainProgress(progress))) {
      elements.continueButton.disabled = false;
      return;
    }
    completed = true;
    callbacks?.complete?.();
    hide(false);
  }

  function hide(notifyMap) {
    if (!isOpen) return;
    isOpen = false;
    playbackToken += 1;
    clearFreeResponseInput();
    elements.video?.pause?.();
    setHidden(elements.root, true);
    if (notifyMap) callbacks?.close?.();
  }

  function close() {
    hide(true);
  }

  function open(nextCallbacks = {}) {
    callbacks = nextCallbacks;
    completed = false;
    clearWarning();
    progress = loadMountainProgress(storage, characterId);
    journeyMode = Number.isFinite(progress.firstCompletedAt)
      ? "重温旅程"
      : progress.currentStageId !== "invitation" || progress.answers.length > 0
        ? "继续上次旅程"
        : null;

    if (Number.isFinite(progress.firstCompletedAt)) {
      progress = createMountainProgress(characterId, progress);
      persist(progress);
    }

    let stage = getMountainStage(progress.currentStageId);
    if (!stage) {
      progress = advanceMountainProgress(progress, "invitation");
      persist(progress);
      stage = getMountainStage("invitation");
    }

    isOpen = true;
    setHidden(elements.root, false);
    showEntry(stage);
  }

  function dispose() {
    hide(false);
    elements.closeButton?.removeEventListener?.("click", close);
    elements.startButton?.removeEventListener?.("click", onStart);
    elements.playButton?.removeEventListener?.("click", playActiveVideo);
    elements.continueButton?.removeEventListener?.("click", finish);
    elements.video?.removeEventListener?.("ended", onVideoEnded);
    elements.video?.removeEventListener?.("error", onVideoError);
  }

  function onStart() {
    startStageMedia(currentStage);
  }

  elements.closeButton?.addEventListener?.("click", close);
  elements.startButton?.addEventListener?.("click", onStart);
  elements.playButton?.addEventListener?.("click", playActiveVideo);
  elements.continueButton?.addEventListener?.("click", finish);
  elements.video?.addEventListener?.("ended", onVideoEnded);
  elements.video?.addEventListener?.("error", onVideoError);

  return Object.freeze({ open, close, skipCurrentSegment: skipVideo, dispose });
}
