import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Duel Ledger product surface", async () => {
  const [html, entry, app, css, workflow] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/DuelApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="root"/);
  assert.match(entry, /<DuelApp \/>/);
  assert.match(app, /parseWitcherFile/);
  assert.match(app, /Бросить атаку/);
  assert.match(app, /Быстрая \(до 2 за ход\)/);
  assert.match(app, /Дополнительная атака/);
  assert.match(app, /Для дополнительной атаки нужно 3 Выносливости/);
  assert.match(app, /Онлайн-комната/);
  assert.match(app, /choose_defense/);
  assert.match(app, /Копировать приглашение/);
  assert.match(app, /Экспортировать результат/);
  assert.match(app, /Homebrew Content Policy/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /Duel Ledger/);
  assert.match(workflow, /actions\/deploy-pages/);
});
