import "./styles.css";
import "./scenes/mountain/mountainScene.css";
import { renderCharacterPreview } from "./entities/character.js";
import { createGame } from "./game/createGame.js";
import { createMountainScene } from "./scenes/mountain/createMountainScene.js";
import { loadMountainProgress } from "./scenes/mountain/progress.js";
import { getScene } from "./scenes/registry.js";

const canvas = document.querySelector("#world-canvas");
const compatibilityError = document.querySelector("#compatibility-error");
const characterDialog = document.querySelector("#character-dialog");
const characterButtons = [...document.querySelectorAll("[data-character]")];
let game = null;
let mountainScene = null;

function getInitialUnlockedOrder(characterId) {
  const progress = loadMountainProgress(window.localStorage, characterId);
  const mountainLocation = getScene("mountain");
  return progress.completed || progress.isReplay
    ? mountainLocation?.unlocksOrder
    : undefined;
}

function startGame(characterId) {
  if (game) return;
  try {
    mountainScene = createMountainScene({
      characterId,
      elements: {
        root: document.querySelector("#mountain-scene"),
        canvas: document.querySelector("#mountain-scene-canvas"),
        title: document.querySelector("#mountain-stage-title"),
        text: document.querySelector("#mountain-story-text"),
        choices: document.querySelector("#mountain-choices"),
        continueButton: document.querySelector("#mountain-continue"),
        closeButton: document.querySelector("#mountain-close"),
        saveWarning: document.querySelector("#mountain-save-warning"),
        progress: document.querySelector("#mountain-progress"),
      },
    });
    game = createGame({
      canvas,
      characterId,
      initialUnlockedOrder: getInitialUnlockedOrder(characterId),
      ui: {
        locationCard: document.querySelector("#location-card"),
        locationName: document.querySelector("#location-name"),
        locationDescription: document.querySelector("#location-description"),
        locationHint: document.querySelector("#location-hint"),
        legendItems: document.querySelectorAll("[data-location-id]"),
        status: document.querySelector("#status"),
        dialog: document.querySelector("#scene-dialog"),
        dialogLabel: document.querySelector("#dialog-label"),
        dialogTitle: document.querySelector("#dialog-title"),
        dialogDescription: document.querySelector("#dialog-description"),
        primaryButton: document.querySelector("#dialog-primary"),
        closeButton: document.querySelector("#dialog-close"),
        overviewButton: document.querySelector("#overview-button"),
      },
      onEnterScene: (_scene, callbacks) => mountainScene.open(callbacks),
    });
    characterDialog.close?.();
    characterDialog.removeAttribute("open");
    game.start();
  } catch (error) {
    console.error("创建世界地图失败", error);
    mountainScene?.dispose();
    mountainScene = null;
    game?.dispose();
    game = null;
    characterDialog.close?.();
    characterDialog.removeAttribute("open");
    canvas.hidden = true;
    compatibilityError.hidden = false;
  }
}

for (const button of characterButtons) {
  renderCharacterPreview(button.querySelector("canvas"), button.dataset.character);
  button.addEventListener("click", () => startGame(button.dataset.character), {
    once: true,
  });
}

characterDialog.addEventListener("cancel", (event) => event.preventDefault());
if (typeof characterDialog.showModal === "function") characterDialog.showModal();
else characterDialog.setAttribute("open", "");

window.addEventListener("beforeunload", () => {
  mountainScene?.dispose();
  game?.dispose();
}, { once: true });
