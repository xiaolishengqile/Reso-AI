import { createChoice } from "../story/story.js";

const s = (dimension, value, weight = 1) => ({ dimension, value, weight });
const c = (id, text, feedback, target, summary, signals, companionMood) => (
  createChoice(id, text, feedback, { target, summary, signals, companionMood })
);

export const officeStory = Object.freeze({
  id: "office",
  title: "工作岛",
  unlockOrder: 2,
  unlocksOrder: 3,
  initialStageId: "overtime",
  theme: Object.freeze({ sky: "#92b8c1", ground: "#4f6669", accent: "#efc77f", prop: "office" }),
  contextTags: Object.freeze(["工作", "时间冲突", "事业边界"]),
  stages: Object.freeze([
    {
      id: "overtime", kind: "choice", title: "临时加班", pressure: "medium", recordsEvidence: true,
      narration: "爬山归来后的第一个工作日，你和{companion}约好晚上见面。下班前，项目突然出了问题。",
      prompt: "同事都在等决定，而约会时间已经临近，你先怎么做？", nextStageId: "partner-reply",
      choices: [
        c("leave", "按原计划离开，先把能交接的工作说明清楚。", "你完成交接后按时出现。{companion}松了口气，也问起留下收尾的同事。", "self", "承诺明确时倾向按约陪伴并做好交接", [s("priority", "relationship-commitment", 2), s("responsibility", "handover", 1)], "安心"),
        c("stay", "留下处理问题，同时尽早告诉{companion}原因和预计时间。", "你发去清楚的说明。{companion}虽然失落，却不用在未知中一直等待。", "self", "现实责任冲突时倾向透明说明并完成工作", [s("priority", "work-responsibility", 2), s("communication", "transparent", 2)], "失落"),
        c("negotiate", "先和{companion}通话，一起把今晚改成双方都能接受的安排。", "你们把见面改成楼下短聚。协商减少了落空感，也让对方认真回复了自己的感受。", "self", "时间冲突时倾向共同协商替代方案", [s("communication", "collaborative", 2), s("flexibility", "adaptive", 2)], "被重视"),
      ],
    },
    {
      id: "partner-reply", kind: "choice", title: "屏幕另一端", pressure: "low", recordsEvidence: true,
      narration: "消息发出后，输入提示亮了又暗。你知道{companion}也在调整原本的期待。",
      prompt: "此刻你最希望收到哪一种回应？", nextStageId: "work-messages",
      choices: [
        c("understand", "“我理解你要负责，忙完告诉我就好。”", "这份理解让你安心工作。深夜见面时，你却发现自己仍习惯随时看工作消息。", "partner", "期待伴侣理解阶段性的工作责任", [s("partnerSupport", "understanding", 2), s("autonomy", "trust", 1)], "理解"),
        c("honest", "“我会失落，但我们一起换个时间吧。”", "对方没有隐藏情绪，也愿意协商。你更想尽快结束工作，真正回到关系里。", "partner", "期待伴侣坦诚表达感受并参与协商", [s("partnerSupport", "honest-collaboration", 3), s("communication", "direct", 1)], "坦诚"),
        c("commitment", "“今晚对我很重要，我希望你尽量兑现约定。”", "明确的需要让你重新衡量优先级。见面后，工作群的提示音再次打断了你们。", "partner", "期待伴侣明确表达陪伴的重要性", [s("partnerSupport", "clear-need", 2), s("closeness", "high-presence", 2)], "认真"),
      ],
    },
    {
      id: "work-messages", kind: "choice", title: "迟到的在场", pressure: "medium", recordsEvidence: true,
      narration: "你们终于坐到一起，工作群却连续弹出消息。{companion}停下了刚说到一半的话。",
      prompt: "你准备怎样处理这些消息？", nextStageId: "support-style",
      choices: [
        c("silence", "把手机静音，告诉同事明早再继续。", "你把注意力留在眼前。{companion}重新说起今天的事，也问你是不是已经累坏了。", "self", "相处时间里倾向建立清晰的工作边界", [s("presence", "focused", 3), s("workBoundary", "firm", 2)], "被重视"),
        c("urgent", "说明情况，只处理最紧急的一条后就收起手机。", "你用几分钟完成收尾，再把手机翻面。现实责任被处理，谈话也没有彻底中断。", "self", "倾向兼顾紧急责任和关系在场", [s("presence", "balanced", 2), s("workBoundary", "selective", 2)], "理解"),
        c("online", "保持在线，但把今晚的见面缩短一些。", "你仍在两个场景间切换。{companion}没有争吵，只问你今天真正需要的是倾听还是办法。", "self", "高工作压力时倾向维持持续在线", [s("presence", "divided", 2), s("workBoundary", "porous", 2)], "疏离"),
      ],
    },
    {
      id: "support-style", kind: "choice", title: "怎样接住疲惫", pressure: "low", recordsEvidence: true,
      narration: "你说起今天的混乱，却发现自己也不确定是想被理解，还是想尽快解决问题。",
      prompt: "你最希望{companion}怎样回应？", nextStageId: "coworker-boundary",
      choices: [
        c("listen", "先听我说完，告诉我这种累和委屈很正常。", "{companion}没有急着分析。你慢慢放松，也愿意说起最近总和某位同事深夜协作的情况。", "partner", "压力后期待先得到倾听和情绪确认", [s("emotionalSupport", "empathy", 3), s("communication", "listening", 2)], "被理解"),
        c("solve", "和我一起梳理问题，看看明天能具体改变什么。", "你们在纸上列出边界和优先级，其中一项正是深夜协作应如何处理。", "partner", "压力后期待伴侣共同分析可执行办法", [s("emotionalSupport", "problem-solving", 3), s("communication", "practical", 2)], "有方向"),
        c("space", "先让我安静一会儿，等我缓过来再来抱抱我。", "{companion}给你留出空间，稍后才轻声确认状态。冷静下来后，你主动谈起工作交往边界。", "partner", "压力后期待先获得空间再重新连接", [s("emotionalSupport", "space", 3), s("autonomy", "recovery-time", 2)], "放松"),
      ],
    },
    {
      id: "coworker-boundary", kind: "choice", title: "深夜协作", pressure: "medium", recordsEvidence: true,
      narration: "你们谈到那位经常深夜联系的同事。问题不在于猜忌，而在于双方都适用的边界是什么。",
      prompt: "哪一种共同规则更让你安心？", nextStageId: "relocation",
      choices: [
        c("transparent", "重要协作主动说明，彼此都不隐藏长期的深夜联系。", "透明让讨论回到事实。{companion}也承诺按同样规则处理自己的工作关系。", "joint", "希望双方对高频越界时段保持透明", [s("socialBoundary", "transparent", 3), s("trust", "informed", 2)], "安心"),
        c("trust", "不逐条报备，但任何不舒服都可以直接提出。", "你们保留各自空间，也约定不把疑问憋成猜测。话题随后转向一封新的工作邮件。", "joint", "希望以信任为主并保留直接质疑的通道", [s("socialBoundary", "trust-based", 3), s("autonomy", "private", 2)], "平静"),
        c("adjust", "尽量把深夜协作改到公开时段，双方都执行同一标准。", "共同调整降低了模糊空间。就在这时，一封异地晋升邀请出现在屏幕上。", "joint", "希望通过调整行为减少边界不确定性", [s("socialBoundary", "behavioral", 3), s("security", "predictable", 2)], "踏实"),
      ],
    },
    {
      id: "relocation", kind: "choice", title: "异地机会", pressure: "high", recordsEvidence: true,
      narration: "晋升意味着更好的发展，也意味着至少一年异地。你们都知道这不是一句“支持你”就能解决的事。",
      prompt: "你更愿意采用哪一种共同决定？", nextStageId: "complete",
      choices: [
        c("career", "先抓住机会，再一起设计异地见面和结束期限。", "你们开始计算交通和时间成本，并约好今晚用一顿晚餐把细节说完。", "joint", "重大机会出现时接受阶段异地并要求清晰计划", [s("career", "opportunity-first", 3), s("planning", "long-distance-plan", 2)], "郑重"),
        c("together", "优先维持共同生活，再寻找本地或远程的成长路径。", "你们决定不把陪伴当作默认牺牲，并约好去吃饭时继续讨论替代机会。", "joint", "重大机会出现时优先共同生活的连续性", [s("career", "shared-life-first", 3), s("stability", "together", 2)], "安心"),
        c("trial", "先试行三个月，设好复盘点后再决定是否长期异地。", "试行给双方留下真实观察的空间。你们收起电脑，去完成那顿一再推迟的晚餐。", "joint", "重大决定前偏好有期限的共同试行", [s("career", "trial", 3), s("flexibility", "reviewable", 2)], "有希望"),
      ],
    },
    { id: "complete", kind: "complete", title: "下班之后", narration: "工作仍会继续，但你们第一次把时间、支持和边界说成了共同规则。街角的餐厅还亮着灯。", prompt: "", recordsEvidence: false, nextStageId: null, choices: [] },
  ]),
});
