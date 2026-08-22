import { createChoice } from "../story/story.js";

const s = (dimension, value, weight = 1) => ({ dimension, value, weight });
const c = (id, text, feedback, target, summary, signals, companionMood) => (
  createChoice(id, text, feedback, { target, summary, signals, companionMood })
);

export const futureStory = Object.freeze({
  id: "future",
  title: "未来岛",
  unlockOrder: 8,
  unlocksOrder: 9,
  initialStageId: "home-city",
  theme: Object.freeze({ sky: "#9b95bd", ground: "#666985", accent: "#f0c6a4", prop: "future" }),
  contextTags: Object.freeze(["长期生活", "承诺", "人生选择"]),
  stages: Object.freeze([
    {
      id: "home-city", kind: "choice", title: "哪座城市算家", pressure: "medium", recordsEvidence: true,
      narration: "旅行归来后，你们把地图摊在桌上。工作机会、家人距离和生活成本指向不同城市。",
      prompt: "长期居住地出现分歧时，你偏好怎样决定？", nextStageId: "career-move",
      choices: [
        c("score", "列出双方最重要的条件，按共同优先级比较城市。", "抽象争论变成了具体条件，其中事业发展的权重依然需要认真讨论。", "joint", "长期居住地偏好按共同标准理性比较", [s("futureHome", "shared-criteria", 3), s("decision", "structured", 2)], "清晰"),
        c("trial", "先选一座城市试住一段时间，再按真实体验复盘。", "试住降低了不可逆感，也让谁为谁搬迁的问题无法再回避。", "joint", "长期居住地偏好先试住再确认", [s("futureHome", "trial", 3), s("flexibility", "reviewable", 2)], "有空间"),
        c("anchor", "先确定现阶段最不能牺牲的一方需求，几年后重新平衡。", "阶段重点被承认，但未来如何补偿需要可信承诺。新的职业机会很快检验了这个原则。", "joint", "长期居住地接受阶段侧重并要求未来再平衡", [s("futureHome", "phased-priority", 3), s("fairness", "long-term", 2)], "郑重"),
      ],
    },
    {
      id: "career-move", kind: "choice", title: "为谁改变轨道", pressure: "high", recordsEvidence: true,
      narration: "{companion}得到一个跨城发展机会，而你的生活和事业已经在这里扎根。支持与牺牲都不该只是一句口号。",
      prompt: "你最期待伴侣怎样面对这类机会？", nextStageId: "commitment-form",
      choices: [
        c("shared-cost", "把双方的收益和损失都算进去，共同承担搬迁成本。", "你期待机会属于一个人，代价却由两个人共同看见。讨论随后进入长期承诺。", "partner", "期待伴侣把事业迁移视为双方共同决策", [s("careerSupport", "shared-cost", 3), s("fairness", "visible-sacrifice", 2)], "被看见"),
        c("support-dream", "重要机会来临时愿意支持追求，但要有团聚期限。", "成长空间得到支持，关系也需要明确终点。期限让你们开始谈承诺应当是什么形式。", "partner", "期待伴侣支持重要发展并给关系清晰期限", [s("careerSupport", "dream-with-deadline", 3), s("commitment", "time-bounded", 2)], "被支持"),
        c("protect-base", "当共同生活已经稳定时，愿意优先保护两人的生活基础。", "你重视稳定不是为了限制成长，而是认为共同生活本身也值得被选择。", "partner", "期待伴侣在关键时刻主动保护共同生活", [s("careerSupport", "protect-shared-base", 3), s("stability", "relationship", 2)], "安心"),
      ],
    },
    {
      id: "commitment-form", kind: "choice", title: "承诺长什么样", pressure: "medium", recordsEvidence: true,
      narration: "城市和事业谈得越具体，关系形式就越难含糊。仪式、法律关系与日常兑现，对不同人意义不同。",
      prompt: "你会怎样说明自己需要的承诺？", nextStageId: "children",
      choices: [
        c("formal", "我需要明确公开和正式的长期承诺，才有安全感。", "你直接说出形式的重要性，也愿意听对方为何看重或担心它。更深的家庭议题随之到来。", "self", "长期关系中重视正式且公开的承诺", [s("commitmentForm", "formal", 3), s("security", "explicit", 2)], "确定"),
        c("daily", "我更看重持续的责任分担，形式可以共同商量。", "你把承诺放在日常兑现里，也承认形式仍需要双方同意。关于孩子的想法接着被提出。", "self", "长期关系中更看重持续行动和责任", [s("commitmentForm", "daily-action", 3), s("reliability", "ongoing", 2)], "踏实"),
        c("phased", "先约定阶段目标，达到条件后再进入下一种承诺。", "承诺被拆成可观察的步骤。下一步是否包含孩子，成为无法跳过的问题。", "self", "长期关系中偏好分阶段建立承诺", [s("commitmentForm", "phased", 3), s("planning", "milestones", 2)], "有方向"),
      ],
    },
    {
      id: "children", kind: "choice", title: "无法代替对方决定", pressure: "high", recordsEvidence: true,
      narration: "你们对是否要孩子、何时要孩子的想法并不完全一致。这不是靠含糊拖延就会自动消失的分歧。",
      prompt: "面对可能无法折中的人生选择，你认为怎样才诚实？", nextStageId: "parent-care",
      choices: [
        c("clarify", "把各自底线和仍可讨论的部分说清楚，不用爱施压。", "底线被尊重后，双方更能判断这段关系是否真的同路，也开始谈双方父母的未来。", "joint", "根本分歧中偏好坦诚区分底线和可协商部分", [s("children", "boundary-clarity", 3), s("honesty", "non-coercive", 2)], "被尊重"),
        c("learn", "先补足养育与生活影响的信息，再约定明确复谈时间。", "你们没有假装已有答案，也没有无限期搁置。复谈计划延伸到家庭照护责任。", "joint", "重大人生选择中偏好充分了解后定期复谈", [s("children", "informed-review", 3), s("decision", "deliberate", 2)], "慎重"),
        c("accept", "如果确认无法折中，就诚实承认不匹配，而不是期待对方改变。", "你们承认爱情不能抹平所有根本选择。诚实虽然沉重，也让后续责任讨论更加真实。", "joint", "根本选择不相容时接受诚实面对不匹配", [s("children", "incompatibility-aware", 3), s("integrity", "accept-reality", 2)], "郑重"),
      ],
    },
    {
      id: "parent-care", kind: "choice", title: "父母老去以后", pressure: "high", recordsEvidence: true,
      narration: "一方父母未来可能需要长期照护。时间、金钱和是否同住，都会改变两个人的日常。",
      prompt: "你最期待伴侣采取哪种态度？", nextStageId: "ordinary-decade",
      choices: [
        c("together", "把照护当作共同家庭议题，一起规划可承担的范围。", "你希望伴侣不旁观，也不让任何一方独自吞下责任。讨论终于走向更普通的漫长生活。", "partner", "期待伴侣共同规划双方父母照护", [s("familyCare", "shared-planning", 3), s("responsibility", "family", 2)], "有依靠"),
        c("primary", "尊重子女承担主要责任，但伴侣提供稳定支持和边界协商。", "亲缘责任与伴侣支持各有位置。你们开始想象十年后的日常是否仍能相互照顾。", "partner", "期待伴侣支持主要照护者并共同维护边界", [s("familyCare", "supported-primary", 3), s("boundary", "negotiated", 2)], "被支持"),
        c("professional", "优先整合专业照护与家庭资源，避免只靠伴侣牺牲。", "照护不再等同于无止境自我消耗。资源规划之后，你们把目光放到更长的普通岁月。", "partner", "期待伴侣主动整合专业与家庭照护资源", [s("familyCare", "resource-integrated", 3), s("sustainability", "care", 2)], "安心"),
      ],
    },
    {
      id: "ordinary-decade", kind: "choice", title: "十年后的普通一天", pressure: "medium", recordsEvidence: true,
      narration: "没有庆典，也没有危机。只是一个忙碌的工作日，晚饭、家务和沉默构成了大多数长期关系。",
      prompt: "你最希望自己怎样守住这段普通生活？", nextStageId: "complete",
      choices: [
        c("ritual", "保留稳定的小仪式，主动让彼此知道关系仍被珍惜。", "你选择用持续的小动作对抗习以为常。远处雾中的心愿岛亮起，像是在回应一路留下的选择。", "self", "长期关系中倾向用稳定仪式维持连接", [s("longTermLove", "ritual", 3), s("affection", "consistent", 2)], "温暖"),
        c("check-in", "定期谈需求和变化，不等问题积累成疏远。", "你愿意持续更新对彼此的理解。心愿岛的雾缓缓散开，邀请你去看清真正向往的人。", "self", "长期关系中倾向定期沟通并更新规则", [s("longTermLove", "check-in", 3), s("communication", "continuous", 2)], "被理解"),
        c("grow", "支持彼此保留成长空间，再不断创造新的共同经历。", "独立与共同成长并不矛盾。通往心愿岛的水路显现，雾后藏着你一路勾勒出的答案。", "self", "长期关系中倾向兼顾个人成长与共同经历", [s("longTermLove", "shared-growth", 3), s("autonomy", "connected", 2)], "有生命力"),
      ],
    },
    { id: "complete", kind: "complete", title: "把未来说到日常里", narration: "你们没有许下永远不会变化的答案，却学会了把重大选择、不可调和之处和普通生活都认真说清。最后一座岛正在雾后等待。", prompt: "", recordsEvidence: false, nextStageId: null, choices: [] },
  ]),
});
