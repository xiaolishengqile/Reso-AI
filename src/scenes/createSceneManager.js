export function createSceneManager({ ui, onComplete = () => {} }) {
  let activeScene = null;
  let primaryAction = null;
  const primaryButton = ui.primaryButton ?? ui.completeButton;

  function close() {
    if (typeof ui.dialog?.close === "function" && ui.dialog.open) {
      ui.dialog.close();
    } else {
      ui.dialog?.removeAttribute("open");
    }
    activeScene = null;
    primaryAction = null;
  }

  function runPrimaryAction() {
    if (!activeScene || primaryButton?.hidden) return;
    const scene = activeScene;
    const action = primaryAction ?? onComplete;
    close();
    action(scene);
  }

  function open(scene, {
    canComplete = false,
    primaryLabel = null,
    onPrimary = null,
  } = {}) {
    if (!scene) throw new Error("无法打开未注册场景");
    activeScene = scene;
    primaryAction = typeof onPrimary === "function" ? onPrimary : null;
    if (ui.dialogTitle) ui.dialogTitle.textContent = scene.name;
    if (ui.dialogLabel) ui.dialogLabel.textContent = scene.label;
    if (ui.dialogDescription) {
      ui.dialogDescription.textContent = scene.sceneDescription;
    }
    if (primaryButton) {
      const buttonLabel = primaryLabel
        ?? (canComplete ? scene.completionLabel : null);
      primaryButton.hidden = !buttonLabel;
      primaryButton.textContent = buttonLabel ?? "";
    }
    ui.dialog?.style.setProperty("--scene-accent", scene.accent);
    if (typeof ui.dialog?.showModal === "function" && !ui.dialog.open) {
      ui.dialog.showModal();
    } else {
      ui.dialog?.setAttribute("open", "");
    }
  }

  ui.closeButton?.addEventListener("click", close);
  primaryButton?.addEventListener("click", runPrimaryAction);

  return Object.freeze({
    open,
    close,
    dispose() {
      ui.closeButton?.removeEventListener("click", close);
      primaryButton?.removeEventListener("click", runPrimaryAction);
      activeScene = null;
      primaryAction = null;
    },
  });
}
