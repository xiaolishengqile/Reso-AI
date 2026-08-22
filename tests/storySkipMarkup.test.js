import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("剧情跳过按钮位于重来左侧并接入当前岛屿", async () => {
  const [html, main, styles] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.js", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);

  const skipIndex = html.indexOf('id="story-skip-button"');
  const resetIndex = html.indexOf('id="reset-progress-button"');
  assert.ok(skipIndex >= 0);
  assert.ok(skipIndex < resetIndex);
  assert.match(html, /aria-label="跳过当前剧情片段"/);
  assert.match(main, /createSceneSkip/);
  assert.match(main, /sceneSkip\.activate\(controller, callbacks\)/);
  assert.match(main, /sceneSkip\.show\(\)/);
  assert.match(styles, /\.story-skip-button/);
});
