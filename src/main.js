import "./styles.css";
import "./scenes/home/homeScene.css";
import "./scenes/mountain/mountainScene.css";
import "./scenes/story/storyScene.css";
import "./scenes/wish/wishScene.css";
import "./icebreaker/icebreaker.css";
import { renderCharacterPreview } from "./entities/character.js";
import { createGame } from "./game/createGame.js";
import {
  loadVisitedLocationIds,
  markLocationVisited,
} from "./game/journeyProgress.js";
import { requestGameReset } from "./app/progressReset.js";
import { createSceneSkip } from "./app/sceneSkip.js";
import { getSceneController, resolveSavedUnlockOrder } from "./app/sceneRouting.js";
import { loadTravelerProfile } from "./profile/travelerProfile.js";
import { createHomeScene } from "./scenes/home/createHomeScene.js";
import { loadHomeProgress } from "./scenes/home/progress.js";
import { createMountainScene } from "./scenes/mountain/createMountainScene.js";
import { loadMountainProgress } from "./scenes/mountain/progress.js";
import { createStoryScene } from "./scenes/story/createStoryScene.js";
import { getAllStories, getStory } from "./scenes/story/catalog.js";
import { loadStoryProgress } from "./scenes/story/progress.js";
import { createWishScene } from "./scenes/wish/createWishScene.js";
import { createIcebreakerFeature } from "./icebreaker/createIcebreakerFeature.js";
import { resolveInitialScene } from "./startup.js";

const canvas = document.querySelector("#world-canvas");
const compatibilityError = document.querySelector("#compatibility-error");
const characterDialog = document.querySelector("#character-dialog");
const characterButtons = [...document.querySelectorAll("[data-character]")];
const resetProgressButton = document.querySelector("#reset-progress-button");
const storySkipButton = document.querySelector("#story-skip-button");
let game = null;
let homeScene = null;
let mountainScene = null;
let storyScene = null;
let wishScene = null;
let icebreakerFeature = null;
let sceneSkip = null;

function getInitialJourneyState(characterId) {
  const stories = getAllStories();
  const mountainProgress = loadMountainProgress(window.localStorage, characterId);
  const homeProgress = loadHomeProgress(window.localStorage, characterId);
  const profile = loadTravelerProfile(window.localStorage);
  const storyProgress = Object.fromEntries(stories.map((story) => [
    story.id,
    loadStoryProgress(window.localStorage, characterId, story.id, story.initialStageId),
  ]));
  const completedLocationIds = [
    ...(homeProgress.completed ? ["home"] : []),
    ...(mountainProgress.completed ? ["mountain"] : []),
    ...stories
      .filter(({ id }) => storyProgress[id]?.completed)
      .map(({ id }) => id),
  ];
  return {
    profile,
    homeProgress,
    initialUnlockedOrder: resolveSavedUnlockOrder({
      mountainProgress,
      storyProgress,
      stories,
    }),
    initialVisitedLocationIds: [
      ...new Set([
        ...loadVisitedLocationIds(window.localStorage, characterId),
        ...completedLocationIds,
      ]),
    ],
    initialCompletedLocationIds: completedLocationIds,
  };
}

function startGame(characterId) {
  if (game) return;
  try {
    const initialJourney = getInitialJourneyState(characterId);
    sceneSkip = createSceneSkip({ button: storySkipButton });
    homeScene = createHomeScene({
      characterId,
      elements: {
        root: document.querySelector("#home-scene"),
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
        video: document.querySelector("#mountain-scene-video"),
        image: document.querySelector("#mountain-scene-image"),
        panel: document.querySelector("#mountain-scene-panel"),
        mediaControls: document.querySelector("#mountain-media-controls"),
        title: document.querySelector("#mountain-stage-title"),
        text: document.querySelector("#mountain-story-text"),
        choices: document.querySelector("#mountain-choices"),
        startButton: document.querySelector("#mountain-start"),
        playButton: document.querySelector("#mountain-play"),
        speedButton: document.querySelector("#mountain-speed"),
        skipButton: document.querySelector("#mountain-skip"),
        continueButton: document.querySelector("#mountain-continue"),
        closeButton: document.querySelector("#mountain-close"),
        saveWarning: document.querySelector("#mountain-save-warning"),
        progress: document.querySelector("#mountain-progress"),
      },
    });
    storyScene = createStoryScene({
      characterId,
      elements: {
        root: document.querySelector("#story-scene"),
        canvas: document.querySelector("#story-scene-canvas"),
        title: document.querySelector("#story-stage-title"),
        text: document.querySelector("#story-text"),
        choices: document.querySelector("#story-choices"),
        continueButton: document.querySelector("#story-continue"),
        closeButton: document.querySelector("#story-close"),
        saveWarning: document.querySelector("#story-save-warning"),
        progress: document.querySelector("#story-progress"),
      },
    });
    wishScene = createWishScene({
      characterId,
      elements: {
        root: document.querySelector("#wish-scene"),
        status: document.querySelector("#wish-status"),
        progress: document.querySelector("#wish-progress"),
        summary: document.querySelector("#wish-summary"),
        confidence: document.querySelector("#wish-confidence"),
        result: document.querySelector("#wish-result"),
        retryButton: document.querySelector("#wish-retry"),
        closeButton: document.querySelector("#wish-close"),
      },
    });
    icebreakerFeature = createIcebreakerFeature({
      characterId,
      elements: {
        button: document.querySelector("#icebreaker-button"),
        buttonLabel: document.querySelector("#icebreaker-button-label"),
        dialog: document.querySelector("#icebreaker-dialog"),
        status: document.querySelector("#icebreaker-status"),
        matchName: document.querySelector("#icebreaker-match-name"),
        text: document.querySelector("#icebreaker-text"),
        retryButton: document.querySelector("#icebreaker-retry"),
        closeButton: document.querySelector("#icebreaker-close"),
      },
    });
    icebreakerFeature.refresh();
    const sceneControllers = {
      home: homeScene,
      mountain: mountainScene,
      story: storyScene,
      wish: wishScene,
    };
    const proximityScene = resolveInitialScene(
      initialJourney.profile,
      initialJourney.homeProgress,
    );
    game = createGame({
      canvas,
      characterId,
      proximityScene,
      initialUnlockedOrder: initialJourney.initialUnlockedOrder,
      initialVisitedLocationIds: initialJourney.initialVisitedLocationIds,
      initialCompletedLocationIds: initialJourney.initialCompletedLocationIds,
      onVisitLocation: (locationId) => {
        markLocationVisited(window.localStorage, characterId, locationId);
      },
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
        const controller = getSceneController(scene.id, sceneControllers);
        if (!controller) throw new Error(`场景未实现：${scene.id}`);
        const story = getStory(scene.id);
        if (scene.id === "mountain") {
          const originalComplete = callbacks.complete;
          callbacks = {
            ...callbacks,
            complete(...args) {
              icebreakerFeature?.refresh();
              originalComplete?.(...args);
            },
          };
        }
        const sceneCallbacks = sceneSkip.activate(controller, callbacks);
        if (story) controller.open(story, sceneCallbacks);
        else controller.open(sceneCallbacks);
      },
    });
    characterDialog.close?.();
    characterDialog.removeAttribute("open");
    game.start();
    sceneSkip.show();
  } catch (error) {
    console.error("创建世界地图失败", error);
    homeScene?.dispose();
    homeScene = null;
    mountainScene?.dispose();
    mountainScene = null;
    storyScene?.dispose();
    storyScene = null;
    wishScene?.dispose();
    wishScene = null;
    icebreakerFeature?.dispose();
    icebreakerFeature = null;
    game?.dispose();
    game = null;
    sceneSkip?.dispose();
    sceneSkip = null;
    if (storySkipButton) storySkipButton.hidden = true;
    characterDialog.close?.();
    characterDialog.removeAttribute("open");
    canvas.hidden = true;
    compatibilityError.hidden = false;
  }
}

resetProgressButton?.addEventListener("click", () => {
  requestGameReset({
    storage: window.localStorage,
    confirmReset: () => window.confirm("确定清除全部旅程进度并从头开始吗？此操作无法撤销。"),
    reload: () => window.location.reload(),
  });
});

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
  storyScene?.dispose();
  wishScene?.dispose();
  icebreakerFeature?.dispose();
  sceneSkip?.dispose();
  game?.dispose();
}, { once: true });
