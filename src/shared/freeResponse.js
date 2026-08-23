export const FREE_RESPONSE_OPTION_ID = "free-response";
export const FREE_RESPONSE_MAX_LENGTH = 300;

export function normalizeFreeResponse(value) {
  return typeof value === "string"
    ? value.trim().slice(0, FREE_RESPONSE_MAX_LENGTH)
    : "";
}

export function createFreeResponseChoice(stage, value, feedback) {
  const text = normalizeFreeResponse(value);
  const target = stage?.choices?.find(({ target: itemTarget }) => itemTarget)?.target ?? "self";
  const dimensions = [
    ...(stage?.choices ?? []).flatMap(({ signals = [] }) => (
      signals.map(({ dimension }) => dimension)
    )),
    ...(stage?.dimensions ?? []),
  ].filter(Boolean);
  const dimension = [...new Set(dimensions)][0] ?? "freeResponse";
  return {
    id: FREE_RESPONSE_OPTION_ID,
    text,
    analysis: `用户自由回答：${text}`,
    dimensions: [dimension],
    feedback,
    target,
    summary: `用户自由回答：${text}`,
    signals: [{ dimension, value: FREE_RESPONSE_OPTION_ID, weight: 1 }],
    companionMood: "被理解",
    contextTags: ["自由回答"],
  };
}

function setStatus(element, message) {
  element.textContent = message;
}

export function createFreeResponseInput({
  container,
  onSubmit,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
} = {}) {
  if (!container || typeof onSubmit !== "function" || !documentTarget?.createElement) {
    return null;
  }

  const root = documentTarget.createElement("div");
  const input = documentTarget.createElement("textarea");
  const actions = documentTarget.createElement("div");
  const voiceButton = documentTarget.createElement("button");
  const submitButton = documentTarget.createElement("button");
  const status = documentTarget.createElement("small");

  root.className = "free-response";
  root.dataset.freeResponse = "true";
  root.setAttribute?.("role", "group");
  root.setAttribute?.("aria-label", "自由回答");
  input.className = "free-response__input";
  input.dataset.freeResponseInput = "true";
  input.rows = 3;
  input.maxLength = FREE_RESPONSE_MAX_LENGTH;
  input.placeholder = "也可以写下或说出你真实的想法";
  input.setAttribute?.("aria-label", "自由回答内容");
  actions.className = "free-response__actions";
  voiceButton.type = "button";
  voiceButton.className = "free-response__voice";
  voiceButton.textContent = "语音输入";
  voiceButton.setAttribute?.("aria-pressed", "false");
  submitButton.type = "button";
  submitButton.className = "free-response__submit";
  submitButton.textContent = "提交自由回答";
  status.className = "free-response__status";
  status.setAttribute?.("role", "status");
  status.setAttribute?.("aria-live", "polite");
  actions.append?.(voiceButton, submitButton);
  root.append?.(input, actions, status);
  container.append?.(root);

  let recognition = null;

  function submit(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const value = normalizeFreeResponse(input.value);
    if (!value) {
      setStatus(status, "请先输入或说出你的回答。");
      return;
    }
    input.value = value;
    onSubmit(value);
  }

  function startVoice(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const Recognition = windowTarget?.SpeechRecognition
      ?? windowTarget?.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus(status, "当前浏览器不支持语音输入，请使用键盘输入。");
      return;
    }

    recognition?.abort?.();
    recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      voiceButton.textContent = "正在聆听…";
      voiceButton.setAttribute?.("aria-pressed", "true");
      setStatus(status, "请开始说话。");
    };
    recognition.onresult = (resultEvent) => {
      const pieces = [];
      for (
        let index = resultEvent?.resultIndex ?? 0;
        index < (resultEvent?.results?.length ?? 0);
        index += 1
      ) {
        pieces.push(resultEvent.results[index]?.[0]?.transcript ?? "");
      }
      const transcript = normalizeFreeResponse(pieces.join(""));
      if (transcript) {
        input.value = normalizeFreeResponse(
          [input.value.trim(), transcript].filter(Boolean).join(" "),
        );
        setStatus(status, "语音已转成文字，你可以继续编辑。");
      }
    };
    recognition.onerror = () => {
      setStatus(status, "没有识别到语音，请重试或使用键盘输入。");
    };
    recognition.onend = () => {
      voiceButton.textContent = "语音输入";
      voiceButton.setAttribute?.("aria-pressed", "false");
    };
    try {
      recognition.start();
    } catch {
      setStatus(status, "语音输入暂时无法启动，请重试或使用键盘输入。");
    }
  }

  voiceButton.addEventListener?.("click", startVoice);
  submitButton.addEventListener?.("click", submit);

  return Object.freeze({
    setDisabled(disabled) {
      input.disabled = disabled;
      voiceButton.disabled = disabled;
      submitButton.disabled = disabled;
    },
    destroy() {
      recognition?.abort?.();
      recognition = null;
      voiceButton.removeEventListener?.("click", startVoice);
      submitButton.removeEventListener?.("click", submit);
    },
  });
}
