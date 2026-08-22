import test from "node:test";
import assert from "node:assert/strict";

async function loadSceneModules() {
  let managerModule;
  let registry;
  await assert.doesNotReject(async () => {
    [managerModule, registry] = await Promise.all([
      import("../src/scenes/createSceneManager.js"),
      import("../src/scenes/registry.js"),
    ]);
  });
  return { managerModule, registry };
}

function element(properties = {}) {
  return Object.assign(new EventTarget(), properties);
}

function createUi() {
  const accent = new Map();
  return {
    dialog: Object.assign(new EventTarget(), {
      open: false,
      style: {
        setProperty(name, value) { accent.set(name, value); },
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(name) { if (name === "open") this.open = true; },
      removeAttribute(name) { if (name === "open") this.open = false; },
    }),
    dialogTitle: element({ textContent: "" }),
    dialogLabel: element({ textContent: "" }),
    dialogDescription: element({ textContent: "" }),
    primaryButton: element({ textContent: "", hidden: true }),
    closeButton: element(),
    accent,
  };
}

test("打开爬山入口时显示明确的进入剧情按钮", async () => {
  const { managerModule, registry } = await loadSceneModules();
  const ui = createUi();
  const manager = managerModule.createSceneManager({ ui });

  manager.open(registry.getScene("mountain"), {
    primaryLabel: "进入爬山剧情",
    onPrimary() {},
  });

  assert.equal(ui.dialog.open, true);
  assert.equal(ui.dialogTitle.textContent, "爬山岛");
  assert.equal(ui.dialogLabel.textContent, "第 一 站 · 爬 山 场 景");
  assert.match(ui.dialogDescription.textContent, /完整结束后/);
  assert.equal(ui.primaryButton.hidden, false);
  assert.equal(ui.primaryButton.textContent, "进入爬山剧情");
  assert.equal(ui.accent.get("--scene-accent"), "#9b745c");
});

test("场景主按钮可以进入剧情而不会被误判为完成", async () => {
  const { managerModule, registry } = await loadSceneModules();
  const ui = createUi();
  const completed = [];
  const manager = managerModule.createSceneManager({
    ui,
    onComplete: (scene) => completed.push(scene.id),
  });

  const entered = [];
  manager.open(registry.getScene("mountain"), {
    primaryLabel: "进入爬山剧情",
    onPrimary: (scene) => entered.push(scene.id),
  });
  ui.primaryButton.dispatchEvent(new Event("click"));
  assert.deepEqual(entered, ["mountain"]);
  assert.deepEqual(completed, []);
  assert.equal(ui.dialog.open, false);

  manager.open({ ...registry.getScene("office"), completionLabel: "完成工作" }, {
    canComplete: true,
  });
  ui.primaryButton.dispatchEvent(new Event("click"));
  assert.deepEqual(completed, ["office"]);

  manager.open(registry.getScene("home"));
  assert.equal(ui.primaryButton.hidden, true);
  ui.closeButton.dispatchEvent(new Event("click"));
  assert.equal(ui.dialog.open, false);

  manager.dispose();
  ui.primaryButton.dispatchEvent(new Event("click"));
  assert.deepEqual(completed, ["office"]);
});
