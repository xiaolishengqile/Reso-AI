import { officeStory } from "../office/storyContent.js";
import { diningStory } from "../dining/storyContent.js";
import { cohabitationStory } from "../cohabitation/storyContent.js";
import { moneyStory } from "../money/storyContent.js";
import { socialStory } from "../social/storyContent.js";
import { travelStory } from "../travel/storyContent.js";
import { futureStory } from "../future/storyContent.js";

const STORIES = Object.freeze([
  officeStory,
  diningStory,
  cohabitationStory,
  moneyStory,
  socialStory,
  travelStory,
  futureStory,
]);

const STORY_BY_ID = new Map(STORIES.map((story) => [story.id, story]));

export function getAllStories() {
  return STORIES;
}

export function getStory(storyId) {
  return STORY_BY_ID.get(storyId) ?? null;
}
