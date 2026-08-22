const s = (dimension, value, weight = 1) => Object.freeze({ dimension, value, weight });
const d = (summary, signals) => Object.freeze({
  target: "self",
  summary,
  signals: Object.freeze(signals),
});

const DEFINITIONS = Object.freeze({
  invitation: Object.freeze({
    planned: d("共同出行前倾向先确认装备、天气和备用路线", [s("planning", "structured", 2), s("risk", "cautious")]),
    escape: d("共同出行时重视暂离日常和即兴体验", [s("exploration", "spontaneous", 2), s("autonomy", "escape-routine")]),
    devoted: d("面对伴侣想尝试的冒险时倾向优先陪伴", [s("closeness", "devoted", 2), s("risk", "relationship-first")]),
  }),
  fatigue: Object.freeze({
    solve: d("疲惫出现时倾向先核对信息并寻找可执行办法", [s("emotionalSupport", "problem-solving", 2), s("stressResponse", "practical")]),
    empathize: d("疲惫出现时倾向先承认感受并允许调整计划", [s("emotionalSupport", "empathy", 3), s("support", "reassurance", 2)]),
    blame: d("疲惫压力下倾向先指出决定来源和责任归属", [s("conflict", "blame-first", 2), s("accountability", "externalized")]),
  }),
  slip: Object.freeze({
    command: d("突发危险中倾向用明确指令组织双方行动", [s("stressResponse", "directive", 3), s("support", "verbal-guidance")]),
    support: d("突发危险中倾向先用具体行动提供支点", [s("stressResponse", "action-support", 3), s("reliability", "hands-on", 2)]),
    freeze: d("突发危险中可能先短暂停顿，再进入行动", [s("stressResponse", "delayed-response", 2), s("overload", "brief-pause")]),
  }),
  "storm-thought": Object.freeze({
    finish: d("计划受阻时倾向坚持原定目标", [s("decision", "goal-persistence", 3), s("risk", "fixed-plan", 2)]),
    "sunk-cost": d("计划受阻时会认真衡量已经投入的成本", [s("decision", "loss-averse", 2), s("risk", "sunk-cost", 2)]),
    thrill: d("不确定情境中容易关注少见体验的吸引力", [s("risk", "thrill-seeking", 3), s("exploration", "novelty", 2)]),
    protect: d("危险情境中倾向主动承担保护责任", [s("support", "protective", 3), s("responsibility", "take-charge", 2)]),
  }),
  "cave-repair": Object.freeze({
    lecture: d("危机过后倾向先复盘错误和改进办法", [s("repair", "correction-first", 2), s("communication", "analysis-first", 2)]),
    hug: d("危机过后倾向先通过拥抱和确认恢复连接", [s("repair", "reconnect-first", 3), s("emotionalSupport", "reassurance", 3)]),
    space: d("危机过后倾向提供实际照顾，并给对方缓冲空间", [s("repair", "space-first", 3), s("emotionalSupport", "practical", 2)]),
  }),
  "home-message": Object.freeze({
    avoid: d("高强度共同经历后倾向先独处，再恢复联系", [s("closeness", "recovery-distance", 2), s("communication", "delayed", 2)]),
    secure: d("关系加深时愿意接纳彼此不完美和脆弱的一面", [s("vulnerability", "acceptance", 3), s("closeness", "honest", 2)]),
    anxious: d("关系加深后倾向通过充分复盘和确认获得安心", [s("closeness", "reassurance-seeking", 3), s("communication", "intensive", 2)]),
  }),
  "city-realization": Object.freeze({
    build: d("经历不确定后更重视稳定生活和长期建设", [s("futureHome", "stable", 3), s("lifestyle", "rooted", 2)]),
    enjoy: d("经历不确定后更重视当下体验和真实感受", [s("lifestyle", "present-focused", 3), s("planning", "flexible")]),
    roam: d("经历不确定后仍向往流动生活和未知探索", [s("futureHome", "mobile", 2), s("exploration", "open", 3)]),
  }),
});

export function getMountainEvidenceDefinition(stageId, optionId) {
  return DEFINITIONS[stageId]?.[optionId] ?? null;
}
