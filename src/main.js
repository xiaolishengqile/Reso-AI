import "./styles.css";
import { createGame } from "./game/createGame.js";

const canvas = document.querySelector("#world-canvas");
const compatibilityError = document.querySelector("#compatibility-error");

try {
  const game = createGame({
    canvas,
    ui: {
      locationCard: document.querySelector("#location-card"),
      locationName: document.querySelector("#location-name"),
      locationDescription: document.querySelector("#location-description"),
      status: document.querySelector("#status"),
      dialog: document.querySelector("#scene-dialog"),
      dialogTitle: document.querySelector("#dialog-title"),
      dialogDescription: document.querySelector("#dialog-description"),
      closeButton: document.querySelector("#dialog-close"),
    },
  });
  game.start();
  window.addEventListener("beforeunload", () => game.dispose(), { once: true });
} catch (error) {
  console.error("创建世界地图失败", error);
  canvas.hidden = true;
  compatibilityError.hidden = false;
}
