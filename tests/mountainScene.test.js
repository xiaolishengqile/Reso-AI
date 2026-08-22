import test from "node:test";
import assert from "node:assert/strict";
import { createMountainScene } from "../src/scenes/mountain/createMountainScene.js";
import {
  advanceMountainProgress,
  completeMountainProgress,
  createMountainProgress,
  MOUNTAIN_PROGRESS_KEY,
  recordMountainSelection,
} from "../src/scenes/mountain/progress.js";
import { getMountainStage } from "../src/scenes/mountain/story.js";

class FakeElement {
  constructor({ playResult = Promise.resolve() } = {}) {
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.src = "";
    this.alt = "";
    this.currentTime = 0;
    this.attributes = new Map();
    this.listeners = new Map();
    this.playResult = playResult;
    this.playCount = 0;
    this.pauseCount = 0;
    this.loadCount = 0;
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  dispatch(type) {
    this.listeners.get(type)?.({ currentTarget: this, target: this });
  }

  click() {
    this.dispatch("click");
  }

  play() {
    this.playCount += 1;
    return this.playResult;
  }

  pause() {
    this.pauseCount += 1;
  }

  load() {
    this.loadCount += 1;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function createSceneFixture({
  storage = createMemoryStorage(),
  characterId = "boy",
  video = new FakeElement(),
} = {}) {
  const elements = {
    root: new FakeElement(),
    video,
    image: new FakeElement(),
    panel: new FakeElement(),
    title: new FakeElement(),
    text: new FakeElement(),
    choices: new FakeElement(),
    continueButton: new FakeElement(),
    closeButton: new FakeElement(),
    startButton: new FakeElement(),
    playButton: new FakeElement(),
    saveWarning: new FakeElement(),
    progress: new FakeElement(),
  };
  const scene = createMountainScene({
    characterId,
    elements,
    storage,
    documentTarget: { createElement: () => new FakeElement() },
    windowTarget: { performance: { now: () => 1000 } },
  });
  return { elements, scene, storage };
}

function openScene(fixture, callbacks = {}) {
  fixture.scene.open({ complete() {}, close() {}, ...callbacks });
}

function finishInvitationVideos(elements) {
  elements.video.dispatch("ended");
  elements.video.dispatch("ended");
  elements.video.dispatch("ended");
}

test("入口图片确认后才播放第一段视频", () => {
  const fixture = createSceneFixture();
  openScene(fixture);

  assert.equal(fixture.elements.image.src, "./assets/mountain/mountain-entry.png");
  assert.equal(fixture.elements.image.hidden, false);
  assert.equal(fixture.elements.video.hidden, true);
  assert.equal(fixture.elements.startButton.hidden, false);
  assert.equal(fixture.elements.startButton.textContent, "开始旅程");
  assert.equal(fixture.elements.choices.children.length, 0);

  fixture.elements.startButton.click();

  assert.equal(fixture.elements.video.src, "./assets/mountain/scene-1-1.mp4");
  assert.equal(fixture.elements.video.hidden, false);
  assert.equal(fixture.elements.image.hidden, true);
  assert.equal(fixture.elements.panel.hidden, true);
  assert.equal(fixture.elements.video.playCount, 1);
  fixture.scene.dispose();
});

test("三段邀约视频全部播放完才显示问题", () => {
  const fixture = createSceneFixture();
  openScene(fixture);
  fixture.elements.startButton.click();

  fixture.elements.video.dispatch("ended");
  assert.equal(fixture.elements.video.src, "./assets/mountain/scene-1-3.mp4");
  assert.equal(fixture.elements.choices.children.length, 0);

  fixture.elements.video.dispatch("ended");
  assert.equal(fixture.elements.video.src, "./assets/mountain/scene-1-4.mp4");
  assert.equal(fixture.elements.choices.children.length, 0);

  fixture.elements.video.dispatch("ended");
  assert.equal(fixture.elements.panel.hidden, false);
  assert.equal(fixture.elements.title.textContent, "周末邀约");
  assert.equal(fixture.elements.text.textContent, "这个周末，要不要一起去爬山？");
  assert.equal(fixture.elements.choices.children.length, 3);
  fixture.scene.dispose();
});

test("男女玩家共用同一套视频", () => {
  for (const characterId of ["boy", "girl"]) {
    const fixture = createSceneFixture({ characterId });
    openScene(fixture);
    fixture.elements.startButton.click();
    assert.equal(fixture.elements.video.src, "./assets/mountain/scene-1-1.mp4");
    fixture.scene.dispose();
  }
});

test("恢复进度时先显示入口图片，再继续当前阶段视频", () => {
  const progress = advanceMountainProgress(createMountainProgress("boy"), "fatigue");
  const fixture = createSceneFixture({
    storage: createMemoryStorage({
      [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(progress),
    }),
  });
  openScene(fixture);

  assert.equal(fixture.elements.startButton.textContent, "继续旅程");
  assert.match(fixture.elements.progress.textContent, /继续上次旅程/);
  fixture.elements.startButton.click();
  assert.equal(fixture.elements.video.src, "./assets/mountain/scene-2.mp4");

  fixture.elements.video.dispatch("ended");
  assert.equal(fixture.elements.title.textContent, "疲惫与抱怨");
  assert.match(fixture.elements.text.textContent, /她/);
  assert.doesNotMatch(fixture.elements.text.textContent, /陡峭崖壁/);
  fixture.scene.dispose();
});

test("已完成剧情重玩时从入口开始并保留正式证据", () => {
  const invitation = getMountainStage("invitation");
  const withEvidence = recordMountainSelection(
    createMountainProgress("boy"),
    invitation,
    invitation.choices[0],
    { answeredAt: 1000 },
  );
  const completed = completeMountainProgress(withEvidence, 2000);
  const fixture = createSceneFixture({
    storage: createMemoryStorage({
      [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(completed),
    }),
  });
  openScene(fixture);

  assert.equal(fixture.elements.startButton.textContent, "重温旅程");
  fixture.elements.startButton.click();
  assert.equal(fixture.elements.video.src, "./assets/mountain/scene-1-1.mp4");
  const replay = JSON.parse(fixture.storage.getItem(MOUNTAIN_PROGRESS_KEY));
  assert.equal(replay.officialEvidence.length, 1);
  fixture.scene.dispose();
});

test("未知剧情阶段会回退到邀约并保留已有正式证据", () => {
  const invitation = getMountainStage("invitation");
  const selected = recordMountainSelection(
    createMountainProgress("boy"),
    invitation,
    invitation.choices[0],
    { answeredAt: 1000 },
  );
  const corrupted = advanceMountainProgress(selected, "missing-stage");
  const fixture = createSceneFixture({
    storage: createMemoryStorage({
      [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(corrupted),
    }),
  });

  assert.doesNotThrow(() => openScene(fixture));
  fixture.elements.startButton.click();
  assert.equal(fixture.elements.video.src, "./assets/mountain/scene-1-1.mp4");
  const recovered = JSON.parse(fixture.storage.getItem(MOUNTAIN_PROGRESS_KEY));
  assert.equal(recovered.currentStageId, "invitation");
  assert.equal(recovered.officialEvidence.length, 1);
  fixture.scene.dispose();
});

test("回答后只记录一次证据并立即播放下一段视频", () => {
  const fixture = createSceneFixture();
  openScene(fixture);
  fixture.elements.startButton.click();
  finishInvitationVideos(fixture.elements);

  const firstOption = fixture.elements.choices.children[0];
  firstOption.click();
  firstOption.click();

  const progress = JSON.parse(fixture.storage.getItem(MOUNTAIN_PROGRESS_KEY));
  assert.equal(progress.officialEvidence.length, 1);
  assert.equal(progress.officialEvidence[0].companionMood, "安心");
  assert.equal(progress.currentStageId, "fatigue");
  assert.equal(fixture.elements.video.src, "./assets/mountain/scene-2.mp4");
  assert.equal(fixture.elements.panel.hidden, true);
  fixture.scene.dispose();
});

test("缺少视频的回家消息用图片并立即显示问题", () => {
  const progress = advanceMountainProgress(createMountainProgress("boy"), "home-message");
  const fixture = createSceneFixture({
    storage: createMemoryStorage({
      [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(progress),
    }),
  });
  openScene(fixture);
  fixture.elements.startButton.click();

  assert.equal(fixture.elements.image.src, "./assets/mountain/home-message.png");
  assert.equal(fixture.elements.image.hidden, false);
  assert.equal(fixture.elements.panel.hidden, false);
  assert.equal(fixture.elements.title.textContent, "回家消息");
  assert.equal(fixture.elements.choices.children.length, 3);
  fixture.scene.dispose();
});

test("城市顿悟用图片并显示最后一组问题", () => {
  const progress = advanceMountainProgress(createMountainProgress("boy"), "city-realization");
  const fixture = createSceneFixture({
    storage: createMemoryStorage({
      [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(progress),
    }),
  });
  openScene(fixture);
  fixture.elements.startButton.click();

  assert.equal(fixture.elements.image.src, "./assets/mountain/city-realization.png");
  assert.equal(fixture.elements.title.textContent, "城市顿悟");
  assert.equal(fixture.elements.choices.children.length, 3);
  fixture.scene.dispose();
});

test("浏览器阻止自动播放时提供继续播放按钮", async () => {
  const video = new FakeElement({ playResult: Promise.reject(new Error("blocked")) });
  const fixture = createSceneFixture({ video });
  openScene(fixture);
  fixture.elements.startButton.click();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(fixture.elements.panel.hidden, false);
  assert.equal(fixture.elements.playButton.hidden, false);
  assert.match(fixture.elements.text.textContent, /继续播放/);

  video.playResult = Promise.resolve();
  fixture.elements.playButton.click();
  assert.equal(video.playCount, 2);
  fixture.scene.dispose();
});

test("视频加载失败时跳过媒体并进入对应问题", () => {
  const fixture = createSceneFixture();
  openScene(fixture);
  fixture.elements.startButton.click();
  fixture.elements.video.dispatch("error");

  assert.equal(fixture.elements.saveWarning.hidden, false);
  assert.match(fixture.elements.saveWarning.textContent, /视频暂时无法播放/);
  assert.equal(fixture.elements.title.textContent, "周末邀约");
  assert.equal(fixture.elements.choices.children.length, 3);
  fixture.scene.dispose();
});

test("完成阶段显示图片且只通知世界地图一次", () => {
  const progress = advanceMountainProgress(createMountainProgress("boy"), "complete");
  const fixture = createSceneFixture({
    storage: createMemoryStorage({
      [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(progress),
    }),
  });
  let completed = 0;
  openScene(fixture, { complete() { completed += 1; } });
  fixture.elements.startButton.click();

  assert.equal(fixture.elements.image.src, "./assets/mountain/city-realization.png");
  assert.equal(fixture.elements.continueButton.hidden, false);
  fixture.elements.continueButton.click();
  fixture.elements.continueButton.click();
  assert.equal(completed, 1);
  fixture.scene.dispose();
});

test("完成存档失败时留在当前页面，重试成功后才通知地图", () => {
  let allowCompletion = false;
  const base = createMemoryStorage({
    [MOUNTAIN_PROGRESS_KEY]: JSON.stringify(
      advanceMountainProgress(createMountainProgress("boy"), "complete"),
    ),
  });
  const storage = {
    getItem: base.getItem,
    setItem(key, value) {
      if (JSON.parse(value).completed && !allowCompletion) throw new Error("quota");
      base.setItem(key, value);
    },
  };
  const fixture = createSceneFixture({ storage });
  let completed = 0;
  openScene(fixture, { complete() { completed += 1; } });
  fixture.elements.startButton.click();

  fixture.elements.continueButton.click();
  assert.equal(completed, 0);
  assert.equal(fixture.elements.root.hidden, false);
  assert.equal(fixture.elements.saveWarning.hidden, false);
  assert.equal(fixture.elements.continueButton.disabled, false);

  allowCompletion = true;
  fixture.elements.continueButton.click();
  assert.equal(completed, 1);
  assert.equal(fixture.elements.root.hidden, true);
  fixture.scene.dispose();
});

test("重温旅程初始化保存失败时保留警告", () => {
  const completed = completeMountainProgress(createMountainProgress("boy"), 2000);
  const storage = {
    getItem() { return JSON.stringify(completed); },
    setItem() { throw new Error("quota"); },
  };
  const fixture = createSceneFixture({ storage });

  openScene(fixture);

  assert.equal(fixture.elements.saveWarning.hidden, false);
  assert.match(fixture.elements.saveWarning.textContent, /无法保存/);
  fixture.scene.dispose();
});

test("关闭剧情不会触发世界地图完成回调", () => {
  const fixture = createSceneFixture();
  let completed = 0;
  let closed = 0;
  openScene(fixture, {
    complete() { completed += 1; },
    close() { closed += 1; },
  });

  fixture.elements.closeButton.click();
  assert.equal(completed, 0);
  assert.equal(closed, 1);
  assert.equal(fixture.elements.root.hidden, true);
  fixture.scene.dispose();
});
