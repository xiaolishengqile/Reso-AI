import {
  collectOfficialEvidence,
  createPortraitRequest,
  generateLocalPortrait,
  validatePortraitReadiness,
  validatePortraitResult,
} from "../../profile/portrait.js";
import { normalizeTravelerEvidence } from "../../profile/evidence.js";
import { loadTravelerProfile } from "../../profile/travelerProfile.js";
import { loadMountainProgress } from "../mountain/progress.js";
import { getAllStories } from "../story/catalog.js";
import { loadStoryProgress } from "../story/progress.js";

const CONFIDENCE_LABELS = Object.freeze({
  low: "低置信度",
  medium: "中等置信度",
  high: "高置信度",
});

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
  element.setAttribute?.("aria-hidden", String(hidden));
}

function loadJourney(storage, characterId) {
  const storyProgress = Object.fromEntries(getAllStories().map((story) => [
    story.id,
    loadStoryProgress(storage, characterId, story.id, story.initialStageId),
  ]));
  return {
    characterId,
    profile: loadTravelerProfile(storage),
    mountainProgress: loadMountainProgress(storage, characterId),
    storyProgress,
  };
}

export function createWishScene({
  characterId,
  elements,
  storage = globalThis.localStorage,
  requestPortrait = null,
  documentTarget = globalThis.document,
} = {}) {
  if (!["boy", "girl"].includes(characterId)) throw new Error("心愿岛需要有效的玩家角色");
  if (!elements) throw new Error("心愿岛缺少页面节点");

  let callbacks = null;
  let generationId = 0;
  let isOpen = false;

  function clearResult() {
    elements.summary.textContent = "";
    elements.confidence.textContent = "";
    elements.result.replaceChildren?.();
  }

  function renderResult(result) {
    elements.summary.textContent = result.summary;
    elements.confidence.textContent = `整体结论：${CONFIDENCE_LABELS[result.confidence] ?? "待继续观察"}`;
    const sectionElements = result.sections.map((section) => {
      const article = documentTarget.createElement("article");
      const title = documentTarget.createElement("h3");
      const content = documentTarget.createElement("p");
      const meta = documentTarget.createElement("small");
      article.className = "wish-section";
      title.textContent = section.title;
      content.textContent = section.content;
      meta.textContent = `${CONFIDENCE_LABELS[section.confidence] ?? "待继续观察"} · ${section.evidenceRefs.length} 条证据引用`;
      article.append(title, content, meta);
      return article;
    });
    elements.result.replaceChildren?.(...sectionElements);
  }

  async function generate() {
    const currentGeneration = ++generationId;
    const journey = loadJourney(storage, characterId);
    const readiness = validatePortraitReadiness(journey);
    clearResult();
    elements.progress.textContent = `已收集 ${readiness.evidenceCount} / 49 组剧情证据`;
    setHidden(elements.retryButton, true);

    if (!readiness.ready) {
      elements.status.textContent = `旅程尚未完成：${readiness.missing.join("；")}`;
      elements.root.setAttribute?.("aria-busy", "false");
      return;
    }

    const evidence = collectOfficialEvidence(journey);
    const baselineEvidence = normalizeTravelerEvidence(journey.profile);
    const validationSource = { evidence, baselineEvidence };
    elements.status.textContent = requestPortrait
      ? "正在根据八座剧情岛的证据生成画像……"
      : "正在离线整理八座剧情岛的证据……";
    elements.root.setAttribute?.("aria-busy", "true");
    elements.retryButton.disabled = true;

    try {
      let result;
      let usedFallback = false;
      if (requestPortrait) {
        result = await requestPortrait(createPortraitRequest({
          profile: journey.profile,
          evidence,
          baselineEvidence,
        }));
        if (validatePortraitResult(result, validationSource).length > 0) {
          result = generateLocalPortrait({ profile: journey.profile, evidence, baselineEvidence });
          usedFallback = true;
        }
      } else {
        result = generateLocalPortrait({ profile: journey.profile, evidence, baselineEvidence });
      }
      if (validatePortraitResult(result, validationSource).length > 0) {
        throw new Error("画像结果未通过结构校验");
      }

      if (!isOpen || currentGeneration !== generationId) return;
      renderResult(result);
      elements.status.textContent = usedFallback
        ? "远程结果未通过安全校验，已生成本地安全画像。"
        : "你的心仪对象画像已经生成。";
      elements.root.setAttribute?.("aria-busy", "false");
    } catch {
      if (!isOpen || currentGeneration !== generationId) return;
      elements.status.textContent = "证据已保存，画像暂时生成失败，请重试。";
      elements.root.setAttribute?.("aria-busy", "false");
      setHidden(elements.retryButton, false);
      elements.retryButton.disabled = false;
    }
  }

  function open(nextCallbacks = {}) {
    callbacks = nextCallbacks;
    isOpen = true;
    setHidden(elements.root, false);
    generate();
  }

  function close() {
    if (!isOpen) return;
    const closeCallback = callbacks?.close;
    isOpen = false;
    generationId += 1;
    callbacks = null;
    setHidden(elements.root, true);
    closeCallback?.();
  }

  elements.retryButton?.addEventListener?.("click", generate);
  elements.closeButton?.addEventListener?.("click", close);

  return Object.freeze({
    open,
    close,
    dispose() {
      isOpen = false;
      generationId += 1;
      callbacks = null;
      setHidden(elements.root, true);
      elements.retryButton?.removeEventListener?.("click", generate);
      elements.closeButton?.removeEventListener?.("click", close);
    },
  });
}
