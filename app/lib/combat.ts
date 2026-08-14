import type { LocationKey, PreparedFighter, Weapon } from "./witcher";

export type DefenseMode = "dodge" | "reposition" | "block" | "none";
export type StrikeMode = "normal" | "strong";

export type CombatSettings = {
  explodingDice: boolean;
  armorAblation: boolean;
  criticals: boolean;
  aimedLocations: boolean;
  stopAtZero: boolean;
  seed: number;
};

export type DiceRoll = { rolls: number[]; total: number; text: string };

export type PendingAttack = {
  attacker: 0 | 1;
  defender: 0 | 1;
  weapon: Weapon;
  defenseMode: DefenseMode;
  strikeMode: StrikeMode;
  location: LocationKey;
  attackRoll: DiceRoll;
  defenseRoll: DiceRoll | null;
  attackBase: number;
  defenseBase: number;
  attackModifier: number;
  aimedModifier: number;
  attackTotal: number;
  defenseTotal: number;
  hit: boolean;
  margin: number;
  damageRoll: DiceRoll | null;
  rolledDamage: number;
  armorSp: number;
  appliedArmorSp: number;
  multiplier: number;
  normalDamage: number;
  criticalBonus: number;
  criticalLevel: string | null;
  finalDamage: number;
  formula: string;
};

export type LogEntry = {
  id: string;
  round: number;
  turn: number;
  type: "system" | "roll" | "damage" | "condition";
  title: string;
  detail: string;
  createdAt: string;
};

export function createRng(seed: number) {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function d10(rng: () => number, exploding = true): DiceRoll {
  const first = Math.floor(rng() * 10) + 1;
  const rolls = [first];
  if (!exploding || (first !== 1 && first !== 10)) return { rolls, total: first, text: `1d10 (${first})` };
  let extra = Math.floor(rng() * 10) + 1;
  rolls.push(extra);
  let total = first === 10 ? 10 + extra : 1 - extra;
  let guard = 0;
  while (extra === 10 && guard < 20) {
    extra = Math.floor(rng() * 10) + 1;
    rolls.push(extra);
    total += first === 10 ? extra : -extra;
    guard += 1;
  }
  return { rolls, total, text: `d10 (${rolls.join(first === 10 ? " + " : " − ")})` };
}

export function rollExpression(expression: string, rng: () => number): DiceRoll {
  const compact = expression.toLowerCase().replace(/\s+/g, "");
  const match = compact.match(/^(\d*)d(\d+)([+-]\d+)?(?:\/(\d+))?$/);
  if (!match) {
    const flat = Number(compact);
    const total = Number.isFinite(flat) ? flat : 0;
    return { rolls: [], total, text: expression || "0" };
  }
  const count = Math.min(30, Math.max(1, Number(match[1] || 1)));
  const sides = Math.min(100, Math.max(2, Number(match[2])));
  const modifier = Number(match[3] || 0);
  const divisor = Math.max(1, Number(match[4] || 1));
  const rolls = Array.from({ length: count }, () => Math.floor(rng() * sides) + 1);
  const subtotal = rolls.reduce((sum, value) => sum + value, 0) + modifier;
  return { rolls, total: Math.floor(subtotal / divisor), text: `${expression} (${rolls.join(" + ")}${modifier ? ` ${modifier > 0 ? "+" : "−"} ${Math.abs(modifier)}` : ""})` };
}

export function rollLocation(rng: () => number): { location: LocationKey; label: string; roll: number; multiplier: number } {
  const roll = Math.floor(rng() * 10) + 1;
  if (roll === 1) return { location: "head", label: "Голова", roll, multiplier: 3 };
  if (roll <= 4) return { location: "torso", label: "Туловище", roll, multiplier: 1 };
  if (roll <= 6) return { location: "arms", label: roll === 5 ? "Правая рука" : "Левая рука", roll, multiplier: 0.5 };
  return { location: "legs", label: roll <= 8 ? "Правая нога" : "Левая нога", roll, multiplier: 0.5 };
}

export const AIM_MODIFIERS: Record<LocationKey | "random", number> = { random: 0, head: -6, torso: -1, arms: -3, legs: -2 };

function criticalForMargin(margin: number) {
  if (margin >= 15) return { level: "Смертельное", bonus: 10 };
  if (margin >= 13) return { level: "Тяжёлое", bonus: 8 };
  if (margin >= 10) return { level: "Сложное", bonus: 5 };
  if (margin >= 7) return { level: "Простое", bonus: 3 };
  return { level: null, bonus: 0 };
}

export function attackBase(fighter: PreparedFighter, weapon: Weapon) {
  return fighter.skills[weapon.attackSkill] ?? fighter.stats[weapon.category === "bow" || weapon.category === "crossbow" || weapon.category === "thrown" ? "DEX" : "REF"];
}

export function meleeBodyBonus(body: number) {
  if (body <= 2) return -2;
  if (body <= 4) return 0;
  if (body <= 6) return 2;
  if (body <= 8) return 4;
  if (body <= 10) return 6;
  if (body <= 12) return 8;
  return 10;
}

export function defenseBase(fighter: PreparedFighter, mode: DefenseMode, weapon?: Weapon) {
  if (mode === "none") return 10;
  if (mode === "reposition") return fighter.skills.athletics ?? fighter.stats.DEX;
  if (mode === "block") return fighter.skills[weapon?.attackSkill ?? "melee"] ?? fighter.stats.REF;
  return fighter.skills.dodge_escape ?? fighter.stats.REF;
}

export function resolveAttack(args: {
  fighters: [PreparedFighter, PreparedFighter]; attacker: 0 | 1; weapon: Weapon; defenseMode: DefenseMode; strikeMode: StrikeMode;
  locationChoice: LocationKey | "random"; modifier: number; settings: CombatSettings; rng: () => number;
}): PendingAttack {
  const { fighters, attacker, weapon, defenseMode, strikeMode, locationChoice, modifier, settings, rng } = args;
  const defender = attacker === 0 ? 1 : 0;
  const source = fighters[attacker];
  const target = fighters[defender];
  const attackRoll = d10(rng, settings.explodingDice);
  const defenseRoll = defenseMode === "none" ? null : d10(rng, settings.explodingDice);
  const location = locationChoice === "random" ? rollLocation(rng).location : locationChoice;
  const multiplier = location === "head" ? 3 : location === "torso" ? 1 : 0.5;
  const aimedModifier = settings.aimedLocations ? AIM_MODIFIERS[locationChoice] : 0;
  const strikeModifier = strikeMode === "strong" ? -3 : 0;
  const baseA = attackBase(source, weapon) + weapon.accuracy;
  const baseD = defenseBase(target, defenseMode, target.weapons[0]);
  const attackTotal = Math.max(0, baseA + modifier + aimedModifier + strikeModifier + attackRoll.total);
  const defenseTotal = defenseMode === "none" ? 10 : Math.max(0, baseD + (defenseRoll?.total ?? 0));
  const hit = attackTotal > defenseTotal;
  const margin = attackTotal - defenseTotal;
  const damageRoll = hit ? rollExpression(weapon.damage, rng) : null;
  const bodyBonus = weapon.bodyDamage ? meleeBodyBonus(source.stats.BODY) + source.meleeDamageBonus : 0;
  const rolledDamage = Math.max(0, ((damageRoll?.total ?? 0) + bodyBonus) * (strikeMode === "strong" ? 2 : 1));
  const armorSp = target.armor[location].sp;
  const normalizedEffects = weapon.effects.join(" ").toLowerCase();
  const improvedPiercing = /улучшенн.*пробив|improved.*pierc/.test(normalizedEffects);
  const appliedArmorSp = improvedPiercing ? Math.floor(armorSp / 2) : armorSp;
  const penetration = Math.max(0, rolledDamage - appliedArmorSp);
  const normalDamage = penetration > 0 ? Math.max(1, Math.floor(penetration * multiplier)) : 0;
  const critical = settings.criticals && hit ? criticalForMargin(margin) : { level: null, bonus: 0 };
  const finalDamage = hit ? normalDamage + critical.bonus : 0;
  const formula = hit
    ? `${damageRoll?.text ?? "0"}${bodyBonus ? ` ${bodyBonus > 0 ? "+" : "−"} Бонус ТЕЛ ${Math.abs(bodyBonus)}` : ""}${strikeMode === "strong" ? " × 2" : ""} − броня ${appliedArmorSp}; зона ×${multiplier} + крит ${critical.bonus} = ${finalDamage}`
    : `Атака ${attackTotal} ≤ защита ${defenseTotal}`;
  return { attacker, defender, weapon, defenseMode, strikeMode, location, attackRoll, defenseRoll, attackBase: baseA,
    defenseBase: baseD, attackModifier: modifier + strikeModifier, aimedModifier, attackTotal, defenseTotal, hit, margin,
    damageRoll, rolledDamage, armorSp, appliedArmorSp, multiplier, normalDamage, criticalBonus: critical.bonus,
    criticalLevel: critical.level, finalDamage, formula };
}

export function makeLog(round: number, turn: number, type: LogEntry["type"], title: string, detail: string): LogEntry {
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, round, turn, type, title, detail, createdAt: new Date().toISOString() };
}
