import test from "node:test";
import assert from "node:assert/strict";
import { createEvidence } from "../src/profile/evidence.js";
import { saveIcebreakerCache } from "../src/icebreaker/data.js";
import {
  MANUAL_SECTION_IDS,
  MANUAL_SECTION_TITLES,
  savePersonalManualCache,
} from "../src/personalManual/data.js";
import {
  createIcebreakerContext,
  createPersonalManualContext,
} from "../src/relationshipTools/evidenceContext.js";
import { createRelationshipTools } from "../src/relationshipTools/createRelationshipTools.js";

const ICEBREAKER = "看到你在山路压力里仍会先确认安全，也愿意在风雨过后认真修复关系，我想和你从一次不赶时间的散步聊起。我们可以分享各自在计划被打乱时最需要的支持，也可以坦白哪些时刻更想安静缓冲。不必急着证明默契，只要保持好奇，尊重彼此节奏，再一起选一个舒服的小目标。也许是一顿热饭、一段城市夜路，或者下一次出发前共同列好的清单，让了解慢慢发生，也让每一次回应都真实可接住。";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.textContent = "";
    this.className = "";
    this.listeners = new Map();
    this.attributes = new Map();
    this.focused = false;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.get("close")?.(); }
  focus() { this.focused = true; }
  click() { return this.listeners.get("click")?.({ currentTarget: this }); }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

function evidence(islandId, stageId, optionId, answeredAt) {
  return createEvidence({
    islandId,
    stageId,
    optionId,
    optionText: `${stageId} 的选项文字`,
    target: "self",
    summary: `${stageId} 的中性摘要`,
    signals: [{ dimension: "support", value: optionId, weight: 2 }],
    contextTags: [islandId],
    pressure: "medium",
    answeredAt,
  });
}

function completeState({ office = false } = {}) {
  const selections = [
    ["invitation", "planned"],
    ["fatigue", "empathize"],
    ["slip", "support"],
    ["storm-thought", "protect"],
    ["cave-repair", "hug"],
    ["home-message", "secure"],
    ["city-realization", "build"],
  ];
  return {
    profile: { nickname: "小雾" },
    mountainProgress: {
      completed: true,
      isReplay: false,
      firstCompletedAt: 9000,
      officialEvidence: selections.map(([stageId, optionId], index) => (
        evidence("mountain", stageId, optionId, 1000 + index)
      )),
    },
    storyProgress: office ? {
      office: {
        firstCompletedAt: 12000,
        officialEvidence: [evidence("office", "overtime", "negotiate", 11000)],
      },
    } : {},
  };
}

function validManual(context) {
  return {
    variables: context.request.fixedVariables,
    sections: MANUAL_SECTION_IDS.map((id) => ({
      id,
      title: MANUAL_SECTION_TITLES[id],
      content: "这一章节只把正式证据整理成中性、可读且不作心理诊断的关系说明。",
      confidence: "中",
      evidenceCount: context.evidenceCount,
    })),
    updateSummary: context.completedIslands.length === 1
      ? "初版融合爬山岛证据。"
      : "本版新增工作岛证据。",
  };
}

function elements() {
  return {
    group: new FakeElement("div"),
    icebreakerButton: new FakeElement("button"),
    manualButton: new FakeElement("button"),
    dialog: new FakeElement("dialog"),
    label: new FakeElement("p"),
    title: new FakeElement("h2"),
    meta: new FakeElement("p"),
    status: new FakeElement("p"),
    body: new FakeElement("div"),
    actionButton: new FakeElement("button"),
    closeButton: new FakeElement("button"),
  };
}

function fixture({ state = null, storage = memoryStorage(), fetchImpl } = {}) {
  let currentState = state;
  const nodes = elements();
  const controller = createRelationshipTools({
    characterId: "girl",
    storage,
    elements: nodes,
    loadState: () => currentState,
    fetchImpl,
    documentTarget: { createElement: (tagName) => new FakeElement(tagName) },
  });
  return {
    controller,
    elements: nodes,
    storage,
    setState(next) { currentState = next; },
  };
}

function apiResponse(data, { ok = true, message = "请求失败" } = {}) {
  return {
    ok,
    async json() {
      return ok ? { ok: true, data } : { ok: false, error: { message } };
    },
  };
}

test("爬山七题未完成时隐藏，完成保存并返回地图后立即显示", () => {
  let calls = 0;
  const complete = completeState();
  const feature = fixture({
    state: {
      ...complete,
      mountainProgress: {
        ...complete.mountainProgress,
        completed: false,
        firstCompletedAt: null,
        officialEvidence: complete.mountainProgress.officialEvidence.slice(0, 6),
      },
    },
    fetchImpl: async () => { calls += 1; },
  });
  assert.equal(feature.elements.group.hidden, true);
  feature.setState({
    ...complete,
    mountainProgress: {
      ...complete.mountainProgress,
      completed: false,
      firstCompletedAt: null,
    },
  });
  feature.controller.refresh();
  assert.equal(feature.elements.group.hidden, true);
  feature.setState(complete);
  feature.controller.refresh();
  assert.equal(feature.elements.group.hidden, false);
  assert.equal(feature.elements.icebreakerButton.textContent, "生成破冰话术");
  assert.equal(feature.elements.manualButton.textContent, "生成个人说明书");
  assert.equal(calls, 0);
  feature.controller.dispose();
});

test("匹配缓存直接查看且不发送请求", async () => {
  const state = completeState();
  const storage = memoryStorage();
  const iceContext = createIcebreakerContext({ characterId: "girl", ...state });
  const manualContext = createPersonalManualContext({ characterId: "girl", ...state });
  saveIcebreakerCache(storage, "girl", iceContext.signature, {
    virtualMatchName: "云舟",
    icebreaker: ICEBREAKER,
  }, 3000, "glm-5.3");
  savePersonalManualCache(storage, "girl", manualContext, validManual(manualContext), 1, 4000, "glm-5.3");
  let calls = 0;
  const feature = fixture({ state, storage, fetchImpl: async () => { calls += 1; } });

  assert.equal(feature.elements.icebreakerButton.textContent, "查看破冰话术");
  assert.equal(feature.elements.manualButton.textContent, "查看个人说明书");
  await feature.elements.icebreakerButton.click();
  assert.equal(feature.elements.title.textContent, "破冰话术");
  await feature.elements.manualButton.click();
  assert.equal(feature.elements.title.textContent, "我的个人说明书");
  assert.equal(calls, 0);
  feature.controller.dispose();
});

test("两个按钮独立调用接口并保存有效结果", async () => {
  const state = completeState();
  const calls = [];
  const feature = fixture({
    state,
    fetchImpl: async (url, options) => {
      calls.push([url, JSON.parse(options.body)]);
      if (url.endsWith("icebreaker")) {
        return apiResponse({ virtualMatchName: "云舟", icebreaker: ICEBREAKER, model: "glm-5.3" });
      }
      const context = createPersonalManualContext({ characterId: "girl", ...state });
      return apiResponse({
        ...validManual(context),
        evidenceSignature: context.signature,
        completedIslands: context.completedIslands,
        evidenceCount: context.evidenceCount,
        generatedAt: 5000,
        model: "glm-5.3",
      });
    },
  });

  await feature.elements.icebreakerButton.click();
  assert.equal(feature.elements.icebreakerButton.textContent, "查看破冰话术");
  await feature.elements.manualButton.click();
  assert.equal(feature.elements.manualButton.textContent, "查看个人说明书");
  assert.deepEqual(calls.map(([url]) => url), ["/api/icebreaker", "/api/personal-manual"]);
  assert.equal(feature.elements.icebreakerButton.disabled, false);
  assert.equal(feature.elements.manualButton.disabled, false);
  feature.controller.dispose();
});

test("新增剧情证据只把个人说明书改为更新状态", () => {
  const before = completeState();
  const after = completeState({ office: true });
  const storage = memoryStorage();
  const iceContext = createIcebreakerContext({ characterId: "girl", ...before });
  const manualContext = createPersonalManualContext({ characterId: "girl", ...before });
  saveIcebreakerCache(storage, "girl", iceContext.signature, {
    virtualMatchName: "云舟",
    icebreaker: ICEBREAKER,
  });
  savePersonalManualCache(storage, "girl", manualContext, validManual(manualContext), 1);
  const feature = fixture({ state: before, storage });
  feature.setState(after);
  feature.controller.refresh();
  assert.equal(feature.elements.icebreakerButton.textContent, "查看破冰话术");
  assert.equal(feature.elements.manualButton.textContent, "更新个人说明书");
  feature.controller.dispose();
});

test("个人说明书更新失败时继续展示上一版", async () => {
  const before = completeState();
  const after = completeState({ office: true });
  const storage = memoryStorage();
  const manualContext = createPersonalManualContext({ characterId: "girl", ...before });
  savePersonalManualCache(storage, "girl", manualContext, validManual(manualContext), 1);
  const feature = fixture({
    state: after,
    storage,
    fetchImpl: async () => { throw new Error("network details"); },
  });

  await feature.elements.manualButton.click();
  assert.match(feature.elements.status.textContent, /上一版仍已保留/);
  assert.equal(feature.elements.title.textContent, "我的个人说明书");
  assert.equal(feature.elements.manualButton.textContent, "更新个人说明书");
  feature.controller.dispose();
});

test("关闭卡片使未完成请求失效并把焦点还给入口", async () => {
  let release;
  let signal;
  const pending = new Promise((resolve) => { release = resolve; });
  const feature = fixture({
    state: completeState(),
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      return pending;
    },
  });
  const click = feature.elements.icebreakerButton.click();
  feature.elements.closeButton.click();
  assert.equal(signal.aborted, true);
  release(apiResponse({ virtualMatchName: "云舟", icebreaker: ICEBREAKER }));
  await click;
  assert.equal(feature.elements.dialog.open, false);
  assert.equal(feature.elements.icebreakerButton.focused, true);
  assert.equal(feature.elements.icebreakerButton.textContent, "生成破冰话术");
  feature.controller.dispose();
});
