import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("爬山剧情页面提供全屏媒体与底部问答节点", async () => {
  const [html, main, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../src/scenes/mountain/mountainScene.css", import.meta.url), "utf8"),
  ]);

  for (const id of [
    "mountain-scene-video",
    "mountain-scene-image",
    "mountain-scene-panel",
    "mountain-start",
    "mountain-play",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(main, new RegExp(`#${id}`));
  }
  assert.match(css, /object-fit:\s*cover/);
  assert.match(css, /\.mountain-scene__panel\s*\{[^}]*position:\s*absolute[^}]*bottom:/s);
});
