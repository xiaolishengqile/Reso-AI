import { createChoice } from "../story/story.js";

const s = (dimension, value, weight = 1) => ({ dimension, value, weight });
const c = (id, text, feedback, target, summary, signals, companionMood) => (
  createChoice(id, text, feedback, { target, summary, signals, companionMood })
);

export const socialStory = Object.freeze({
  id: "social", title: "社交岛", unlockOrder: 6, unlocksOrder: 7, initialStageId: "leave-party",
  theme: Object.freeze({ sky: "#ad8eb2", ground: "#514f66", accent: "#f1b6c5", prop: "social" }),
  contextTags: Object.freeze(["朋友", "家庭", "社交边界"]),
  stages: Object.freeze([
    {
      id: "leave-party", kind: "choice", title: "有人想走", pressure: "low", recordsEvidence: true,
      narration: "聚会刚热闹起来，你们却出现不同状态：一人已经疲惫，另一人正在投入聊天。",
      prompt: "你们怎样安排离开？", nextStageId: "attention-at-party",
      choices: [
        c("together", "一起离开，优先保持共同节奏。", "你们并肩走出人群，留下的一方有些遗憾，也更在意聚会中是否一直被照顾。", "joint", "社交活动中偏好共同进退", [s("socialEnergy", "leave-together", 3), s("closeness", "shared-rhythm", 2)], "安心"),
        c("separate", "疲惫的一方先回去，另一方结束后自行回家。", "各自节奏得到尊重。分开后，消息多久回复又成了新的安全感问题。", "joint", "接受情侣在社交中分别行动", [s("socialEnergy", "independent-exit", 3), s("autonomy", "social", 2)], "自在"),
        c("timebox", "约定一个明确时间，再一起离开。", "等待有了边界。剩下的时间里，谁来主动确认状态变得很具体。", "joint", "偏好用明确时间兼顾双方社交状态", [s("socialEnergy", "timeboxed", 3), s("planning", "social", 2)], "平衡"),
      ],
    },
    {
      id: "attention-at-party", kind: "choice", title: "在人群里被看见", pressure: "low", recordsEvidence: true,
      narration: "{companion}和朋友聊得投入，你在陌生人之间有些无所适从。",
      prompt: "你最希望对方怎样照顾你？", nextStageId: "friend-boundary",
      choices: [
        c("check", "隔一会儿来确认我的状态，让我知道没有被忘记。", "几次眼神和短暂靠近让你安稳，也让你注意到{companion}与一位异性朋友很熟悉。", "partner", "陌生社交中期待伴侣主动确认状态", [s("socialSupport", "periodic-check", 3), s("security", "remembered", 2)], "被重视"),
        c("introduce", "先认真介绍朋友，之后允许我们各自社交。", "有了关系入口，你更容易独立行动，也能自然观察对方的朋友边界。", "partner", "期待伴侣先建立连接再各自社交", [s("socialSupport", "introduce-then-free", 3), s("autonomy", "social", 2)], "融入"),
        c("available", "不用一直陪着，只要我需要时愿意过来支持。", "可获得的支持比持续陪伴更重要。稍后，你决定提出刚才看到的边界感受。", "partner", "期待伴侣保持可获得而不过度照看", [s("socialSupport", "available", 3), s("autonomy", "supported", 2)], "自在"),
      ],
    },
    {
      id: "friend-boundary", kind: "choice", title: "熟悉的异性朋友", pressure: "medium", recordsEvidence: true,
      narration: "对方的互动没有明确越界，却让你不舒服。真正的问题是怎样表达，而不是谁先被判错。",
      prompt: "你会怎么说？", nextStageId: "photo-privacy",
      choices: [
        c("specific", "直接说出让我不舒服的具体行为和希望调整的边界。", "具体表达避免了泛化指责。谈话结束时，朋友提议发一张你们的合照。", "self", "不安时倾向表达具体边界和请求", [s("jealousy", "specific-request", 3), s("communication", "direct", 2)], "理解"),
        c("later", "先观察现场，回家后在安静状态下再谈。", "你保留了判断时间，也需要承担暂时的不确定。此时合照公开问题来到面前。", "self", "不安时倾向延后到安全环境沟通", [s("jealousy", "private-later", 3), s("communication", "delayed", 2)], "等待"),
        c("initiative", "说明我希望伴侣主动避开容易模糊的互动。", "你说清了对主动边界的期待。{companion}随后先询问你是否愿意公开合照。", "self", "期待伴侣主动维护关系边界", [s("jealousy", "partner-initiative", 3), s("security", "proactive", 2)], "郑重"),
      ],
    },
    {
      id: "photo-privacy", kind: "choice", title: "要不要公开", pressure: "medium", recordsEvidence: true,
      narration: "一方想发布合照表达关系，另一方不喜欢把私人生活放到网络上。",
      prompt: "采用什么共同规则？", nextStageId: "family-criticism",
      choices: [
        c("cautious", "尊重更谨慎的一方，公开必须双方同意。", "隐私得到保护。照片没发出去，却在家人群里引来关于关系的评论。", "joint", "关系公开遵循双方同意和更谨慎边界", [s("privacy", "mutual-consent", 3), s("publicCommitment", "private", 2)], "安心"),
        c("limited", "限定可见范围和内容，保留适度分享。", "你们找到中间范围。有限公开仍让一位家人注意到并当众评价{companion}。", "joint", "偏好限定范围的关系公开", [s("privacy", "limited-sharing", 3), s("publicCommitment", "selective", 2)], "平衡"),
        c("ask", "各自保留发布自主，但涉及对方前必须先问。", "自主与肖像边界同时保留。随后，家人的评价让你必须决定怎样站在伴侣身边。", "joint", "保留个人表达但要求涉及伴侣时先确认", [s("privacy", "ask-before-post", 3), s("autonomy", "online", 2)], "被尊重"),
      ],
    },
    {
      id: "family-criticism", kind: "choice", title: "家人的评价", pressure: "high", recordsEvidence: true,
      narration: "家人当众说了让{companion}难堪的话。现场有亲友，也有多年形成的家庭关系。",
      prompt: "你会怎样处理？", nextStageId: "network-expectation",
      choices: [
        c("public", "当场明确否定不尊重的评价，先保护伴侣。", "边界立即被看见，现场也短暂僵住。回程中，你们讨论以后与双方家庭相处多近。", "self", "公开伤害发生时倾向立即维护伴侣", [s("familyBoundary", "public-defense", 3), s("loyalty", "visible", 2)], "被保护"),
        c("deescalate", "先结束现场冲突，再私下和家人严肃处理。", "场面没有升级，但{companion}需要确认你之后真的会行动。你们开始谈关键时刻的参与规则。", "self", "家庭冲突中倾向先降温再私下设界", [s("familyBoundary", "private-followup", 3), s("conflict", "deescalate", 2)], "谨慎"),
        c("support", "让{companion}按自己的方式回应，我在旁明确支持。", "对方保留了声音，你也没有退场。回家路上，双方谈起希望彼此如何参与亲友网络。", "self", "倾向支持伴侣自主回应并明确站队", [s("familyBoundary", "supported-agency", 3), s("autonomy", "voice", 2)], "有力量"),
      ],
    },
    {
      id: "network-expectation", kind: "choice", title: "进入彼此的生活圈", pressure: "medium", recordsEvidence: true,
      narration: "聚会结束了。你们都在想，伴侣究竟应该多深地进入自己的朋友和家庭。",
      prompt: "你最期待哪种参与方式？", nextStageId: "complete",
      choices: [
        c("integrate", "愿意主动认识重要的人，逐渐融入彼此生活圈。", "你期待共享网络带来的归属感。朋友听后送来一份双人旅行攻略，邀请你们出发。", "partner", "期待伴侣主动融入重要亲友网络", [s("network", "integrated", 3), s("closeness", "social", 2)], "温暖"),
        c("polite", "保持礼貌和适度距离，不强求变成同一个圈子。", "差异被允许存在。朋友笑着递来两张旅行车票，让你们去拥有自己的共同经历。", "partner", "期待伴侣礼貌参与但保留社交距离", [s("network", "polite-distance", 3), s("autonomy", "separate-network", 2)], "自在"),
        c("key-moments", "平时尊重各自网络，关键时刻愿意出现和支持。", "关键参与比高频融入更重要。你们接过朋友准备的旅行路线，下一段旅程即将开始。", "partner", "期待伴侣在关键时刻参与亲友关系", [s("network", "key-moments", 3), s("support", "reliable", 2)], "安心"),
      ],
    },
    { id: "complete", kind: "complete", title: "两个人与更大的世界", narration: "你们没有把爱变成封闭的小岛，也开始理解怎样进入彼此原本的人生。两张车票在掌心展开。", prompt: "", recordsEvidence: false, nextStageId: null, choices: [] },
  ]),
});
