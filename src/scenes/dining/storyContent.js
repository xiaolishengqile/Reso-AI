import { createChoice } from "../story/story.js";

const s = (dimension, value, weight = 1) => ({ dimension, value, weight });
const c = (id, text, feedback, target, summary, signals, companionMood) => (
  createChoice(id, text, feedback, { target, summary, signals, companionMood })
);

export const diningStory = Object.freeze({
  id: "dining",
  title: "吃饭岛",
  unlockOrder: 3,
  unlocksOrder: 4,
  initialStageId: "restaurant-choice",
  theme: Object.freeze({ sky: "#d79e77", ground: "#6c554d", accent: "#ffd18a", prop: "restaurant" }),
  contextTags: Object.freeze(["吃饭", "日常沟通", "生活习惯"]),
  stages: Object.freeze([
    {
      id: "restaurant-choice", kind: "choice", title: "今晚吃什么", pressure: "low", recordsEvidence: true,
      narration: "你们来到餐饮街，一人惦记熟悉的老店，另一人想试刚开业的新餐厅。",
      prompt: "今晚按什么方式决定？", nextStageId: "meal-rhythm",
      choices: [
        c("alternate", "这次听你的，下次由我选。", "轮流让决定变得清楚。进店后，{companion}兴奋地想边吃边聊今天的事。", "joint", "偏好通过轮流决定维持关系公平", [s("fairness", "alternating", 2), s("foodStyle", "predictable", 1)], "开心"),
        c("new", "一起找一家双方都没吃过、又能接受的新店。", "共同探索让输赢感消失。菜刚上桌，你们对吃饭时要不要聊天又有不同节奏。", "joint", "偏好通过共同探索寻找第三种方案", [s("fairness", "third-option", 2), s("novelty", "shared", 2)], "期待"),
        c("need", "先问今天谁更需要被满足，再决定去哪里。", "你们根据当天状态作出选择。坐下后，疲惫的一方只想安静吃饭。", "joint", "偏好根据当下需要弹性分配选择权", [s("fairness", "need-based", 3), s("empathy", "contextual", 2)], "被照顾"),
      ],
    },
    {
      id: "meal-rhythm", kind: "choice", title: "饭桌节奏", pressure: "low", recordsEvidence: true,
      narration: "热菜端上桌。{companion}想继续刚才的话，你却也能理解有人需要先安静恢复。",
      prompt: "你更自然的吃饭方式是什么？", nextStageId: "sharing-boundary",
      choices: [
        c("talk", "边吃边聊，饭桌就是最放松的交流时间。", "谈话让你觉得彼此靠近。说到兴奋处，{companion}顺手夹走了你最喜欢的一块。", "self", "把共同用餐视为重要交流时间", [s("mealRhythm", "talking", 3), s("connection", "conversation", 2)], "亲近"),
        c("quiet", "先认真吃完，等身体放松后再好好聊。", "安静没有被误解成冷漠。吃到一半，{companion}下意识伸向你留到最后的食物。", "self", "倾向先安静进食再集中交流", [s("mealRhythm", "quiet-first", 3), s("energy", "recover-before-talk", 2)], "平静"),
        c("parallel", "允许各自放松，吃完再约一段专门交流的时间。", "你们短暂各自待着，又保留稍后的连接。就在这时，最后一块食物被对方夹走。", "self", "接受并行放松并用明确时间重新连接", [s("mealRhythm", "parallel", 3), s("autonomy", "together-apart", 2)], "放松"),
      ],
    },
    {
      id: "sharing-boundary", kind: "choice", title: "最后一口", pressure: "low", recordsEvidence: true,
      narration: "那是你一直留到最后的食物。事情很小，却足够看见边界会不会被说出来。",
      prompt: "你会怎么回应？", nextStageId: "diet-support",
      choices: [
        c("direct", "直接说我想留着，下次拿之前先问我。", "边界被清楚听见。{companion}道歉，也认真问起你还有哪些饮食习惯。", "self", "小摩擦中倾向直接说明具体边界", [s("communication", "direct", 2), s("foodBoundary", "ask-first", 3)], "理解"),
        c("share", "这次一起分，但告诉对方我其实很喜欢这份。", "分享和说明同时发生。谈话自然转到你的忌口和对方的饮食偏好。", "self", "愿意分享同时温和表达个人偏好", [s("communication", "gentle", 2), s("foodBoundary", "share-with-context", 2)], "温暖"),
        c("silent", "先不说，把这件事记在心里观察。", "你安静下来，{companion}察觉了变化并主动询问。你们因此谈到不容易开口的忌口。", "self", "小摩擦中倾向先观察再决定是否表达", [s("communication", "delayed", 2), s("conflict", "observe-first", 2)], "不安"),
      ],
    },
    {
      id: "diet-support", kind: "choice", title: "吃不下的菜", pressure: "low", recordsEvidence: true,
      narration: "新上的菜正好触碰你的忌口。你不想扫兴，却也不想勉强自己。",
      prompt: "你最希望{companion}怎样回应？", nextStageId: "phone-repair",
      choices: [
        c("replace", "主动帮我问能不能换菜，让我感到被照顾。", "{companion}立刻叫来服务员。被照顾的感觉很具体，却被一阵手机提示音打断。", "partner", "期待伴侣主动处理明确的生活不适", [s("partnerCare", "active-help", 3), s("support", "practical", 2)], "被照顾"),
        c("respect", "尊重我不吃，不必把这件事变成全桌焦点。", "{companion}自然把菜移开，没有追问。轻松的气氛里，手机消息却越来越多。", "partner", "期待伴侣尊重选择并减少过度关注", [s("partnerCare", "quiet-respect", 3), s("autonomy", "low-attention", 2)], "自在"),
        c("together", "先问我的感受，再一起找双方都舒服的办法。", "你们重新加了一道菜。协商很顺利，直到{companion}低头回复了很久的消息。", "partner", "期待伴侣先确认需要再共同处理", [s("partnerCare", "ask-and-solve", 3), s("communication", "confirm-first", 2)], "安心"),
      ],
    },
    {
      id: "phone-repair", kind: "choice", title: "被手机切开的晚餐", pressure: "medium", recordsEvidence: true,
      narration: "对话几次停在手机提示音里。{companion}终于说：“我感觉你并没有真的在这里。”",
      prompt: "你怎样修复这份被忽略感？", nextStageId: "payment-rule",
      choices: [
        c("acknowledge", "先承认对方被晾在一边，再解释消息的原因。", "感受先被接住，解释也更容易听进去。气氛缓和后，服务员送来了账单。", "self", "修复时倾向先确认情绪伤害再解释", [s("repair", "emotion-first", 3), s("accountability", "acknowledge", 2)], "被理解"),
        c("action", "收起手机，用接下来的专注行动补回来。", "你把手机翻面，完整听完对方的话。实际变化让紧张下降，结账问题随之出现。", "self", "修复时倾向用可见行动恢复连接", [s("repair", "action", 3), s("presence", "focused", 2)], "安心"),
        c("rule", "说明情况，并马上约定以后吃饭时的手机规则。", "规则让类似冲突有了出口。你们顺势讨论起以后吃饭该怎样付钱。", "self", "修复时倾向把冲突转成共同规则", [s("repair", "rule-building", 3), s("planning", "preventive", 2)], "踏实"),
      ],
    },
    {
      id: "payment-rule", kind: "choice", title: "这一顿谁来付", pressure: "medium", recordsEvidence: true,
      narration: "账单放在桌边。金额不算大，但谁付钱常常代表照顾、公平和自主。",
      prompt: "以后更适合你们的方式是什么？", nextStageId: "complete",
      choices: [
        c("alternate", "轮流请客，不必每顿都精确计算。", "你们把下一顿也约好了。离开餐厅后，{companion}提议今晚留宿，明早再一起回家。", "joint", "偏好用轮流承担表达公平与照顾", [s("moneyFairness", "alternating", 3), s("care", "treating", 1)], "轻松"),
        c("proportional", "按收入或当次消费大致分担。", "分担方式照顾了现实差异。回家路上，你们讨论起频繁留宿后的生活安排。", "joint", "偏好根据资源差异分担日常支出", [s("moneyFairness", "proportional", 3), s("equity", "capacity-based", 2)], "平衡"),
        c("independent", "保留各自付款习惯，较大支出提前商量。", "个人自主得到保留。{companion}收起账单，问你是否愿意一起回家并试住一段时间。", "joint", "偏好日常财务自主并协商重大支出", [s("moneyFairness", "independent", 3), s("autonomy", "financial", 2)], "自在"),
      ],
    },
    { id: "complete", kind: "complete", title: "烟火之后", narration: "一顿饭把不起眼的习惯变成了可以讨论的边界。你们并肩回家，第一次认真想象共同生活的早晨。", prompt: "", recordsEvidence: false, nextStageId: null, choices: [] },
  ]),
});
