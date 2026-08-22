import test from "node:test";
import assert from "node:assert/strict";
import { createHomeScene } from "../src/scenes/home/createHomeScene.js";
import {
  HOME_PROGRESS_KEY,
  completeHomeProgress,
  createHomeProgress,
  saveHomeChoice,
  saveHomeDraft,
} from "../src/scenes/home/progress.js";
import {
  TRAVELER_PROFILE_KEY,
  createTravelerProfile,
} from "../src/profile/travelerProfile.js";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.value = "";
    this.listeners = new Map();
    this.attributes = new Map();
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  closest(selector) {
    return selector.split(",").some((value) => value.trim() === this.tagName.toLowerCase())
      ? this
      : null;
  }
  click(target = this) {
    this.listeners.get("click")?.({
      currentTarget: this,
      target,
      preventDefault() {},
    });
  }
  input() { this.listeners.get("input")?.({ currentTarget: this }); }
  change() { this.listeners.get("change")?.({ currentTarget: this }); }
}

function memoryStorage(initial = {}, failingKey = null) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (key === failingKey) throw new Error("quota");
      values.set(key, value);
    },
  };
}

function createFixture(storage = memoryStorage()) {
  const elements = {
    root: new FakeElement("section"),
    title: new FakeElement("h2"),
    text: new FakeElement("p"),
    choices: new FakeElement("div"),
    continueButton: new FakeElement("button"),
    recordForm: new FakeElement("form"),
    nickname: new FakeElement("input"),
    message: new FakeElement("textarea"),
    mbtiType: new FakeElement("select"),
    nicknameError: new FakeElement(),
    messageError: new FakeElement(),
    mbtiTypeError: new FakeElement(),
    submitButton: new FakeElement("button"),
    saveWarning: new FakeElement(),
    progress: new FakeElement(),
  };
  elements.root.hidden = true;
  elements.recordForm.hidden = true;
  const scene = createHomeScene({
    characterId: "girl",
    elements,
    storage,
    documentTarget: { createElement: (tagName) => new FakeElement(tagName) },
  });
  return { scene, elements, storage };
}

function reachRecord(fixture, choiceIndex = 1) {
  for (let count = 0; count < 12 && fixture.elements.choices.children.length === 0; count += 1) {
    fixture.elements.root.click(fixture.elements.text);
  }
  fixture.elements.choices.children[choiceIndex].click();
  advanceToRecord(fixture);
}

function advanceToRecord(fixture) {
  for (let count = 0; count < 24 && fixture.elements.recordForm.hidden; count += 1) {
    fixture.elements.root.click(fixture.elements.text);
  }
}

test("雾谷旁白在当前地图上逐段点击推进", () => {
  const fixture = createFixture();
  fixture.scene.open({ complete() {} });

  assert.match(fixture.elements.text.textContent, /薄雾笼罩/);
  fixture.elements.root.click(fixture.elements.text);
  assert.match(fixture.elements.text.textContent, /年轻人，等等/);
  fixture.elements.root.click(fixture.elements.text);
  assert.match(fixture.elements.text.textContent, /一位老人正坐在路边/);
  fixture.elements.root.click(fixture.elements.text);
  assert.match(fixture.elements.text.textContent, /第一次来到雾谷吧/);
  fixture.elements.root.click(fixture.elements.text);
  assert.equal(fixture.elements.choices.children.length, 4);
  fixture.elements.choices.children[1].click();
  assert.match(fixture.elements.text.textContent, /你：谢谢，我想先看看/);
  fixture.elements.root.click(fixture.elements.text);
  assert.match(fixture.elements.text.textContent, /老人温和地点点头/);
  advanceToRecord(fixture);
  assert.equal(fixture.elements.recordForm.hidden, false);
  assert.match(fixture.elements.text.textContent, /旅人的记录/);
  fixture.scene.dispose();
});

test("老人发出引路邀请时四个回应立即紧跟出现", () => {
  const fixture = createFixture();
  fixture.scene.open({ complete() {} });

  for (let count = 0; count < 8 && !fixture.elements.text.textContent.includes("我可以告诉你该怎么走"); count += 1) {
    fixture.elements.root.click(fixture.elements.text);
  }

  assert.match(fixture.elements.text.textContent, /我可以告诉你该怎么走/);
  assert.equal(fixture.elements.choices.children.length, 4);
  fixture.scene.dispose();
});

test("选项和表单点击不会误推进剧情", () => {
  const fixture = createFixture();
  fixture.scene.open({ complete() {} });

  for (let count = 0; count < 8 && fixture.elements.choices.children.length === 0; count += 1) {
    fixture.elements.root.click(fixture.elements.text);
  }
  const choice = fixture.elements.choices.children[0];
  fixture.elements.root.click(choice);
  assert.equal(fixture.elements.choices.children.length, 4);

  choice.click();
  const response = fixture.elements.text.textContent;
  fixture.elements.root.click(choice);
  assert.equal(fixture.elements.text.textContent, response);

  advanceToRecord(fixture);
  const recordText = fixture.elements.text.textContent;
  fixture.elements.root.click(fixture.elements.nickname);
  assert.equal(fixture.elements.text.textContent, recordText);
  assert.equal(fixture.elements.recordForm.hidden, false);
  fixture.scene.dispose();
});

test("三项未全部填写时不能完成雾谷", () => {
  const fixture = createFixture();
  let completed = 0;
  fixture.scene.open({ complete() { completed += 1; } });
  reachRecord(fixture);
  fixture.elements.nickname.value = "小雾";
  fixture.elements.message.value = "";
  fixture.elements.mbtiType.value = "INFJ";
  fixture.elements.submitButton.click();

  assert.equal(completed, 0);
  assert.match(fixture.elements.messageError.textContent, /1—80/);
  assert.equal(fixture.storage.getItem(TRAVELER_PROFILE_KEY), null);
  fixture.scene.dispose();
});

test("保存三项记录后生成画像，结语结束才返回地图", () => {
  const fixture = createFixture();
  let completed = 0;
  fixture.scene.open({ complete() { completed += 1; } });
  reachRecord(fixture, 0);
  fixture.elements.nickname.value = "小雾";
  fixture.elements.message.value = "去看看雾后面有什么。";
  fixture.elements.mbtiType.value = "ENFP";
  fixture.elements.submitButton.click();

  const profile = JSON.parse(fixture.storage.getItem(TRAVELER_PROFILE_KEY));
  const progress = JSON.parse(fixture.storage.getItem(HOME_PROGRESS_KEY));
  assert.equal(profile.choiceId, "A");
  assert.equal(profile.officialEvidence[0].analysis, "愿意主动建立联系并快速交换信息");
  assert.deepEqual(profile.scores.energy, { E: 70, I: 30 });
  assert.equal(progress.completed, true);
  assert.match(fixture.elements.text.textContent, /老人合上册子/);
  fixture.elements.root.click(fixture.elements.text);
  fixture.elements.root.click(fixture.elements.text);
  fixture.elements.root.click(fixture.elements.text);
  assert.match(fixture.elements.text.textContent, /欢迎来到雾谷/);
  assert.equal(completed, 0);

  fixture.elements.root.click(fixture.elements.text);
  assert.equal(completed, 1);
  assert.equal(fixture.elements.root.hidden, true);
  fixture.scene.dispose();
});

test("记录草稿会即时保存并在刷新后恢复", () => {
  const storage = memoryStorage();
  const first = createFixture(storage);
  first.scene.open({ complete() {} });
  reachRecord(first);
  first.elements.nickname.value = "小雾";
  first.elements.nickname.input();
  first.elements.message.value = "慢慢找到方向";
  first.elements.message.input();
  first.elements.mbtiType.value = "INFJ";
  first.elements.mbtiType.change();
  first.scene.dispose();

  const resumed = createFixture(storage);
  resumed.scene.open({ complete() {} });
  assert.equal(resumed.elements.recordForm.hidden, false);
  assert.equal(resumed.elements.nickname.value, "小雾");
  assert.equal(resumed.elements.message.value, "慢慢找到方向");
  assert.equal(resumed.elements.mbtiType.value, "INFJ");
  resumed.scene.dispose();
});

test("画像或进度保存失败时留在记录页并允许重试", () => {
  for (const failingKey of [TRAVELER_PROFILE_KEY, HOME_PROGRESS_KEY]) {
    const fixture = createFixture(memoryStorage({}, failingKey));
    let completed = 0;
    fixture.scene.open({ complete() { completed += 1; } });
    reachRecord(fixture);
    fixture.elements.nickname.value = "小雾";
    fixture.elements.message.value = "留下记录";
    fixture.elements.mbtiType.value = "ISTJ";
    fixture.elements.submitButton.click();

    assert.equal(completed, 0);
    assert.equal(fixture.elements.recordForm.hidden, false);
    assert.equal(fixture.elements.saveWarning.hidden, false);
    fixture.scene.dispose();
  }
});

test("只有完成进度但画像缺失时回到记录页修复", () => {
  const inconsistent = completeHomeProgress(saveHomeDraft(
    saveHomeChoice(createHomeProgress("girl"), "D"),
    { nickname: "小雾", message: "我先看看", mbtiType: "ISTJ" },
  ));
  const fixture = createFixture(memoryStorage({
    [HOME_PROGRESS_KEY]: JSON.stringify(inconsistent),
  }));

  fixture.scene.open({ complete() {} });

  assert.equal(fixture.elements.recordForm.hidden, false);
  assert.equal(fixture.elements.nickname.value, "小雾");
  fixture.scene.dispose();
});

test("画像已保存但进度缺失时自动补齐完成状态", () => {
  const profile = createTravelerProfile({
    nickname: "小雾",
    message: "慢慢走",
    mbtiType: "INFJ",
    choiceId: "B",
    analysis: "礼貌接收帮助，同时保持自己的节奏与边界",
  }, 1234);
  const fixture = createFixture(memoryStorage({
    [TRAVELER_PROFILE_KEY]: JSON.stringify(profile),
  }));

  fixture.scene.open({ complete() {} });

  const repaired = JSON.parse(fixture.storage.getItem(HOME_PROGRESS_KEY));
  assert.equal(repaired.completed, true);
  assert.equal(repaired.choiceId, "B");
  assert.equal(repaired.draft.nickname, "小雾");
  assert.equal(fixture.elements.recordForm.hidden, true);
  assert.match(fixture.elements.text.textContent, /老人合上册子/);
  fixture.scene.dispose();
});
