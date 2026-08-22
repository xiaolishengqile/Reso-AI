import { createChoice } from "../story/story.js";

const s = (dimension, value, weight = 1) => ({ dimension, value, weight });
const c = (id, text, feedback, target, summary, signals, companionMood) => (
  createChoice(id, text, feedback, { target, summary, signals, companionMood })
);

export const moneyStory = Object.freeze({
  id: "money", title: "金钱岛", unlockOrder: 5, unlocksOrder: 6, initialStageId: "appliance-budget",
  theme: Object.freeze({ sky: "#b3a26f", ground: "#5f5c49", accent: "#f3d76d", prop: "money" }),
  contextTags: Object.freeze(["金钱", "公平", "共同责任"]),
  stages: Object.freeze([
    {
      id: "appliance-budget", kind: "choice", title: "买贵还是买便宜", pressure: "medium", recordsEvidence: true,
      narration: "维修费用接近新机价格。一款贵但耐用，另一款便宜却可能几年后再换。",
      prompt: "共同购买时你们怎样决定？", nextStageId: "expense-split",
      choices: [
        c("quality", "优先长期品质，只要不影响基本生活。", "你们选择耐用品，也必须面对眼前现金压力和谁承担更多。", "joint", "共同购买倾向重视长期品质", [s("spending", "long-term-quality", 3), s("risk", "future-cost", 2)], "笃定"),
        c("cash", "先控制当前支出，等条件更好再升级。", "现金安全感被保住，双方也开始讨论每月共同费用如何分担。", "joint", "共同购买倾向优先当前现金安全", [s("spending", "cash-safety", 3), s("security", "liquidity", 2)], "安心"),
        c("total", "设定预算，再比较维修、能耗和使用年限的总成本。", "数字让争执更具体，也暴露出收入差距下“一人一半”是否公平。", "joint", "共同购买倾向比较完整成本后决定", [s("spending", "total-cost", 3), s("planning", "data-based", 2)], "有方向"),
      ],
    },
    {
      id: "expense-split", kind: "choice", title: "收入不一样", pressure: "high", recordsEvidence: true,
      narration: "两人的收入差距逐渐明显。平均分担看似清楚，却未必让双方压力相同。",
      prompt: "共同费用采用什么规则？", nextStageId: "personal-spending",
      choices: [
        c("equal", "各付一半，保持清楚和独立。", "规则简单透明，收入较少的一方却需要减少个人消费。", "joint", "偏好共同费用平均分担", [s("moneyFairness", "equal", 3), s("autonomy", "symmetric", 2)], "克制"),
        c("proportional", "按收入比例分担，让双方压力更接近。", "资源差异被纳入公平。接下来，个人账户能否自由消费成为问题。", "joint", "偏好按资源能力比例分担", [s("moneyFairness", "proportional", 3), s("equity", "capacity-based", 2)], "平衡"),
        c("roles", "按项目和能力分工，金钱之外的照顾也算贡献。", "你们把时间和家务也放进共同账本，随后讨论个人消费应保留多少自主。", "joint", "偏好多种贡献共同构成公平", [s("moneyFairness", "multi-resource", 3), s("careWork", "valued", 2)], "被看见"),
      ],
    },
    {
      id: "personal-spending", kind: "choice", title: "个人账户", pressure: "medium", recordsEvidence: true,
      narration: "你想买一件不便宜但自己很喜欢的东西，它不会影响生存，却会减慢共同目标。",
      prompt: "你最希望{companion}怎样回应？", nextStageId: "family-loan",
      choices: [
        c("respect", "尊重个人账户，不把每次消费都变成审批。", "自主被保留。你也更愿意主动说明真正会影响共同生活的大额决定。", "partner", "期待伴侣尊重个人财务自主", [s("partnerMoney", "respect-autonomy", 3), s("privacy", "financial", 2)], "自在"),
        c("discuss", "重大消费提前商量，但不是由对方批准。", "讨论提供透明度，也没有夺走决定权。此时家人发来借钱请求。", "partner", "期待重大消费透明协商而非审批", [s("partnerMoney", "discuss-major", 3), s("communication", "transparent", 2)], "被尊重"),
        c("goal", "先一起确认是否伤害共同目标，再决定。", "共同目标成为边界。亲友借钱是否会伤害目标，也必须用同样标准面对。", "partner", "期待伴侣以共同目标评估重大消费", [s("partnerMoney", "goal-check", 3), s("planning", "shared-goal", 2)], "踏实"),
      ],
    },
    {
      id: "family-loan", kind: "choice", title: "亲友开口", pressure: "high", recordsEvidence: true,
      narration: "一位重要亲友急需借钱。你想帮忙，{companion}却担心共同生活被拖入长期风险。",
      prompt: "你会怎样处理？", nextStageId: "saving-risk",
      choices: [
        c("personal-limit", "在个人额度内自主帮助，不动共同资金。", "你保留了人情选择，也划清共同责任。剩余资金该怎样储蓄随即成为话题。", "self", "亲友支持倾向使用个人可承受额度", [s("familyBoundary", "personal-budget", 3), s("moneyBoundary", "separate", 2)], "理解"),
        c("assess", "一起核实需要、期限和最坏结果后共同决定。", "风险被具体讨论，帮助不再只靠冲动。你们顺势审视储蓄和投资安排。", "self", "亲友借款倾向共同评估风险", [s("familyBoundary", "joint-assessment", 3), s("risk", "informed", 2)], "认真"),
        c("protect", "明确拒绝会影响共同生活底线的请求。", "底线保护了两个人，也带来一点愧疚。你们决定先建立更清楚的安全储备。", "self", "亲友责任不得越过共同生活底线", [s("familyBoundary", "firm-limit", 3), s("security", "household-first", 2)], "复杂"),
      ],
    },
    {
      id: "saving-risk", kind: "choice", title: "安全还是增长", pressure: "medium", recordsEvidence: true,
      narration: "一个人偏好稳定储蓄，另一个人愿意承担波动换取增长。",
      prompt: "共同资金怎样安排？", nextStageId: "hidden-spending",
      choices: [
        c("safe", "共同资金以安全储备为主。", "稳定感提高，却需要接受增长可能更慢。核对账户时，一笔未说明的支出出现了。", "joint", "共同资金倾向安全和可预测", [s("risk", "conservative", 3), s("security", "reserve", 2)], "安心"),
        c("portion", "保留安全底线，再用小部分尝试高风险。", "你们为风险设了上限。随后发现，另一笔支出没有经过同样的透明讨论。", "joint", "偏好在安全底线内有限尝试风险", [s("risk", "bounded", 3), s("flexibility", "portfolio", 2)], "平衡"),
        c("separate", "共同资金稳健，个人资金自行决定风险。", "共同与个人边界变清楚，却也让一笔跨过边界的隐藏支出更加醒目。", "joint", "偏好共同资金稳健且个人风险自主", [s("risk", "separated", 3), s("autonomy", "investment", 2)], "清楚"),
      ],
    },
    {
      id: "hidden-spending", kind: "choice", title: "没有说的支出", pressure: "high", recordsEvidence: true,
      narration: "这笔支出不至于影响生活，却拖慢了共同目标，而且与一次亲友聚会有关。",
      prompt: "你怎样修复受损的信任？", nextStageId: "complete",
      choices: [
        c("understand", "先了解隐瞒原因，再重建适用于双方的规则。", "原因被听见，责任也没有消失。你们决定一起参加那场朋友聚会，把关系放回真实社交中。", "self", "信任受损时倾向理解原因并重建规则", [s("moneyRepair", "understand-and-rule", 3), s("trust", "repairable", 2)], "缓和"),
        c("transparency", "要求一段时间内增加透明度，之后再恢复原边界。", "临时透明期给恢复设置了路径。聚会邀请仍在，你们商量以什么状态一起出现。", "self", "信任受损时接受有期限的加强透明", [s("moneyRepair", "temporary-transparency", 3), s("trust", "earned-back", 2)], "谨慎"),
        c("separate", "重新划清共同与个人账户，避免同类影响再次发生。", "边界被重新画清。那笔支出背后的家人和朋友关系，也将成为下一座社交岛的主题。", "self", "信任受损时倾向用结构边界降低风险", [s("moneyRepair", "structural-boundary", 3), s("control", "preventive", 2)], "疏离"),
      ],
    },
    { id: "complete", kind: "complete", title: "共同账本之外", narration: "你们没有用金额定义爱，而是说清了公平、透明和安全。聚会的音乐从下一座岛传来。", prompt: "", recordsEvidence: false, nextStageId: null, choices: [] },
  ]),
});
