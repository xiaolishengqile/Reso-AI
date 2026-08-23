import {
  loadIcebreakerCache,
  saveIcebreakerCache,
  validateIcebreakerResult,
} from "../icebreaker/data.js";
import { createIcebreakerContext } from "./evidenceContext.js";
import {
  renderFixedPersonalManualCard,
  renderIcebreakerCard,
  renderRelationshipError,
  renderRelationshipLoading,
} from "./cardRenderer.js";

const BUTTON_TEXT = Object.freeze({
  icebreakerGenerate: "生成破冰话术",
  icebreakerView: "查看破冰话术",
  manualView: "查看个人说明书",
});

const PERSONAL_MANUAL_DELAY_MS = 5000;

function waitForDelay(duration, { signal } = {}) {
  return new Promise((resolve, reject) => {
    let timer = null;
    const abort = () => {
      clearTimeout(timer);
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, duration);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function publicFailure(error) {
  return typeof error?.publicMessage === "string"
    ? error.publicMessage
    : "请求暂时失败，请稍后重试。";
}

async function requestJson(fetchImpl, url, body, { signal } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("invalid response");
  }
  if (!response.ok || payload?.ok !== true) {
    const error = new Error("request failed");
    error.publicMessage = typeof payload?.error?.message === "string"
      ? payload.error.message
      : "请求暂时失败，请稍后重试。";
    throw error;
  }
  return payload.data;
}

export function createRelationshipTools({
  characterId,
  storage,
  elements,
  loadState,
  fetchImpl = globalThis.fetch,
  delayImpl = waitForDelay,
  documentTarget = globalThis.document,
} = {}) {
  let disposed = false;
  let requestVersion = 0;
  let opener = null;
  let retryAction = null;
  let requestController = null;

  function contexts() {
    const state = loadState?.();
    if (!state) return { icebreaker: null };
    return {
      icebreaker: createIcebreakerContext({ characterId, ...state }),
    };
  }

  function refresh() {
    if (disposed) return;
    const current = contexts();
    const eligible = Boolean(current.icebreaker);
    elements.group.hidden = !eligible;
    if (!eligible) return;
    const icebreaker = loadIcebreakerCache(
      storage,
      characterId,
      current.icebreaker.signature,
    );
    elements.icebreakerButton.textContent = icebreaker
      ? BUTTON_TEXT.icebreakerView
      : BUTTON_TEXT.icebreakerGenerate;
    elements.manualButton.textContent = BUTTON_TEXT.manualView;
  }

  function openCard(button) {
    opener = button;
    retryAction = null;
    elements.actionButton.hidden = true;
    if (!elements.dialog.open) {
      elements.dialog.showModal?.();
      if (!elements.dialog.open) elements.dialog.setAttribute?.("open", "");
    }
  }

  function restoreFocus() {
    const target = opener;
    opener = null;
    target?.focus?.();
  }

  function invalidateRequest() {
    requestVersion += 1;
    requestController?.abort();
    requestController = null;
  }

  function beginRequest() {
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    return controller;
  }

  function closeCard() {
    invalidateRequest();
    retryAction = null;
    elements.actionButton.hidden = true;
    if (elements.dialog.open) elements.dialog.close?.();
    else {
      elements.dialog.removeAttribute?.("open");
      restoreFocus();
    }
  }

  function showRetry(label, action) {
    retryAction = action;
    elements.actionButton.textContent = label;
    elements.actionButton.hidden = false;
  }

  async function generateIcebreaker(context, button) {
    const version = ++requestVersion;
    const controller = beginRequest();
    openCard(button);
    renderRelationshipLoading(elements, "icebreaker");
    button.disabled = true;
    try {
      const result = await requestJson(fetchImpl, "/api/icebreaker", context.request, {
        signal: controller.signal,
      });
      if (disposed || version !== requestVersion) return;
      const errors = validateIcebreakerResult(result);
      if (errors.length > 0) throw new Error("invalid result");
      const generatedAt = Number.isFinite(result.generatedAt) ? result.generatedAt : Date.now();
      const saved = saveIcebreakerCache(
        storage,
        characterId,
        context.signature,
        result,
        generatedAt,
        result.model ?? "",
      );
      renderIcebreakerCard(
        elements,
        { ...result, generatedAt },
        documentTarget,
        saved ? "" : "结果已生成，但刷新后可能无法保留。",
      );
      refresh();
    } catch (error) {
      if (disposed || version !== requestVersion || error?.name === "AbortError") return;
      renderRelationshipError(elements, publicFailure(error));
      showRetry("重试生成", () => generateIcebreaker(context, button));
    } finally {
      if (requestController === controller) requestController = null;
      button.disabled = false;
    }
  }

  async function showFixedManual(button) {
    const version = ++requestVersion;
    const controller = beginRequest();
    openCard(button);
    renderRelationshipLoading(elements, "manual");
    button.disabled = true;
    try {
      await delayImpl(PERSONAL_MANUAL_DELAY_MS, { signal: controller.signal });
      if (disposed || version !== requestVersion) return;
      renderFixedPersonalManualCard(elements, documentTarget);
    } catch (error) {
      if (disposed || version !== requestVersion || error?.name === "AbortError") return;
      renderRelationshipError(elements, "个人说明书暂时无法打开，请稍后重试。");
      showRetry("重新打开", () => showFixedManual(button));
    } finally {
      if (requestController === controller) requestController = null;
      button.disabled = false;
    }
  }

  async function onIcebreaker(event) {
    const context = contexts().icebreaker;
    if (!context) return;
    const cached = loadIcebreakerCache(storage, characterId, context.signature);
    openCard(event.currentTarget);
    if (cached) {
      invalidateRequest();
      renderIcebreakerCard(elements, cached, documentTarget);
      return;
    }
    await generateIcebreaker(context, event.currentTarget);
  }

  async function onManual(event) {
    if (!contexts().icebreaker) return;
    await showFixedManual(event.currentTarget);
  }

  function onAction() {
    retryAction?.();
  }

  function onCancel(event) {
    event.preventDefault?.();
    closeCard();
  }

  elements.group.hidden = true;
  elements.actionButton.hidden = true;
  elements.icebreakerButton.addEventListener("click", onIcebreaker);
  elements.manualButton.addEventListener("click", onManual);
  elements.actionButton.addEventListener("click", onAction);
  elements.closeButton.addEventListener("click", closeCard);
  elements.dialog.addEventListener("cancel", onCancel);
  elements.dialog.addEventListener("close", restoreFocus);
  refresh();

  return {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      invalidateRequest();
      elements.icebreakerButton.removeEventListener("click", onIcebreaker);
      elements.manualButton.removeEventListener("click", onManual);
      elements.actionButton.removeEventListener("click", onAction);
      elements.closeButton.removeEventListener("click", closeCard);
      elements.dialog.removeEventListener("cancel", onCancel);
      elements.dialog.removeEventListener("close", restoreFocus);
      if (elements.dialog.open) elements.dialog.close?.();
      elements.group.hidden = true;
    },
  };
}
