import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("地图包含相邻的破冰话术、个人说明书入口和单一游戏卡片", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const groupStart = html.indexOf('id="relationship-tools"');
  const icebreaker = html.indexOf('id="icebreaker-button"');
  const manual = html.indexOf('id="personal-manual-button"');
  assert.ok(groupStart >= 0);
  assert.ok(groupStart < icebreaker && icebreaker < manual);
  assert.match(html, /role="group"[^>]*aria-label="关系反馈工具"/s);
  assert.match(html, /id="relationship-card"[^>]*aria-labelledby="relationship-card-title"/s);
  assert.equal((html.match(/id="relationship-card"/g) ?? []).length, 1);
  assert.equal((html.match(/id="icebreaker-button"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /download|导出个人说明书|Word|PDF/i);
});

test("关系反馈卡片有独立样式、窄屏单列和可见焦点", async () => {
  const css = await readFile(
    new URL("../src/relationshipTools/relationshipTools.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.relationship-tools/);
  assert.match(css, /\.relationship-card/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /grid-template-columns:\s*1fr/);
});

test("关系工具在宽屏和紧凑桌面都与右上控制按钮水平居中", async () => {
  const css = await readFile(
    new URL("../src/relationshipTools/relationshipTools.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.relationship-tools\s*\{[^}]*top:\s*28px;[^}]*right:\s*230px;/s);
  assert.match(
    css,
    /@media\s*\(max-width:\s*1050px\),\s*\(max-height:\s*690px\)[\s\S]*?\.relationship-tools\s*\{[^}]*top:\s*22px;[^}]*right:\s*222px;/,
  );
});

test("地图主入口接入统一工具并在每次场景完成后刷新状态", async () => {
  const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(source, /createRelationshipTools/);
  assert.match(source, /loadState:\s*\(\)\s*=>\s*loadRelationshipState/);
  assert.match(source, /onSceneComplete:\s*\(\)\s*=>\s*relationshipTools\?\.refresh\(\)/);
  assert.doesNotMatch(source, /createIcebreakerFeature|icebreaker-dialog/);
});
