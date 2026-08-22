import test from "node:test";
import assert from "node:assert/strict";
import {
  getMountainEntryMedia,
  getMountainStageMedia,
  validateMountainMedia,
} from "../src/scenes/mountain/media.js";
import { MOUNTAIN_STAGES } from "../src/scenes/mountain/story.js";

test("入口使用大山图片且咖啡馆连续播放三段视频", () => {
  assert.deepEqual(getMountainEntryMedia(), {
    type: "image",
    sources: ["./assets/mountain/mountain-entry.png"],
    alt: "云雾笼罩的星空谷山脉入口",
  });
  assert.deepEqual(getMountainStageMedia("invitation"), {
    type: "video",
    sources: [
      "./assets/mountain/scene-1-1.mp4",
      "./assets/mountain/scene-1-3.mp4",
      "./assets/mountain/scene-1-4.mp4",
    ],
    alt: "咖啡馆里的周末邀约",
  });
});

test("攀登阶段逐一映射视频且缺失视频阶段使用图片", () => {
  assert.equal(getMountainStageMedia("fatigue").sources[0], "./assets/mountain/scene-2.mp4");
  assert.equal(getMountainStageMedia("slip").sources[0], "./assets/mountain/scene-3.mp4");
  assert.equal(getMountainStageMedia("storm-thought").sources[0], "./assets/mountain/scene-4.mp4");
  assert.equal(getMountainStageMedia("cave-repair").sources[0], "./assets/mountain/scene-5.mp4");
  assert.deepEqual(getMountainStageMedia("home-message"), {
    type: "image",
    sources: ["./assets/mountain/home-message.png"],
    alt: "暴雨旅程结束后的公寓夜晚",
  });
  assert.deepEqual(getMountainStageMedia("city-realization"), {
    type: "image",
    sources: ["./assets/mountain/city-realization.png"],
    alt: "镜前重新审视城市生活的夜晚",
  });
});

test("全部可见剧情阶段都有合法媒体映射", () => {
  assert.deepEqual(validateMountainMedia(MOUNTAIN_STAGES), []);
  assert.equal(getMountainStageMedia("missing-stage"), null);
});

