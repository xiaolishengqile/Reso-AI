const FATIGUE_OPTIONS = new Set(["solve", "empathize", "blame"]);
const SLIP_OPTIONS = new Set(["command", "support", "freeze"]);
const STORM_OPTIONS = new Set(["finish", "extreme", "retreat", "protect"]);
const REPAIR_OPTIONS = new Set(["lecture", "hug", "space"]);
const HOME_OPTIONS = new Set(["avoid", "secure", "anxious"]);
const VISION_OPTIONS = new Set(["build", "enjoy", "roam"]);

const DEFENSE = Object.freeze({
  command: Object.freeze({
    name: "危机中倾向用指令接管局面的行动者",
    reaction: "通过清晰指令迅速组织行动，恢复局面秩序",
  }),
  support: Object.freeze({
    name: "默默行动的实干者",
    reaction: "少说多做，用实际行动为同伴提供可靠支点",
  }),
  freeze: Object.freeze({
    name: "高刺激下需要缓冲的敏感反应者",
    reaction: "可能短暂停顿和信息过载，随后再进入行动",
  }),
});

const COMMUNICATION_START = Object.freeze({
  solve: "先拆解客观问题",
  empathize: "先确认彼此感受",
  blame: "压力下可能先划分责任",
});

const FALLBACK_FORBIDDEN = Object.freeze({
  finish: Object.freeze([
    "需要避开只谈目标、不承担关系影响",
    "责任边界可能被误读为把人推开",
    "最难接受遇事放弃共同承担、只留下指责",
  ]),
  extreme: Object.freeze([
    "需要避开浪漫化危险和冲突",
    "责任边界可能被误读为否定共同体验",
    "最难接受为了情绪浓度忽视现实后果",
  ]),
  retreat: Object.freeze([
    "需要避开压力下彻底抽离",
    "止损选择可能被误读为只顾自保",
    "最难接受在危机中切断沟通和情感连接",
  ]),
  protect: Object.freeze([
    "需要避开以保护为名全面接管",
    "责任边界可能被误读为拒绝接受帮助",
    "最难接受以关心为名剥夺判断和自主性",
  ]),
});

const VISION = Object.freeze({
  build: Object.freeze([
    "在城市扎根并建设长期家园",
    "你目前更向往稳定扎根，建设能够提供安全感和长期承诺的共同生活。",
  ]),
  enjoy: Object.freeze([
    "重视当下的热饭、拥抱与真实体验",
    "你目前更希望减少被遥远规划压抑，认真感受当下生活与关系中的真实连接。",
  ]),
  roam: Object.freeze([
    "保持流动并追求自由探索",
    "你目前更向往在路上持续探索，体验更远、更自由且没有固定剧本的人生。",
  ]),
});

function findEvidence(evidence, stageId) {
  return evidence.find((item) => item?.islandId === "mountain" && item.stageId === stageId);
}

function evidenceRef(evidence) {
  return `${evidence.islandId}/${evidence.stageId}/${evidence.optionId}@${evidence.answeredAt}`;
}

function createVariable(id, name, description, confidence, evidence) {
  return {
    id,
    name,
    description,
    confidence,
    evidenceRefs: evidence.map(evidenceRef),
  };
}

function resolveDefenseVariables(evidence) {
  const fatigue = findEvidence(evidence, "fatigue");
  const slip = findEvidence(evidence, "slip");
  if (!FATIGUE_OPTIONS.has(fatigue?.optionId) || !SLIP_OPTIONS.has(slip?.optionId)) return [];
  const defense = DEFENSE[slip.optionId];
  const start = COMMUNICATION_START[fatigue.optionId];
  const refs = [fatigue, slip];
  return [
    createVariable(
      "crisisInstinct",
      defense.name,
      `第 3 题显示你在突发危险中${defense.reaction}。这描述的是当次选择呈现的行为方向，不是固定人格。`,
      "高",
      refs,
    ),
    createVariable(
      "involuntaryReaction",
      defense.reaction,
      `结合第 2、3 题，你会${start}，再${defense.reaction}。后续旅程会继续验证这一倾向。`,
      "高",
      refs,
    ),
  ];
}

function resolveForbiddenVariables(evidence) {
  const fatigue = findEvidence(evidence, "fatigue");
  const storm = findEvidence(evidence, "storm-thought");
  const home = findEvidence(evidence, "home-message");
  if (
    !FATIGUE_OPTIONS.has(fatigue?.optionId)
    || !STORM_OPTIONS.has(storm?.optionId)
    || !HOME_OPTIONS.has(home?.optionId)
  ) return [];

  let names;
  let confidence = "高";
  if (home.optionId === "anxious") {
    names = [
      "需要避开长期撤退和冷处理",
      "情绪确认可能被误读为压力",
      "最难接受冷处理和回避共同承担",
    ];
  } else if (fatigue.optionId === "solve") {
    names = [
      "需要避开遇事推卸责任",
      "事实方案导向可能被误读为缺少温度",
      "最难接受把现实责任留给伴侣",
    ];
  } else if (fatigue.optionId === "empathize") {
    names = [
      "需要避开目标压过安全与感受",
      "共情优先可能被误读为犹豫",
      "最难接受为目标忽视安全和主体性",
    ];
  } else {
    names = FALLBACK_FORBIDDEN[storm.optionId];
    confidence = "中";
  }
  const refs = [fatigue, storm, home];
  return [
    createVariable(
      "incompatiblePattern",
      names[0],
      `当前三组证据显示，这类相处方式容易持续触发你的脆弱点，适合尽早识别并建立边界。`,
      confidence,
      refs,
    ),
    createVariable(
      "possibleMisreading",
      names[1],
      `不相容对象可能这样解读你的外在表现；这是一种关系情境中的可能误读，不是对你的定论。`,
      confidence,
      refs,
    ),
    createVariable(
      "negativeFeeling",
      names[2],
      `当对方长期采用相反模式时，你可能感到不被理解、不被共同承担，或失去关系中的安全边界。`,
      confidence,
      refs,
    ),
  ];
}

function repairMode(repair, home) {
  if (repair.optionId === "space") return "space";
  if (repair.optionId === "hug") return "connection";
  if (repair.optionId === "lecture" && home.optionId === "avoid") return "space";
  if (repair.optionId === "lecture" && home.optionId === "anxious") return "connection";
  return "balanced";
}

function resolveRepairVariables(evidence) {
  const repair = findEvidence(evidence, "cave-repair");
  const home = findEvidence(evidence, "home-message");
  if (!REPAIR_OPTIONS.has(repair?.optionId) || !HOME_OPTIONS.has(home?.optionId)) return [];
  const mode = repairMode(repair, home);
  const refs = [repair, home];
  const content = mode === "space"
    ? [
        "需要避开事后说教和高密度逼问",
        "实际照顾后留出距离",
        "不被打扰的缓冲空间",
      ]
    : mode === "connection"
      ? [
          "需要避开低谷期的冷处理",
          "稳定拥抱与在场陪伴",
          "稳定连接与明确肯定",
        ]
      : [
          "需要避开只判对错、不确认感受",
          "先确认安全，再平等复盘",
          "保持连接又不被否定的安全沟通",
        ];
  return [
    createVariable(
      "relationshipRedLine",
      content[0],
      "关系修复时，先尊重这一红线，才能避免让一次冲突演变成长期的疏离。",
      "高",
      refs,
    ),
    createVariable(
      "repairAction",
      content[1],
      "合适的伴侣会先用你能接住的方式确认安全，再进入讨论和共同解决。",
      "高",
      refs,
    ),
    createVariable(
      "recoveryNeed",
      content[2],
      "这类补给更有助于你从高压中恢复，并重新建立可继续沟通的连接感。",
      "高",
      refs,
    ),
  ];
}

function resolveVisionVariable(evidence) {
  const vision = findEvidence(evidence, "city-realization");
  if (!VISION_OPTIONS.has(vision?.optionId)) return [];
  const [name, description] = VISION[vision.optionId];
  return [createVariable("lifeVision", name, description, "高", [vision])];
}

export function resolveFixedManualVariables(evidence = []) {
  return [
    ...resolveDefenseVariables(evidence),
    ...resolveForbiddenVariables(evidence),
    ...resolveRepairVariables(evidence),
    ...resolveVisionVariable(evidence),
  ];
}
