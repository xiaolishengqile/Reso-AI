import { createChoice } from "../story/story.js";

const s = (dimension, value, weight = 1) => ({ dimension, value, weight });
const c = (id, text, feedback, target, summary, signals, companionMood) => (
  createChoice(id, text, feedback, { target, summary, signals, companionMood })
);

export const travelStory = Object.freeze({
  id: "travel",
  title: "旅行岛",
  unlockOrder: 7,
  unlocksOrder: 8,
  initialStageId: "trip-plan",
  theme: Object.freeze({ sky: "#8eb7c8", ground: "#d1a66d", accent: "#f4d98b", prop: "travel" }),
  contextTags: Object.freeze(["旅行", "意外", "同行节奏"]),
  stages: Object.freeze([
    {
      id: "trip-plan", kind: "choice", title: "出发前的清单", pressure: "low", recordsEvidence: true,
      narration: "朋友送来的车票把期待变成了真实行程。一个人想把路线排满，另一个人只想留些随性空间。",
      prompt: "这趟旅行怎样规划更合适？", nextStageId: "missed-transport",
      choices: [
        c("detailed", "提前确认交通和重点安排，其余时间再自由活动。", "关键行程被固定下来。你们安心出发，却在转车站遇上了意料之外的延误。", "joint", "旅行中偏好先确定关键计划再保留弹性", [s("travelPlanning", "key-points", 3), s("flexibility", "bounded", 2)], "踏实"),
        c("spontaneous", "只订住宿和往返，到了当地再一起决定。", "未知带来新鲜感，也要求双方随时协商。第一段交通延误后，衔接的班次变得紧张。", "joint", "旅行中偏好保留较高的即兴空间", [s("travelPlanning", "spontaneous", 3), s("uncertainty", "comfortable", 2)], "期待"),
        c("split", "各自列出必去项目，再轮流安排每天的行程。", "双方期待都被放进路线。轮到第一天的计划时，延误让原定交通没能赶上。", "joint", "旅行中偏好轮流主导并兼顾双方期待", [s("travelPlanning", "turn-taking", 3), s("fairness", "balanced", 2)], "被尊重"),
      ],
    },
    {
      id: "missed-transport", kind: "choice", title: "错过的班次", pressure: "medium", recordsEvidence: true,
      narration: "你们赶到站台时，车已经离开。新的车票更贵，原定行程也会被打乱。",
      prompt: "错过交通后，你最先会怎么做？", nextStageId: "lost-route",
      choices: [
        c("solve", "先查替代路线和费用，把损失控制住再谈情绪。", "你迅速找到下一班车。现实问题缓解后，双方才注意到刚才语气里的急躁。", "self", "意外发生时倾向先处理现实问题", [s("travelConflict", "solve-first", 3), s("stressResponse", "practical", 2)], "安定"),
        c("repair", "先承认彼此都很烦躁，约定不在慌乱中互相责怪。", "你们先站回同一边，再共同寻找路线。换乘之后，陌生街区的路标又让人犯难。", "self", "意外发生时倾向先稳定关系再解决问题", [s("travelConflict", "repair-first", 3), s("communication", "non-blaming", 2)], "被接住"),
        c("pause", "先离开拥挤站台休息几分钟，再重新决定。", "短暂停顿阻止了情绪升级。重新出发时，你们选择了一条不熟悉的步行路线。", "self", "高压意外中倾向暂停后再做决定", [s("travelConflict", "pause", 3), s("stressResponse", "cool-down", 2)], "放松"),
      ],
    },
    {
      id: "lost-route", kind: "choice", title: "走错的路", pressure: "medium", recordsEvidence: true,
      narration: "导航信号断断续续。一个人确信该继续向前，另一个人认为应该原路返回。",
      prompt: "意见相反时，你们采用什么规则？", nextStageId: "fatigue-support",
      choices: [
        c("verify", "一起找路标或询问当地人，用新信息再决定。", "争论变成了共同验证。找到正确方向后，长距离步行也让疲惫逐渐显现。", "joint", "分歧时偏好共同查证后再决定", [s("decision", "evidence-based", 3), s("teamwork", "verify-together", 2)], "信服"),
        c("lead", "让更熟悉路线的一方先带路，走一段后再复核。", "你们暂时交出决定权，也保留了复核点。赶到目的地时，带路的一方已经很累。", "joint", "分歧时接受阶段授权并设置复核点", [s("decision", "delegated", 3), s("trust", "reviewable", 2)], "被信任"),
        c("backtrack", "回到最后一个确定的位置，宁可慢一点也减少不确定。", "共同退回没有变成谁输谁赢。重新找到路后，你们都需要处理累积的疲惫。", "joint", "分歧时偏好回到确定状态再行动", [s("decision", "certainty-first", 3), s("risk", "cautious", 2)], "安心"),
      ],
    },
    {
      id: "fatigue-support", kind: "choice", title: "走不动的时候", pressure: "low", recordsEvidence: true,
      narration: "抵达景点前，{companion}已经明显疲惫，但门票有固定入场时间。",
      prompt: "你最希望伴侣怎样回应这种状态？", nextStageId: "photo-rhythm",
      choices: [
        c("rest", "主动提议休息，不让我为拖慢行程感到内疚。", "休息让身体重新跟上，也让你确认被照顾并不等于扫兴。景色出现时，拍照节奏又不一样。", "partner", "疲惫时期待伴侣主动允许休息", [s("travelSupport", "rest-without-guilt", 3), s("empathy", "physical", 2)], "被照顾"),
        c("options", "一起说明代价，让我选择休息、放弃或继续。", "现实信息和选择权都被保留。你做完决定后，双方开始讨论接下来要不要停下来拍照。", "partner", "疲惫时期待伴侣提供信息并尊重选择", [s("travelSupport", "choice", 3), s("autonomy", "informed", 2)], "被尊重"),
        c("encourage", "温和鼓励我完成这一段，同时承诺之后充分休息。", "鼓励帮助你抵达目的地，之后的休息承诺也被兑现。你们拿出相机，新的节奏差异随之出现。", "partner", "疲惫时期待伴侣温和鼓励并兑现休息", [s("travelSupport", "encouragement", 3), s("reliability", "aftercare", 2)], "有力量"),
      ],
    },
    {
      id: "photo-rhythm", kind: "choice", title: "留住还是路过", pressure: "low", recordsEvidence: true,
      narration: "一方想反复调整角度记录旅程，另一方更想放下设备好好看风景。",
      prompt: "怎样形成双方都能执行的拍照规则？", nextStageId: "travel-repair",
      choices: [
        c("timebox", "每个地点留出固定拍照时间，结束后就专心体验。", "明确时间让记录与在场都有位置。返程时，你们开始复盘这一路的摩擦。", "joint", "旅行记录偏好设置明确时间边界", [s("memoryStyle", "timeboxed-photo", 3), s("presence", "balanced", 2)], "平衡"),
        c("few", "先拍几张双方都满意的合照，其余随手记录。", "少量共同成果降低了反复等待。收起相机后，双方更愿意谈刚才哪些时刻受了委屈。", "joint", "旅行记录偏好少量高质量共同照片", [s("memoryStyle", "few-shared", 3), s("efficiency", "concise", 2)], "轻松"),
        c("separate", "想拍的人可以多拍，另一方不必一直陪同等待。", "不同兴趣被允许并存。短暂分开后重新会合，你们决定把旅途中没说开的感受谈完。", "joint", "旅行记录中接受双方采用不同节奏", [s("memoryStyle", "independent", 3), s("autonomy", "travel", 2)], "自在"),
      ],
    },
    {
      id: "travel-repair", kind: "choice", title: "把摩擦带回家吗", pressure: "high", recordsEvidence: true,
      narration: "返程前，你们都知道问题不只是哪条路线或哪张照片，而是压力下怎样对待彼此。",
      prompt: "你会怎样完成这次旅行后的修复？", nextStageId: "complete",
      choices: [
        c("apology", "先为自己具体伤人的行为道歉，再听对方的感受。", "具体道歉让防备降下来。谈着谈着，你们望向城市灯光，开始想象未来会在哪里生活。", "self", "冲突后倾向先为具体行为负责", [s("repair", "specific-apology", 3), s("accountability", "self-first", 2)], "被理解"),
        c("review", "一起复盘触发点，并为下一次旅行约定新规则。", "经验被变成可执行的共同办法。列完规则，你们顺势谈到未来城市和长期生活的选择。", "self", "冲突后倾向共同复盘并更新规则", [s("repair", "joint-review", 3), s("learning", "iterative", 2)], "有希望"),
        c("reconnect", "先做一件让双方重新靠近的小事，稳定后再深谈。", "你们用一段安静散步恢复连接。回到城市的路上，更长远的未来话题自然浮现。", "self", "冲突后倾向先恢复连接再深入讨论", [s("repair", "reconnect-first", 3), s("closeness", "restorative", 2)], "温暖"),
      ],
    },
    { id: "complete", kind: "complete", title: "一起看过的远方", narration: "旅程没有因为意外失去意义。你们带回来的不只是照片，还有一套面对变化的共同语言。城市轮廓正从远处升起。", prompt: "", recordsEvidence: false, nextStageId: null, choices: [] },
  ]),
});
