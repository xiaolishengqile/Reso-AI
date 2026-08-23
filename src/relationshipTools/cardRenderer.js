const ISLAND_NAMES = Object.freeze({
  mountain: "爬山岛",
  office: "工作岛",
  dining: "吃饭岛",
  cohabitation: "同居岛",
  money: "金钱岛",
  social: "社交岛",
  travel: "旅行岛",
  future: "未来岛",
});

function node(documentTarget, tagName, className = "", textContent = "") {
  const element = documentTarget.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
}

function generatedTime(value) {
  if (!Number.isFinite(value)) return "";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function setHeader(elements, { label, title, meta = "", status = "" }) {
  elements.label.textContent = label;
  elements.title.textContent = title;
  elements.meta.textContent = meta;
  elements.status.textContent = status;
}

export function renderRelationshipLoading(elements, type) {
  const isManual = type === "manual";
  setHeader(elements, {
    label: isManual ? "持续成长 · 个人说明书" : "虚拟设定 · 破冰话术",
    title: isManual ? "正在整理你的个人说明书" : "正在生成破冰话术",
    status: "正在读取已保存的正式剧情证据，请稍候……",
  });
  elements.body.replaceChildren();
}

export function renderRelationshipError(elements, message) {
  setHeader(elements, {
    label: "关系反馈暂时不可用",
    title: "这次没有生成成功",
    status: message || "请求暂时失败，请稍后重试。",
  });
  elements.body.replaceChildren();
}

export function renderIcebreakerCard(elements, result, documentTarget, status = "") {
  setHeader(elements, {
    label: "虚拟设定 · 破冰话术",
    title: "破冰话术",
    meta: generatedTime(result.generatedAt),
    status,
  });
  const article = node(documentTarget, "article", "relationship-card__icebreaker");
  article.append(
    node(documentTarget, "span", "relationship-card__badge", "虚拟匹配对象"),
    node(documentTarget, "h3", "", result.virtualMatchName),
    node(documentTarget, "p", "relationship-card__quote", result.icebreaker),
    node(
      documentTarget,
      "small",
      "relationship-card__evidence-note",
      "生成依据：爬山岛七组首次正式选择。此对象是剧情虚拟设定，不是真实注册用户。",
    ),
  );
  elements.body.replaceChildren(article);
}

function renderVariable(variable, documentTarget) {
  const article = node(documentTarget, "article", "manual-variable");
  const heading = node(documentTarget, "h4", "", variable.name);
  heading.append(node(documentTarget, "span", "manual-variable__confidence", variable.confidence));
  article.append(
    heading,
    node(documentTarget, "p", "", variable.description),
    node(
      documentTarget,
      "small",
      "",
      `正式证据 ${variable.evidenceRefs.length} 条`,
    ),
  );
  return article;
}

function renderSection(section, documentTarget) {
  const article = node(documentTarget, "article", "manual-section");
  article.append(
    node(documentTarget, "h4", "", section.title),
    node(documentTarget, "p", "", section.content),
    node(
      documentTarget,
      "small",
      "",
      `置信度 ${section.confidence} · 正式证据 ${section.evidenceCount} 条`,
    ),
  );
  return article;
}

export function renderPersonalManualCard(elements, result, documentTarget, status = "") {
  const sources = (result.completedIslands ?? [])
    .map((id) => ISLAND_NAMES[id] ?? id)
    .join("、");
  setHeader(elements, {
    label: "持续成长 · 个人说明书",
    title: "我的个人说明书",
    meta: `第 ${result.revision} 版 · 已融合：${sources}`,
    status,
  });

  const update = node(documentTarget, "aside", "manual-update");
  update.append(
    node(documentTarget, "strong", "", "本版更新"),
    node(documentTarget, "p", "", result.updateSummary),
  );
  const variableSection = node(documentTarget, "section", "manual-block");
  variableSection.append(node(documentTarget, "h3", "", "九个核心变量"));
  const variableGrid = node(documentTarget, "div", "manual-variable-grid");
  variableGrid.append(...result.variables.map((item) => renderVariable(item, documentTarget)));
  variableSection.append(variableGrid);

  const narrativeSection = node(documentTarget, "section", "manual-block");
  narrativeSection.append(node(documentTarget, "h3", "", "五个相处章节"));
  const sectionList = node(documentTarget, "div", "manual-section-list");
  sectionList.append(...result.sections.map((item) => renderSection(item, documentTarget)));
  narrativeSection.append(sectionList);
  elements.body.replaceChildren(update, variableSection, narrativeSection);
}
