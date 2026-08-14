import assert from "node:assert/strict";
import test from "node:test";
import { buildFighter, demoCharacter, parseWitcherFile } from "../app/lib/witcher.ts";
import { createRng, d10, meleeBodyBonus, resolveAttack, rollExpression } from "../app/lib/combat.ts";

const settings = {
  explodingDice: true,
  armorAblation: true,
  criticals: true,
  aimedLocations: true,
  stopAtZero: true,
  seed: 1,
};

test("migrates legacy witcher stats without double-applying race bonuses", () => {
  const raw = demoCharacter("a");
  raw.schema = 2;
  raw.info = { race: "witcher", profession: "witcher" };
  raw.stats = { INT: 6, REF: 9, DEX: 8, BODY: 7, SPD: 6, EMP: 1, CRA: 5, WILL: 7, LUCK: 5 };
  const [{ character }] = parseWitcherFile(raw);
  const fighter = buildFighter(character);
  assert.equal(fighter.stats.REF, 9);
  assert.equal(fighter.stats.DEX, 8);
  assert.equal(fighter.stats.EMP, 1);
});

test("preserves valid zero current pools", () => {
  const raw = demoCharacter("a");
  raw.vitals = { hp: 0, sta: 0 };
  const fighter = buildFighter(parseWitcherFile(raw)[0].character);
  assert.equal(fighter.hp, 0);
  assert.equal(fighter.sta, 0);
});

test("layers armor starting with the real first layer", () => {
  const raw = demoCharacter("a");
  raw.info = { race: "human", profession: "man_at_arms" };
  raw.inventory = {
    weapons: [], ammo: [], gear: [],
    armor: [
      { name: "Кожа", location: "torso", sp: 8, spDamage: 0, equipped: true, enhancements: [] },
      { name: "Кольчуга", location: "torso", sp: 12, spDamage: 0, equipped: true, enhancements: [] },
    ],
  };
  const fighter = buildFighter(parseWitcherFile(raw)[0].character);
  assert.equal(fighter.armor.torso.sp, 17);
  assert.equal(fighter.armor.arms.sp, 17);
  assert.equal(fighter.armor.head.sp, 0);
});

test("derives exact punch damage and does not add BODY twice", () => {
  const raw = demoCharacter("a");
  raw.stats = { ...raw.stats, BODY: 8 };
  const fighter = buildFighter(parseWitcherFile(raw)[0].character);
  const punch = fighter.weapons.find((weapon) => weapon.category === "unarmed");
  assert.equal(punch?.damage, "1d6+2");
  assert.equal(meleeBodyBonus(8), 4);
  const opponent = buildFighter(parseWitcherFile(demoCharacter("b"))[0].character);
  for (const zone of Object.values(opponent.armor)) zone.sp = 0;
  const values = [0.5, 0, 0];
  const pending = resolveAttack({ fighters: [fighter, opponent], attacker: 0, weapon: punch, defenseMode: "none", strikeMode: "normal", locationChoice: "torso", modifier: 0, settings: { ...settings, criticals: false }, rng: () => values.shift() ?? 0 });
  assert.equal(pending.rolledDamage, 3);
});

test("rolls deterministic dice expressions", () => {
  const values = [0, 0.5, 0.999];
  assert.equal(rollExpression("3d6+2", () => values.shift() ?? 0).total, 13);
});

test("exploding d10 adds on 10 and subtracts on 1", () => {
  let upIndex = 0;
  const up = [0.999, 0.4];
  assert.equal(d10(() => up[upIndex++], true).total, 15);
  let i = 0;
  const down = [0, 0.4];
  assert.equal(d10(() => down[i++], true).total, -4);
});

test("strong strike doubles damage before armor and crit is added after location", () => {
  const attacker = buildFighter(parseWitcherFile(demoCharacter("a"))[0].character);
  const defender = buildFighter(parseWitcherFile(demoCharacter("b"))[0].character);
  defender.armor.head.sp = 10;
  const weapon = { ...attacker.weapons[0], damage: "1d6", category: "sword", bodyDamage: true };
  const values = [0.8, 0.999];
  const result = resolveAttack({ fighters: [attacker, defender], attacker: 0, weapon, defenseMode: "none", strikeMode: "strong", locationChoice: "head", modifier: 20, settings, rng: () => values.shift() ?? 0.5 });
  assert.equal(result.rolledDamage, 20);
  assert.equal(result.normalDamage, 30);
  assert.equal(result.criticalBonus, 10);
  assert.equal(result.finalDamage, 40);
});

test("extra attack penalty combines with the strong attack penalty", () => {
  const attacker = buildFighter(parseWitcherFile(demoCharacter("a"))[0].character);
  const defender = buildFighter(parseWitcherFile(demoCharacter("b"))[0].character);
  const weapon = { ...attacker.weapons[0], damage: "1d6" };
  const fast = resolveAttack({ fighters: [attacker, defender], attacker: 0, weapon, defenseMode: "none", strikeMode: "normal", locationChoice: "torso", modifier: -3, settings, rng: () => 0.5 });
  const strong = resolveAttack({ fighters: [attacker, defender], attacker: 0, weapon, defenseMode: "none", strikeMode: "strong", locationChoice: "torso", modifier: -3, settings, rng: () => 0.5 });
  assert.equal(fast.attackModifier, -3);
  assert.equal(strong.attackModifier, -6);
});
