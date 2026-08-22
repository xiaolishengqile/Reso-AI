import { createChoice } from "../story/story.js";

const s = (dimension, value, weight = 1) => ({ dimension, value, weight });
const c = (id, text, feedback, target, summary, signals, companionMood) => (
  createChoice(id, text, feedback, { target, summary, signals, companionMood })
);

export const cohabitationStory = Object.freeze({
  id: "cohabitation", title: "同居岛", unlockOrder: 4, unlocksOrder: 5, initialStageId: "shared-space",
  theme: Object.freeze({ sky: "#bdafa1", ground: "#665b55", accent: "#f2d1a2", prop: "home" }),
  contextTags: Object.freeze(["共同生活", "家务", "个人空间"]),
  stages: Object.freeze([
    {
      id: "shared-space", kind: "choice", title: "半个衣柜", pressure: "low", recordsEvidence: true,
      narration: "试住的第一晚，{companion}把常用物品放进了你一直独占的柜子。",
      prompt: "共享空间怎样划分更舒服？", nextStageId: "cleaning-standard",
      choices: [
        c("zones", "明确分出个人区域和共享区域。", "清楚的区域让双方都能安放自己，也让不同整理习惯很快显现。", "joint", "偏好用明确区域保护个人空间", [s("homeBoundary", "defined-zones", 3), s("autonomy", "private-space", 2)], "安心"),
        c("rearrange", "一起重新整理，让空间适合两个人而不是简单对半。", "你们边整理边发现，对“已经很干净”的理解完全不同。", "joint", "偏好围绕共同生活重新设计空间", [s("homeBoundary", "shared-design", 3), s("cooperation", "hands-on", 2)], "投入"),
        c("flexible", "先自然混用一周，再根据真正的不便调整。", "试用减少了提前争论，却也让清洁标准差异在几天后集中出现。", "joint", "偏好先体验再形成生活边界", [s("homeBoundary", "adaptive", 3), s("planning", "trial", 2)], "轻松"),
      ],
    },
    {
      id: "cleaning-standard", kind: "choice", title: "什么算干净", pressure: "medium", recordsEvidence: true,
      narration: "一人已经收拾完，另一人却仍觉得不能放松。标准差异比家务数量更难说清。",
      prompt: "你们采用哪种共同标准？", nextStageId: "mental-load",
      choices: [
        c("higher", "共同区域采用要求更高的一方标准。", "高标准带来整洁，也让谁来维护变成必须讨论的问题。", "joint", "共同区域倾向采用更高生活标准", [s("cleaning", "higher-standard", 2), s("order", "structured", 2)], "认真"),
        c("minimum", "约定双方都能长期做到的最低共同标准。", "可持续的底线减少争执，却仍需要有人发现和安排任务。", "joint", "偏好可持续的最低共同生活标准", [s("cleaning", "minimum-shared", 3), s("flexibility", "practical", 2)], "放松"),
        c("ownership", "各自负责最在意的区域，公共部分轮换。", "责任归属变清楚。几天后，你们发现提醒和记住任务本身也很耗精力。", "joint", "偏好按关注点分区负责并轮换公共事务", [s("cleaning", "ownership", 3), s("fairness", "task-based", 2)], "有方向"),
      ],
    },
    {
      id: "mental-load", kind: "choice", title: "总要提醒的人", pressure: "medium", recordsEvidence: true,
      narration: "同一件家务又被忘记。{companion}说，真正累的是总要发现、记住和提醒。",
      prompt: "你会怎样回应？", nextStageId: "alone-time",
      choices: [
        c("redistribute", "承认提醒也是劳动，重新分配完整事务。", "你接手了从发现到收尾的一整块责任，也更理解对方下班后的疲惫。", "self", "能把发现和安排纳入责任分配", [s("mentalLoad", "recognized", 3), s("accountability", "full-ownership", 2)], "被理解"),
        c("system", "一起做一个清单和固定周期，减少靠人提醒。", "系统降低了反复催促，但执行仍需要双方主动。你们开始讨论下班后的恢复方式。", "self", "倾向用可见系统减少提醒负担", [s("mentalLoad", "system", 3), s("planning", "routine", 2)], "踏实"),
        c("cause", "先谈清楚为什么总没做到，是精力、标准还是分工问题。", "原因被拆开后，争论不再只剩责备，也带出你想独处恢复的真实需要。", "self", "倾向先理解重复失误的原因再调整", [s("mentalLoad", "root-cause", 3), s("communication", "exploratory", 2)], "缓和"),
      ],
    },
    {
      id: "alone-time", kind: "choice", title: "关门以后", pressure: "low", recordsEvidence: true,
      narration: "忙碌一天后，你只想暂时不说话。{companion}站在门外，不确定靠近还是离开。",
      prompt: "你最希望对方怎样做？", nextStageId: "sleep-rhythm",
      choices: [
        c("comfort", "先抱抱我，让我知道关系是安全的，再给我空间。", "短暂的靠近让你安心。夜深后，双方不同的睡眠节奏又出现了。", "partner", "独处前期待先获得简短的亲密确认", [s("aloneTime", "comfort-then-space", 3), s("closeness", "reassurance", 2)], "安心"),
        c("space", "安静留出空间，等我主动出来。", "{companion}没有追问。恢复精力后，你主动走出房间讨论睡眠安排。", "partner", "疲惫时期待伴侣尊重独处和恢复节奏", [s("aloneTime", "uninterrupted-space", 3), s("autonomy", "self-return", 2)], "放松"),
        c("ask", "先问我需要陪伴还是空间，不要替我猜。", "确认避免了误解。你也更愿意说清今晚希望怎样休息。", "partner", "期待伴侣先确认需求再决定靠近程度", [s("aloneTime", "ask-first", 3), s("communication", "needs-check", 2)], "被尊重"),
      ],
    },
    {
      id: "sleep-rhythm", kind: "choice", title: "不同的夜晚", pressure: "medium", recordsEvidence: true,
      narration: "一个人早睡，一个人夜里仍要活动。声音和光线开始影响第二天状态。",
      prompt: "哪种长期安排更可接受？", nextStageId: "broken-appliance",
      choices: [
        c("align", "尽量调整到共同作息，保留睡前相处。", "共同节奏增加了连接，也需要作息更自由的一方持续调整。随后洗衣机突然停转。", "joint", "偏好通过共同作息维持日常连接", [s("sleep", "aligned", 3), s("closeness", "daily-routine", 2)], "亲近"),
        c("separate", "做好隔音和分区，必要时允许分开睡。", "睡眠质量得到保护，亲密不再由同床证明。第二天，分区里的洗衣机坏了。", "joint", "接受用空间分离保护睡眠质量", [s("sleep", "separate-compatible", 3), s("autonomy", "rest", 2)], "自在"),
        c("schedule", "工作日照顾睡眠，休息日保留更自由的节奏。", "不同日期有了不同规则。周末刚开始，家里的洗衣机却彻底坏了。", "joint", "偏好按生活场景切换作息规则", [s("sleep", "contextual", 3), s("flexibility", "calendar-based", 2)], "平衡"),
      ],
    },
    {
      id: "broken-appliance", kind: "choice", title: "谁来处理", pressure: "medium", recordsEvidence: true,
      narration: "洗衣机漏了一地水。两个人都很累，也都下意识觉得对方应该处理。",
      prompt: "你怎样把僵局变成合作？", nextStageId: "complete",
      choices: [
        c("skills", "按擅长能力分工：一人联系维修，一人清理和比价。", "你们很快止住漏水，并开始比较维修和购买费用，下一座岛的问题已经出现。", "self", "突发家务中倾向按能力快速分工", [s("household", "skill-based", 3), s("repair", "practical", 2)], "有默契"),
        c("rotate", "这次由我完整负责，下次同类事务由对方承担。", "责任没有被拆成零碎帮忙。维修报价送来后，你们需要认真讨论这笔费用。", "self", "倾向轮流承担完整生活事务", [s("household", "rotating-owner", 3), s("fairness", "turn-taking", 2)], "被支持"),
        c("together", "先一起处理现场，再共同记录时间和购买成本。", "共同完成让双方都看见这件事的全部成本，也自然进入下一场金钱讨论。", "self", "倾向共同处理并让隐形成本可见", [s("household", "together", 3), s("mentalLoad", "visible-cost", 2)], "靠近"),
      ],
    },
    { id: "complete", kind: "complete", title: "共同生活不是默认设置", narration: "空间、家务和休息终于有了可以调整的规则。维修单留在桌上，下一次对话将关于钱。", prompt: "", recordsEvidence: false, nextStageId: null, choices: [] },
  ]),
});
