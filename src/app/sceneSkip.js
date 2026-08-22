export function createSceneSkip({ button } = {}) {
  if (!button) throw new Error("缺少全局剧情跳过按钮");

  let activeController = null;

  function updateButton() {
    button.disabled = typeof activeController?.skipCurrentSegment !== "function";
  }

  function skip() {
    return activeController?.skipCurrentSegment?.() ?? false;
  }

  function deactivate(controller) {
    if (activeController !== controller) return;
    activeController = null;
    updateButton();
  }

  function activate(controller, callbacks = {}) {
    activeController = controller;
    updateButton();
    return {
      ...callbacks,
      close(...args) {
        deactivate(controller);
        callbacks.close?.(...args);
      },
      complete(...args) {
        deactivate(controller);
        callbacks.complete?.(...args);
      },
    };
  }

  function show() {
    button.hidden = false;
    updateButton();
  }

  function dispose() {
    activeController = null;
    button.removeEventListener("click", skip);
    updateButton();
  }

  button.addEventListener("click", skip);
  updateButton();

  return Object.freeze({ activate, show, dispose });
}
