import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the Duel Ledger product surface", async () => {
  const [html, entry, app, css, hosting] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/DuelApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="root"/);
  assert.match(entry, /<DuelApp \/>/);
  assert.match(app, /parseWitcherFile/);
  assert.match(app, /Бросить атаку/);
  assert.match(app, /Экспортировать результат/);
  assert.match(app, /Homebrew Content Policy/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /Duel Ledger/);
  assert.equal(JSON.parse(hosting).static, true);
});
