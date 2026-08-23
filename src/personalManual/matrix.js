const FIXED_CHOICES = new Set(["solve", "empathize", "blame"]);
const FIXED_REACTIONS = new Set(["command", "support", "freeze"]);

const MATRIX = Object.freeze({
  "solve/command": Object.freeze([
    "理性主导的危机掌控者",
    "先寻找客观方案，再通过明确指令恢复局面秩序",
  ]),
  "solve/support": Object.freeze([
    "务实的行动守护者",
    "先拆解问题并越过无效安慰，用直接行动提供支撑",
  ]),
  "solve/freeze": Object.freeze([
    "理性先行、极压下需要缓冲",
    "常态擅长分析，极端刺激下可能短暂信息过载",
  ]),
  "empathize/command": Object.freeze([
    "共情但危机时会强势接管",
    "先在意感受，危险升级时倾向用指令保护并主导局面",
  ]),
  "empathize/support": Object.freeze([
    "温柔而可靠的托底者",
    "优先接纳情绪，并用沉默而实际的行动提供支撑",
  ]),
  "empathize/freeze": Object.freeze([
    "高敏感共情、极压下易过载",
    "常态能够温柔回应，极端恐惧前需要更多处理时间",
  ]),
  "blame/command": Object.freeze([
    "恐惧下以控制保护自己",
    "压力下可能先归责，再通过发号施令找回控制感",
  ]),
  "blame/support": Object.freeze([
    "嘴硬但会行动托底",
    "言语上可能先抱怨，关键时刻仍会用行动保护关系",
  ]),
  "blame/freeze": Object.freeze([
    "高刺激下先自我保护",
    "信息过载时可能同时出现僵住、退缩和责任防御",
  ]),
});

function evidenceRef(evidence) {
  return `${evidence.islandId}/${evidence.stageId}/${evidence.optionId}@${evidence.answeredAt}`;
}

export function resolveFixedManualVariables(evidence = []) {
  const fatigue = evidence.find((item) => (
    item?.islandId === "mountain" && item.stageId === "fatigue"
  ));
  const slip = evidence.find((item) => (
    item?.islandId === "mountain" && item.stageId === "slip"
  ));
  if (
    !fatigue
    || !slip
    || !FIXED_CHOICES.has(fatigue.optionId)
    || !FIXED_REACTIONS.has(slip.optionId)
  ) return null;

  const [instinct, reaction] = MATRIX[`${fatigue.optionId}/${slip.optionId}`];
  const evidenceRefs = [evidenceRef(fatigue), evidenceRef(slip)];
  return [
    {
      id: "crisisInstinct",
      name: instinct,
      description: `在当前爬山岛证据中，你${reaction}。后续旅程会继续验证这一倾向。`,
      confidence: "高",
      evidenceRefs,
    },
    {
      id: "involuntaryReaction",
      name: reaction,
      description: `高压情境下，你目前更可能${reaction}。这描述的是当次选择呈现的行为方向，不是固定人格。`,
      confidence: "高",
      evidenceRefs,
    },
  ];
}
