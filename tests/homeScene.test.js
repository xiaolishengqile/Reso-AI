import test from "node:test";
import assert from "node:assert/strict";
import { createHomeScene } from "../src/scenes/home/createHomeScene.js";
import { HOME_PROGRESS_KEY } from "../src/scenes/home/progress.js";
import { TRAVELER_PROFILE_KEY } from "../src/profile/travelerProfile.js";

class FakeElement {
  constructor() {
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
  click() { this.listeners.get("click")?.({ currentTarget: this, preventDefault() {} }); }
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
    root: new FakeElement(),
    canvas: null,
    title: new FakeElement(),
    text: new FakeElement(),
    choices: new FakeElement(),
    continueButton: new FakeElement(),
    recordForm: new FakeElement(),
    nickname: new FakeElement(),
    message: new FakeElement(),
    mbtiType: new FakeElement(),
    nicknameError: new FakeElement(),
    messageError: new FakeElement(),
    mbtiTypeError: new FakeElement(),
    submitButton: new FakeElement(),
    saveWarning: new FakeElement(),
    progress: new FakeElement(),
  };
  elements.root.hidden = true;
  elements.recordForm.hidden = true;
  const scene = createHomeScene({
    characterId: "girl",
    elements,
    storage,
    documentTarget: { createElement: () => new FakeElement() },
  });
  return { scene, elements, storage };
}

function reachRecord(fixture, choiceIndex = 1) {
  fixture.elements.continueButton.click();
  fixture.elements.continueButton.click();
  fixture.elements.choices.children[choiceIndex].click();
  fixture.elements.continueButton.click();
}

test("雾谷按开场、选择、完整回应和记录顺序推进", () => {
  const fixture = createFixture();
  fixture.scene.open({ complete() {} });

  assert.match(fixture.elements.text.textContent, /薄雾笼罩/);
  fixture.elements.continueButton.click();
  assert.match(fixture.elements.text.textContent, /年轻人，等等/);
  fixture.elements.continueButton.click();
  assert.equal(fixture.elements.choices.children.length, 4);
  fixture.elements.choices.children[1].click();
  assert.match(fixture.elements.text.textContent, /按照自己的节奏前进/);
  fixture.elements.continueButton.click();
  assert.equal(fixture.elements.recordForm.hidden, false);
  assert.match(fixture.elements.text.textContent, /旅人的记录/);
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
  assert.deepEqual(profile.scores.energy, { E: 70, I: 30 });
  assert.equal(progress.completed, true);
  assert.match(fixture.elements.text.textContent, /欢迎来到雾谷/);
  assert.equal(completed, 0);

  fixture.elements.continueButton.click();
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
