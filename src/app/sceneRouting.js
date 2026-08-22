import { getAllStories, getStory } from "../scenes/story/catalog.js";

export function getSceneController(sceneId, controllers = {}) {
  if (sceneId === "home") return controllers.home ?? null;
  if (sceneId === "mountain") return controllers.mountain ?? null;
  if (sceneId === "wish") return controllers.wish ?? null;
  return getStory(sceneId) ? controllers.story ?? null : null;
}

export function resolveSavedUnlockOrder({
  mountainProgress,
  storyProgress = {},
  stories = getAllStories(),
} = {}) {
  const mountainCompleted = Number.isFinite(mountainProgress?.firstCompletedAt)
    || mountainProgress?.completed === true;
  if (!mountainCompleted) return undefined;

  let unlockedOrder = 2;
  const orderedStories = [...stories].sort(
    (left, right) => left.unlockOrder - right.unlockOrder,
  );
  for (const story of orderedStories) {
    if (story.unlockOrder !== unlockedOrder) break;
    const progress = Array.isArray(storyProgress)
      ? storyProgress.find((item) => item?.islandId === story.id)
      : storyProgress?.[story.id];
    if (!Number.isFinite(progress?.firstCompletedAt)) break;
    unlockedOrder = story.unlocksOrder;
  }
  return unlockedOrder;
}
