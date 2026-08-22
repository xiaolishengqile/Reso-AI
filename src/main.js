import "./styles.css";
import "./scenes/home/homeScene.css";
import "./scenes/mountain/mountainScene.css";
import { renderCharacterPreview } from "./entities/character.js";
import { createGame } from "./game/createGame.js";
import { loadTravelerProfile } from "./profile/travelerProfile.js";
import { createHomeScene } from "./scenes/home/createHomeScene.js";
import { loadHomeProgress } from "./scenes/home/progress.js";
import { createMountainScene } from "./scenes/mountain/createMountainScene.js";
import { loadMountainProgress } from "./scenes/mountain/progress.js";
import { getScene } from "./scenes/registry.js";
import { resolveInitialScene } from "./startup.js";

const canvas = document.querySelector("#world-canvas");
const compatibilityError = document.querySelector("#compatibility-error");
const characterDialog = document.querySelector("#character-dialog");
const characterButtons = [...document.querySelectorAll("[data-character]")];
let game = null;
let homeScene = null;
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
    homeScene = createHomeScene({
      characterId,
      elements: {
        root: document.querySelector("#home-scene"),
        canvas: document.querySelector("#home-scene-canvas"),
        title: document.querySelector("#home-stage-title"),
        text: document.querySelector("#home-story-text"),
        choices: document.querySelector("#home-choices"),
        continueButton: document.querySelector("#home-continue"),
        recordForm: document.querySelector("#traveler-record"),
        nickname: document.querySelector("#traveler-nickname"),
        message: document.querySelector("#traveler-message"),
        mbtiType: document.querySelector("#traveler-mbti"),
        nicknameError: document.querySelector("#traveler-nickname-error"),
        messageError: document.querySelector("#traveler-message-error"),
        mbtiTypeError: document.querySelector("#traveler-mbti-error"),
        submitButton: document.querySelector("#traveler-record-submit"),
        saveWarning: document.querySelector("#home-save-warning"),
        progress: document.querySelector("#home-progress"),
      },
    });
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
    const sceneControllers = new Map([
      ["home", homeScene],
      ["mountain", mountainScene],
    ]);
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
      onEnterScene: (scene, callbacks) => {
        const controller = sceneControllers.get(scene.id);
        if (!controller) throw new Error(`场景未实现：${scene.id}`);
        controller.open(callbacks);
      },
    });
    characterDialog.close?.();
    characterDialog.removeAttribute("open");
    game.start();
    const initialScene = resolveInitialScene(
      loadTravelerProfile(window.localStorage),
      loadHomeProgress(window.localStorage, characterId),
    );
    if (initialScene) game.enterScene(initialScene);
  } catch (error) {
    console.error("创建世界地图失败", error);
    homeScene?.dispose();
    homeScene = null;
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
  homeScene?.dispose();
  mountainScene?.dispose();
  game?.dispose();
}, { once: true });
