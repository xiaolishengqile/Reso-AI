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
    completeButton: element({ textContent: "", hidden: true }),
    closeButton: element(),
    accent,
  };
}

test("打开爬山场景时只由场景定义填充弹窗", async () => {
  const { managerModule, registry } = await loadSceneModules();
  const ui = createUi();
  const manager = managerModule.createSceneManager({ ui });

  manager.open(registry.getScene("mountain"), { canComplete: true });

  assert.equal(ui.dialog.open, true);
  assert.equal(ui.dialogTitle.textContent, "爬山岛");
  assert.equal(ui.dialogLabel.textContent, "第 一 站 · 爬 山 场 景");
  assert.match(ui.dialogDescription.textContent, /完成这段旅程后/);
  assert.equal(ui.completeButton.hidden, false);
  assert.equal(ui.completeButton.textContent, "完成爬山，解锁工作岛");
  assert.equal(ui.accent.get("--scene-accent"), "#9b745c");
});

test("场景管理器统一处理完成、关闭和事件清理", async () => {
  const { managerModule, registry } = await loadSceneModules();
  const ui = createUi();
  const completed = [];
  const manager = managerModule.createSceneManager({
    ui,
    onComplete: (scene) => completed.push(scene.id),
  });

  manager.open(registry.getScene("mountain"), { canComplete: true });
  ui.completeButton.dispatchEvent(new Event("click"));
  assert.deepEqual(completed, ["mountain"]);
  assert.equal(ui.dialog.open, false);

  manager.open(registry.getScene("home"));
  assert.equal(ui.completeButton.hidden, true);
  ui.closeButton.dispatchEvent(new Event("click"));
  assert.equal(ui.dialog.open, false);

  manager.dispose();
  ui.completeButton.dispatchEvent(new Event("click"));
  assert.deepEqual(completed, ["mountain"]);
});
