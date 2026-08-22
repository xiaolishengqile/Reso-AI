import "./styles.css";
import { renderCharacterPreview } from "./entities/character.js";
import { createGame } from "./game/createGame.js";

const canvas = document.querySelector("#world-canvas");
const compatibilityError = document.querySelector("#compatibility-error");
const characterDialog = document.querySelector("#character-dialog");
const characterButtons = [...document.querySelectorAll("[data-character]")];
let game = null;

function startGame(characterId) {
  if (game) return;
  try {
    game = createGame({
      canvas,
      characterId,
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
        completeButton: document.querySelector("#dialog-complete"),
        closeButton: document.querySelector("#dialog-close"),
        overviewButton: document.querySelector("#overview-button"),
      },
    });
    characterDialog.close?.();
    characterDialog.removeAttribute("open");
    game.start();
  } catch (error) {
    console.error("创建世界地图失败", error);
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

window.addEventListener("beforeunload", () => game?.dispose(), { once: true });
