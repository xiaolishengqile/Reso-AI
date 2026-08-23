import {
  createIcebreakerContext,
  loadIcebreakerCache,
  saveIcebreakerCache,
  validateIcebreakerResult,
} from "./icebreakerData.js";
import { loadTravelerProfile } from "../profile/travelerProfile.js";
import { loadMountainProgress } from "../scenes/mountain/progress.js";

export async function requestIcebreaker(request, { signal } = {}) {
  const response = await fetch("/api/icebreaker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "破冰生成暂时失败，请重试");
  if (validateIcebreakerResult(body).length) throw new Error("生成结果未通过安全校验，请重试");
  return body;
}

export function createIcebreakerFeature({
  characterId,
  elements,
  storage = globalThis.localStorage,
  requestIcebreakerFn = requestIcebreaker,
} = {}) {
  let context = null;
  let cachedResult = null;
  let generationId = 0;
  let controller = null;

  function setButtonLabel(label) {
    elements.buttonLabel.textContent = label;
    elements.button.setAttribute?.("aria-label", label);
  }

  function renderResult(result) {
    elements.matchName.textContent = `为你推演：${result.virtualMatchName}`;
    elements.text.textContent = result.icebreaker;
    elements.status.textContent = "破冰话术已经生成。";
    elements.retryButton.hidden = true;
  }

  function refresh() {
    context = createIcebreakerContext({
      progress: loadMountainProgress(storage, characterId),
      profile: loadTravelerProfile(storage),
    });
    elements.button.hidden = !context;
    cachedResult = context ? loadIcebreakerCache(storage, context.signature) : null;
    setButtonLabel(cachedResult ? "查看破冰话术" : "生成破冰话术");
    return context;
  }

  async function generate() {
    if (!context || controller) return;
    const currentGeneration = ++generationId;
    controller = new AbortController();
    elements.button.disabled = true;
    elements.retryButton.disabled = true;
    elements.retryButton.hidden = true;
    elements.matchName.textContent = "";
    elements.text.textContent = "";
    elements.status.textContent = "正在推演虚拟匹配对象……";
    try {
      const result = await requestIcebreakerFn(context.request, { signal: controller.signal });
      if (currentGeneration !== generationId) return;
      if (validateIcebreakerResult(result).length) throw new Error("生成结果未通过安全校验，请重试");
      cachedResult = result;
      saveIcebreakerCache(storage, context.signature, result);
      setButtonLabel("查看破冰话术");
      renderResult(result);
    } catch (error) {
      if (currentGeneration !== generationId || error?.name === "AbortError") return;
      elements.status.textContent = error?.message || "破冰生成暂时失败，请重试。";
      elements.retryButton.hidden = false;
    } finally {
      if (currentGeneration === generationId) {
        controller = null;
        elements.button.disabled = false;
        elements.retryButton.disabled = false;
      }
    }
  }

  function open() {
    if (!context) return;
    if (!elements.dialog.open) elements.dialog.showModal?.();
    if (cachedResult) renderResult(cachedResult);
    else generate();
  }

  function close() {
    generationId += 1;
    controller?.abort();
    controller = null;
    elements.button.disabled = false;
    if (elements.dialog.open) elements.dialog.close?.();
    elements.button.focus?.();
  }

  function handleCancel(event) {
    event.preventDefault?.();
    close();
  }

  elements.button.addEventListener?.("click", open);
  elements.retryButton.addEventListener?.("click", generate);
  elements.closeButton.addEventListener?.("click", close);
  elements.dialog.addEventListener?.("cancel", handleCancel);

  return Object.freeze({
    refresh,
    dispose() {
      close();
      elements.button.removeEventListener?.("click", open);
      elements.retryButton.removeEventListener?.("click", generate);
      elements.closeButton.removeEventListener?.("click", close);
      elements.dialog.removeEventListener?.("cancel", handleCancel);
    },
  });
}
