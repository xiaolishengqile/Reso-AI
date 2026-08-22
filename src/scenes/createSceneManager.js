export function createSceneManager({ ui, onComplete = () => {} }) {
  let activeScene = null;

  function close() {
    if (typeof ui.dialog?.close === "function" && ui.dialog.open) {
      ui.dialog.close();
    } else {
      ui.dialog?.removeAttribute("open");
    }
    activeScene = null;
  }

  function complete() {
    if (!activeScene || ui.completeButton?.hidden) return;
    onComplete(activeScene);
    close();
  }

  function open(scene, { canComplete = false } = {}) {
    if (!scene) throw new Error("无法打开未注册场景");
    activeScene = scene;
    if (ui.dialogTitle) ui.dialogTitle.textContent = scene.name;
    if (ui.dialogLabel) ui.dialogLabel.textContent = scene.label;
    if (ui.dialogDescription) {
      ui.dialogDescription.textContent = scene.sceneDescription;
    }
    if (ui.completeButton) {
      ui.completeButton.hidden = !canComplete || !scene.completionLabel;
      ui.completeButton.textContent = scene.completionLabel ?? "";
    }
    ui.dialog?.style.setProperty("--scene-accent", scene.accent);
    if (typeof ui.dialog?.showModal === "function" && !ui.dialog.open) {
      ui.dialog.showModal();
    } else {
      ui.dialog?.setAttribute("open", "");
    }
  }

  ui.closeButton?.addEventListener("click", close);
  ui.completeButton?.addEventListener("click", complete);

  return Object.freeze({
    open,
    close,
    dispose() {
      ui.closeButton?.removeEventListener("click", close);
      ui.completeButton?.removeEventListener("click", complete);
      activeScene = null;
    },
  });
}
