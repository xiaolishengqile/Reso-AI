import {
  collectOfficialEvidence,
  createPortraitRequest,
  generateLocalPortrait,
  validatePortraitReadiness,
  validatePortraitResult,
} from "../../profile/portrait.js";
import { normalizeTravelerEvidence } from "../../profile/evidence.js";
import {
  createPartnerPreferences,
  loadPartnerPreferences,
  savePartnerPreferences,
  validatePartnerPreferences,
} from "../../profile/partnerPreferences.js";
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
  let currentPreferences = null;

  function clearResult() {
    elements.summary.textContent = "";
    elements.confidence.textContent = "";
    elements.result.replaceChildren?.();
    setHidden(elements.summary, true);
    setHidden(elements.confidence, true);
    setHidden(elements.result, true);
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
    setHidden(elements.summary, false);
    setHidden(elements.confidence, false);
    setHidden(elements.result, false);
  }

  function readPreferenceForm() {
    return {
      characterId,
      city: elements.cityInput.value,
      minAge: elements.minAgeInput.value,
      maxAge: elements.maxAgeInput.value,
      relationshipGoal: elements.relationshipInput.value,
      distancePreference: elements.distanceInput.value,
      priorities: [...(elements.priorityInputs ?? [])]
        .filter(({ checked }) => checked)
        .map(({ value }) => value),
      note: elements.noteInput.value,
    };
  }

  function fillPreferenceForm(preferences = null) {
    elements.cityInput.value = preferences?.city ?? "";
    elements.minAgeInput.value = preferences?.minAge == null ? "" : String(preferences.minAge);
    elements.maxAgeInput.value = preferences?.maxAge == null ? "" : String(preferences.maxAge);
    elements.relationshipInput.value = preferences?.relationshipGoal ?? "";
    elements.distanceInput.value = preferences?.distancePreference ?? "";
    const selected = new Set(preferences?.priorities ?? []);
    [...(elements.priorityInputs ?? [])].forEach((input) => {
      input.checked = selected.has(input.value);
    });
    elements.noteInput.value = preferences?.note ?? "";
  }

  function markInvalidFields(errors = {}) {
    const mark = (fields, key) => {
      fields.filter(Boolean).forEach((field) => {
        field.setAttribute?.("aria-invalid", String(Boolean(errors[key])));
      });
    };
    mark([elements.cityInput], "city");
    mark([elements.minAgeInput, elements.maxAgeInput], "age");
    mark([elements.relationshipInput], "relationshipGoal");
    mark([elements.distanceInput], "distancePreference");
    mark([...(elements.priorityInputs ?? [])], "priorities");
    mark([elements.noteInput], "note");
  }

  function showPreferenceForm(preferences = null) {
    generationId += 1;
    currentPreferences = preferences;
    clearResult();
    fillPreferenceForm(preferences);
    markInvalidFields();
    elements.formError.textContent = "";
    elements.status.textContent = "补充几项现实期待后，心愿岛会结合七岛证据生成适合你的异性画像。";
    elements.root.setAttribute?.("aria-busy", "false");
    setHidden(elements.preferenceForm, false);
    setHidden(elements.retryButton, true);
    setHidden(elements.editButton, true);
  }

  async function generate() {
    const currentGeneration = ++generationId;
    const journey = loadJourney(storage, characterId);
    const readiness = validatePortraitReadiness(journey);
    clearResult();
    elements.progress.textContent = `已收集 ${readiness.evidenceCount} / 42 组剧情证据`;
    setHidden(elements.preferenceForm, true);
    setHidden(elements.retryButton, true);
    setHidden(elements.editButton, true);

    if (!readiness.ready) {
      elements.status.textContent = `旅程尚未完成：${readiness.missing.join("；")}`;
      elements.root.setAttribute?.("aria-busy", "false");
      return;
    }

    const preferences = currentPreferences ?? loadPartnerPreferences(storage, characterId);
    if (!preferences) {
      showPreferenceForm();
      return;
    }
    currentPreferences = preferences;

    const evidence = collectOfficialEvidence(journey);
    const baselineEvidence = normalizeTravelerEvidence(journey.profile);
    const validationSource = {
      characterId,
      preferences,
      evidence,
      baselineEvidence,
    };
    elements.status.textContent = requestPortrait
      ? "正在结合七岛证据与现实期待生成画像……"
      : "正在离线融合七岛证据与现实期待……";
    elements.root.setAttribute?.("aria-busy", "true");
    elements.retryButton.disabled = true;

    try {
      let result;
      let usedFallback = false;
      if (requestPortrait) {
        result = await requestPortrait(createPortraitRequest({
          characterId,
          profile: journey.profile,
          preferences,
          evidence,
          baselineEvidence,
        }));
        if (validatePortraitResult(result, validationSource).length > 0) {
          result = generateLocalPortrait({
            characterId,
            profile: journey.profile,
            preferences,
            evidence,
            baselineEvidence,
          });
          usedFallback = true;
        }
      } else {
        result = generateLocalPortrait({
          characterId,
          profile: journey.profile,
          preferences,
          evidence,
          baselineEvidence,
        });
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
      setHidden(elements.editButton, false);
    } catch {
      if (!isOpen || currentGeneration !== generationId) return;
      elements.status.textContent = "证据已保存，画像暂时生成失败，请重试。";
      elements.root.setAttribute?.("aria-busy", "false");
      setHidden(elements.retryButton, false);
      setHidden(elements.editButton, false);
      elements.retryButton.disabled = false;
    }
  }

  function submitPreferences(event) {
    event?.preventDefault?.();
    const validation = validatePartnerPreferences(readPreferenceForm());
    if (!validation.valid) {
      elements.formError.textContent = Object.values(validation.errors).join("；");
      markInvalidFields(validation.errors);
      return;
    }
    const preferences = createPartnerPreferences(validation.value);
    if (!savePartnerPreferences(storage, preferences)) {
      elements.formError.textContent = "现实期待暂时无法保存，请重试。";
      return;
    }
    elements.formError.textContent = "";
    markInvalidFields();
    currentPreferences = preferences;
    setHidden(elements.preferenceForm, true);
    generate();
  }

  function editPreferences() {
    showPreferenceForm(currentPreferences ?? loadPartnerPreferences(storage, characterId));
  }

  function open(nextCallbacks = {}) {
    callbacks = nextCallbacks;
    isOpen = true;
    setHidden(elements.root, false);
    currentPreferences = loadPartnerPreferences(storage, characterId);
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
  elements.editButton?.addEventListener?.("click", editPreferences);
  elements.closeButton?.addEventListener?.("click", close);
  elements.preferenceForm?.addEventListener?.("submit", submitPreferences);

  return Object.freeze({
    open,
    close,
    dispose() {
      isOpen = false;
      generationId += 1;
      callbacks = null;
      setHidden(elements.root, true);
      elements.retryButton?.removeEventListener?.("click", generate);
      elements.editButton?.removeEventListener?.("click", editPreferences);
      elements.closeButton?.removeEventListener?.("click", close);
      elements.preferenceForm?.removeEventListener?.("submit", submitPreferences);
    },
  });
}
