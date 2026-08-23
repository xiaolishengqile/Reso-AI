const DEFAULT_API_URL = "https://tokendance.space/gateway/v1/chat/completions";
const DEFAULT_MODEL = "glm-5.3";

export class ModelGatewayError extends Error {
  constructor(code, publicMessage, status = 502) {
    super(publicMessage);
    this.name = "ModelGatewayError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = status;
  }
}

export function createModelGateway({
  apiKey = "",
  apiUrl = DEFAULT_API_URL,
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 45_000,
} = {}) {
  const configuredKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const configuredUrl = typeof apiUrl === "string" && apiUrl.trim()
    ? apiUrl.trim()
    : DEFAULT_API_URL;
  const configuredModel = typeof model === "string" && model.trim()
    ? model.trim()
    : DEFAULT_MODEL;

  async function complete(messages, { signal = null } = {}) {
    if (!configuredKey) {
      throw new ModelGatewayError(
        "SERVICE_NOT_CONFIGURED",
        "模型生成服务尚未配置。",
        503,
      );
    }
    if (typeof fetchImpl !== "function") {
      throw new ModelGatewayError("MODEL_UNAVAILABLE", "模型生成服务暂时不可用。");
    }

    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;
    try {
      signal?.throwIfAborted();
      const response = await fetchImpl(configuredUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuredKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: configuredModel,
          messages,
          reasoning_effort: "high",
        }),
        signal: requestSignal,
      });
      requestSignal.throwIfAborted();
      if (!response?.ok) {
        throw new ModelGatewayError("MODEL_UNAVAILABLE", "模型生成服务暂时不可用。");
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new ModelGatewayError("MODEL_INVALID_RESPONSE", "模型返回了无法使用的结果。");
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new ModelGatewayError("MODEL_INVALID_RESPONSE", "模型返回了无法使用的结果。");
      }
      return content.trim();
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("请求已取消", "AbortError");
      if (error instanceof ModelGatewayError) throw error;
      if (timeoutController.signal.aborted || error?.name === "AbortError") {
        throw new ModelGatewayError("MODEL_TIMEOUT", "模型生成超时，请稍后重试。", 504);
      }
      throw new ModelGatewayError("MODEL_UNAVAILABLE", "模型生成服务暂时不可用。");
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({ model: configuredModel, complete });
}
