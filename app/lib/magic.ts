import type { PreparedFighter, StatKey } from "./witcher";

export type MagicSide = 0 | 1;
export type MagicCategory = "signs" | "spells" | "invocations" | "rituals";
export type MagicDefense = "resist_magic" | "dodge" | "none";
export type MagicTargetRule = "self" | "opponent" | "either";
export type MagicEffectTarget = "caster" | "target";
export type MagicPool = "hp" | "sta" | "vigor" | "resolve";
export type MagicConditionId = "burning" | "stunned" | "slowed" | "silenced" | "weakened" | "marked";

export const MAX_MAGIC_DISTANCE = 1_000;
export const MAX_MAGIC_DURATION = 100;
export const MAX_MAGIC_COST = 1_000;
export const MAX_MAGIC_EFFECTS = 20;

export type MagicCost = {
  vigor: number;
  stamina: number;
};

/** A bounded, data-only formula. It deliberately supports no executable expressions. */
export type MagicFormula = {
  dice: number;
  sides: number;
  bonus: number;
};

export type MagicRange = {
  min: number;
  max: number;
};

export type MagicCheck = {
  skill: string;
  fallbackStat: StatKey;
  defense: MagicDefense;
  difficulty: number;
  modifier: number;
};

export type MagicSustain = {
  vigorPerRound: number;
  staminaPerRound: number;
  maxRounds: number;
};

export type MagicDamageEffect = {
  type: "damage";
  target: MagicEffectTarget;
  pool: MagicPool;
  amount: MagicFormula;
  damageType: "force" | "fire" | "frost" | "lightning" | "spirit" | "poison";
  bypassArmor: boolean;
};

export type MagicHealEffect = {
  type: "heal";
  target: MagicEffectTarget;
  pool: MagicPool;
  amount: MagicFormula;
};

export type MagicArmorEffect = {
  type: "armor";
  target: MagicEffectTarget;
  amount: MagicFormula;
};

export type MagicConditionEffect = {
  type: "condition";
  target: MagicEffectTarget;
  condition: MagicConditionId;
  intensity: number;
};

export type MagicMovementEffect = {
  type: "movement";
  target: MagicEffectTarget;
  direction: "toward" | "away";
  meters: MagicFormula;
};

/** Closed union of inert effect data; no scripts, callbacks, or arbitrary property writes. */
export type MagicEffect =
  | MagicDamageEffect
  | MagicHealEffect
  | MagicArmorEffect
  | MagicConditionEffect
  | MagicMovementEffect;

export type MagicAbility = {
  id: string;
  name: string;
  description: string;
  category: MagicCategory;
  tags: string[];
  target: MagicTargetRule;
  cost: MagicCost;
  range: MagicRange;
  check: MagicCheck;
  effects: MagicEffect[];
  /** Effects applied instead of normal effects when the natural casting die is 1. */
  backfire: MagicEffect[];
  /** Default lifespan of armor and conditions; 0 means the ability is instant. */
  duration: number;
  /** When present, persistent effects last while this upkeep can be paid. */
  sustain: MagicSustain | null;
  /** Earliest re-use round is cast round + cooldown. */
  cooldown: number;
};

export type MagicSideState = {
  vigor: number;
  maxVigor: number;
  /** Ability id -> earliest round in which it may be used again. */
  cooldowns: Record<string, number>;
};

export type MagicArmorInstance = {
  id: string;
  sourceAbilityId: string;
  target: MagicSide;
  points: number;
  remainingRounds: number | null;
  sustainId: string | null;
};

export type MagicConditionInstance = {
  id: string;
  sourceAbilityId: string;
  target: MagicSide;
  condition: MagicConditionId;
  intensity: number;
  remainingRounds: number | null;
  sustainId: string | null;
};

export type MagicSustainInstance = {
  id: string;
  abilityId: string;
  caster: MagicSide;
  upkeep: MagicCost;
  remainingRounds: number;
};

export type MagicState = {
  round: number;
  /** Current separation of the two combatants in metres. */
  distance: number;
  sides: [MagicSideState, MagicSideState];
  armor: MagicArmorInstance[];
  conditions: MagicConditionInstance[];
  sustains: MagicSustainInstance[];
};

export type MagicDeclaration = {
  id: string;
  abilityId: string;
  caster: MagicSide;
  target: MagicSide;
};

export type MagicRoll = {
  rolls: number[];
  total: number;
  natural: number | null;
  text: string;
};

export type ResolvedMagicEffect =
  | (Omit<MagicDamageEffect, "target" | "amount"> & { target: MagicSide; amount: number; roll: MagicRoll })
  | (Omit<MagicHealEffect, "target" | "amount"> & { target: MagicSide; amount: number; roll: MagicRoll })
  | (Omit<MagicArmorEffect, "target" | "amount"> & { target: MagicSide; amount: number; roll: MagicRoll })
  | (Omit<MagicConditionEffect, "target"> & { target: MagicSide })
  | (Omit<MagicMovementEffect, "target" | "meters"> & { target: MagicSide; meters: number; roll: MagicRoll });

export type MagicResolution = {
  id: string;
  declaration: MagicDeclaration;
  abilityId: string;
  category: MagicCategory;
  round: number;
  outcome: "success" | "failure" | "backfire";
  attackRoll: MagicRoll;
  defenseRoll: MagicRoll | null;
  attackBase: number;
  defenseBase: number;
  attackTotal: number;
  defenseTotal: number;
  margin: number;
  cost: MagicCost;
  duration: number;
  sustain: MagicSustain | null;
  cooldownUntilRound: number;
  effects: ResolvedMagicEffect[];
};

export type MagicValidationCode =
  | "invalid_ability"
  | "invalid_state"
  | "invalid_declaration"
  | "invalid_resolution"
  | "wrong_ability"
  | "wrong_target"
  | "out_of_range"
  | "insufficient_vigor"
  | "insufficient_stamina"
  | "cooldown"
  | "casting_blocked"
  | "already_sustaining"
  | "stale_round";

export type MagicValidationIssue = {
  code: MagicValidationCode;
  path: string;
  message: string;
};

export type MagicValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: MagicValidationIssue[] };

export type MagicResolveResult =
  | { ok: true; resolution: MagicResolution }
  | { ok: false; issues: MagicValidationIssue[] };

export type MagicApplicationEvent = {
  type: "cost" | "damage" | "heal" | "armor" | "condition" | "movement" | "sustain" | "expire";
  target: MagicSide;
  amount: number;
  absorbed: number;
  sourceId: string;
  detail: string;
};

export type MagicApplicationResult =
  | {
      ok: true;
      fighters: [PreparedFighter, PreparedFighter];
      state: MagicState;
      events: MagicApplicationEvent[];
    }
  | { ok: false; issues: MagicValidationIssue[] };

export type MagicConditionDefinition = {
  blocksCasting: boolean;
  castingModifierPerIntensity: number;
  defenseModifierPerIntensity: number;
  damagePerRoundPerIntensity: number;
};

export const MAGIC_CONDITIONS: Readonly<Record<MagicConditionId, MagicConditionDefinition>> = {
  burning: { blocksCasting: false, castingModifierPerIntensity: 0, defenseModifierPerIntensity: 0, damagePerRoundPerIntensity: 1 },
  stunned: { blocksCasting: false, castingModifierPerIntensity: -1, defenseModifierPerIntensity: -1, damagePerRoundPerIntensity: 0 },
  slowed: { blocksCasting: false, castingModifierPerIntensity: 0, defenseModifierPerIntensity: -1, damagePerRoundPerIntensity: 0 },
  silenced: { blocksCasting: true, castingModifierPerIntensity: 0, defenseModifierPerIntensity: 0, damagePerRoundPerIntensity: 0 },
  weakened: { blocksCasting: false, castingModifierPerIntensity: -1, defenseModifierPerIntensity: 0, damagePerRoundPerIntensity: 0 },
  marked: { blocksCasting: false, castingModifierPerIntensity: 0, defenseModifierPerIntensity: -1, damagePerRoundPerIntensity: 0 },
};

const constant = (bonus: number): MagicFormula => ({ dice: 0, sides: 6, bonus });
const dice = (count: number, sides: number, bonus = 0): MagicFormula => ({ dice: count, sides, bonus });

/**
 * Original, deliberately compact presets for the simulator. They demonstrate
 * every safe effect and category without reproducing any proprietary spell table.
 */
export const BUILTIN_MAGIC_ABILITIES: readonly MagicAbility[] = [
  {
    id: "signs_force_pulse",
    name: "Импульс силы",
    description: "Короткая волна отталкивает цель и сбивает её темп.",
    category: "signs",
    tags: ["force", "control"],
    target: "opponent",
    cost: { vigor: 1, stamina: 1 },
    range: { min: 0, max: 6 },
    check: { skill: "spell_casting", fallbackStat: "WILL", defense: "dodge", difficulty: 10, modifier: 0 },
    effects: [
      { type: "movement", target: "target", direction: "away", meters: constant(3) },
      { type: "condition", target: "target", condition: "slowed", intensity: 1 },
    ],
    backfire: [{ type: "damage", target: "caster", pool: "sta", amount: constant(2), damageType: "force", bypassArmor: true }],
    duration: 1,
    sustain: null,
    cooldown: 0,
  },
  {
    id: "signs_ember_lash",
    name: "Искровой хлыст",
    description: "Узкая огненная дуга наносит урон и оставляет краткое горение.",
    category: "signs",
    tags: ["fire", "damage"],
    target: "opponent",
    cost: { vigor: 2, stamina: 1 },
    range: { min: 0, max: 8 },
    check: { skill: "spell_casting", fallbackStat: "WILL", defense: "dodge", difficulty: 10, modifier: 0 },
    effects: [
      { type: "damage", target: "target", pool: "hp", amount: dice(2, 6), damageType: "fire", bypassArmor: false },
      { type: "condition", target: "target", condition: "burning", intensity: 1 },
    ],
    backfire: [{ type: "damage", target: "caster", pool: "hp", amount: dice(1, 6), damageType: "fire", bypassArmor: true }],
    duration: 2,
    sustain: null,
    cooldown: 1,
  },
  {
    id: "spells_arcane_bolt",
    name: "Чародейская стрела",
    description: "Сгусток чистой силы пробует продавить магическую защиту цели.",
    category: "spells",
    tags: ["force", "damage"],
    target: "opponent",
    cost: { vigor: 3, stamina: 2 },
    range: { min: 1, max: 15 },
    check: { skill: "spell_casting", fallbackStat: "WILL", defense: "resist_magic", difficulty: 10, modifier: 1 },
    effects: [{ type: "damage", target: "target", pool: "hp", amount: dice(3, 6), damageType: "force", bypassArmor: false }],
    backfire: [{ type: "damage", target: "caster", pool: "vigor", amount: constant(2), damageType: "spirit", bypassArmor: true }],
    duration: 0,
    sustain: null,
    cooldown: 1,
  },
  {
    id: "spells_mending_light",
    name: "Целительный свет",
    description: "Стабилизирует раны выбранного бойца без снятия критических травм.",
    category: "spells",
    tags: ["healing"],
    target: "either",
    cost: { vigor: 3, stamina: 3 },
    range: { min: 0, max: 4 },
    check: { skill: "spell_casting", fallbackStat: "WILL", defense: "none", difficulty: 12, modifier: 0 },
    effects: [{ type: "heal", target: "target", pool: "hp", amount: dice(2, 6, 2) }],
    backfire: [{ type: "damage", target: "caster", pool: "sta", amount: dice(1, 6), damageType: "spirit", bypassArmor: true }],
    duration: 0,
    sustain: null,
    cooldown: 2,
  },
  {
    id: "invocations_guardian_veil",
    name: "Покров хранителя",
    description: "Создаёт истощаемый слой магической брони вокруг выбранного бойца.",
    category: "invocations",
    tags: ["protection"],
    target: "either",
    cost: { vigor: 4, stamina: 2 },
    range: { min: 0, max: 6 },
    check: { skill: "hex_weaving", fallbackStat: "WILL", defense: "none", difficulty: 12, modifier: 0 },
    effects: [{ type: "armor", target: "target", amount: constant(8) }],
    backfire: [{ type: "condition", target: "caster", condition: "weakened", intensity: 1 }],
    duration: 3,
    sustain: null,
    cooldown: 2,
  },
  {
    id: "invocations_binding_word",
    name: "Сковывающее слово",
    description: "Кратко мешает цели сосредоточиться на магии.",
    category: "invocations",
    tags: ["control", "silence"],
    target: "opponent",
    cost: { vigor: 4, stamina: 2 },
    range: { min: 0, max: 10 },
    check: { skill: "hex_weaving", fallbackStat: "WILL", defense: "resist_magic", difficulty: 10, modifier: 0 },
    effects: [
      { type: "damage", target: "target", pool: "resolve", amount: dice(1, 6), damageType: "spirit", bypassArmor: true },
      { type: "condition", target: "target", condition: "silenced", intensity: 1 },
    ],
    backfire: [{ type: "condition", target: "caster", condition: "silenced", intensity: 1 }],
    duration: 1,
    sustain: null,
    cooldown: 2,
  },
  {
    id: "rituals_sustained_circle",
    name: "Удерживаемый круг",
    description: "Поддерживаемая печать создаёт броню, пока хватает ресурсов на подпитку.",
    category: "rituals",
    tags: ["protection", "sustain"],
    target: "self",
    cost: { vigor: 4, stamina: 3 },
    range: { min: 0, max: 0 },
    check: { skill: "ritual_crafting", fallbackStat: "WILL", defense: "none", difficulty: 13, modifier: 0 },
    effects: [{ type: "armor", target: "caster", amount: constant(6) }],
    backfire: [{ type: "damage", target: "caster", pool: "vigor", amount: constant(3), damageType: "spirit", bypassArmor: true }],
    duration: 0,
    sustain: { vigorPerRound: 1, staminaPerRound: 1, maxRounds: 5 },
    cooldown: 3,
  },
  {
    id: "rituals_repelling_field",
    name: "Отталкивающее поле",
    description: "Разворачивает пространство между бойцами и замедляет противника.",
    category: "rituals",
    tags: ["force", "control"],
    target: "opponent",
    cost: { vigor: 5, stamina: 4 },
    range: { min: 0, max: 12 },
    check: { skill: "ritual_crafting", fallbackStat: "WILL", defense: "dodge", difficulty: 10, modifier: -1 },
    effects: [
      { type: "movement", target: "target", direction: "away", meters: constant(5) },
      { type: "condition", target: "target", condition: "slowed", intensity: 2 },
    ],
    backfire: [{ type: "movement", target: "caster", direction: "away", meters: constant(3) }],
    duration: 2,
    sustain: null,
    cooldown: 3,
  },
];

export function canFighterUseMagicAbility(fighter: PreparedFighter, ability: MagicAbility): boolean {
  if (fighter.maxVigor <= 0) return false;
  const categories = new Set<MagicCategory>();
  for (const known of fighter.magic) {
    if (known.kind === "sign") categories.add("signs");
    if (known.kind === "spell" || known.kind === "hex") categories.add("spells");
    if (known.kind === "invocation") categories.add("invocations");
    if (known.kind === "ritual") categories.add("rituals");
  }
  if (!categories.size) {
    if (fighter.profession === "witcher") categories.add("signs");
    if (fighter.profession === "mage") { categories.add("spells"); categories.add("rituals"); }
    if (fighter.profession === "priest") { categories.add("invocations"); categories.add("rituals"); }
  }
  return categories.has(ability.category);
}

type JsonRecord = Record<string, unknown>;

const ABILITY_KEYS = new Set(["id", "name", "description", "category", "tags", "target", "cost", "range", "check", "effects", "backfire", "duration", "sustain", "cooldown"]);
const COST_KEYS = new Set(["vigor", "stamina"]);
const RANGE_KEYS = new Set(["min", "max"]);
const CHECK_KEYS = new Set(["skill", "fallbackStat", "defense", "difficulty", "modifier"]);
const SUSTAIN_KEYS = new Set(["vigorPerRound", "staminaPerRound", "maxRounds"]);
const FORMULA_KEYS = new Set(["dice", "sides", "bonus"]);
const DECLARATION_KEYS = new Set(["id", "abilityId", "caster", "target"]);
const STATE_KEYS = new Set(["round", "distance", "sides", "armor", "conditions", "sustains"]);
const SIDE_STATE_KEYS = new Set(["vigor", "maxVigor", "cooldowns"]);
const ARMOR_INSTANCE_KEYS = new Set(["id", "sourceAbilityId", "target", "points", "remainingRounds", "sustainId"]);
const CONDITION_INSTANCE_KEYS = new Set(["id", "sourceAbilityId", "target", "condition", "intensity", "remainingRounds", "sustainId"]);
const SUSTAIN_INSTANCE_KEYS = new Set(["id", "abilityId", "caster", "upkeep", "remainingRounds"]);
const MAGIC_CATEGORIES = new Set<MagicCategory>(["signs", "spells", "invocations", "rituals"]);
const MAGIC_DEFENSES = new Set<MagicDefense>(["resist_magic", "dodge", "none"]);
const MAGIC_TARGET_RULES = new Set<MagicTargetRule>(["self", "opponent", "either"]);
const EFFECT_TARGETS = new Set<MagicEffectTarget>(["caster", "target"]);
const MAGIC_POOLS = new Set<MagicPool>(["hp", "sta", "vigor", "resolve"]);
const CONDITION_IDS = new Set<MagicConditionId>(["burning", "stunned", "slowed", "silenced", "weakened", "marked"]);
const STAT_KEYS = new Set<StatKey>(["INT", "REF", "DEX", "BODY", "SPD", "EMP", "CRA", "WILL", "LUCK"]);
const DAMAGE_TYPES = new Set(["force", "fire", "frost", "lightning", "spirit", "poison"]);
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, keys: ReadonlySet<string>): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isSide(value: unknown): value is MagicSide {
  return value === 0 || value === 1;
}

function issue(code: MagicValidationCode, path: string, message: string): MagicValidationIssue {
  return { code, path, message };
}

function validateCost(value: unknown, path: string, issues: MagicValidationIssue[]): value is MagicCost {
  if (!isRecord(value) || !hasExactKeys(value, COST_KEYS)) {
    issues.push(issue("invalid_ability", path, "Cost must contain only vigor and stamina."));
    return false;
  }
  if (!isIntegerIn(value.vigor, 0, MAX_MAGIC_COST)) issues.push(issue("invalid_ability", `${path}.vigor`, "Vigor cost is out of bounds."));
  if (!isIntegerIn(value.stamina, 0, MAX_MAGIC_COST)) issues.push(issue("invalid_ability", `${path}.stamina`, "Stamina cost is out of bounds."));
  return issues.every((entry) => !entry.path.startsWith(path));
}

function validateFormula(value: unknown, path: string, issues: MagicValidationIssue[]): value is MagicFormula {
  const before = issues.length;
  if (!isRecord(value) || !hasExactKeys(value, FORMULA_KEYS)) {
    issues.push(issue("invalid_ability", path, "Formula must contain only dice, sides, and bonus."));
    return false;
  }
  if (!isIntegerIn(value.dice, 0, 20)) issues.push(issue("invalid_ability", `${path}.dice`, "A formula may roll between 0 and 20 dice."));
  if (!isIntegerIn(value.sides, 2, 100)) issues.push(issue("invalid_ability", `${path}.sides`, "Die size must be between 2 and 100."));
  if (!isIntegerIn(value.bonus, -1_000, 1_000)) issues.push(issue("invalid_ability", `${path}.bonus`, "Formula bonus is out of bounds."));
  return issues.length === before;
}

function validateEffect(value: unknown, path: string, issues: MagicValidationIssue[], backfire: boolean): value is MagicEffect {
  if (!isRecord(value) || typeof value.type !== "string") {
    issues.push(issue("invalid_ability", path, "Effect must be an object with a supported type."));
    return false;
  }
  const targetValid = EFFECT_TARGETS.has(value.target as MagicEffectTarget);
  if (!targetValid) issues.push(issue("invalid_ability", `${path}.target`, "Effect target is unsupported."));
  if (backfire && value.target !== "caster") issues.push(issue("invalid_ability", `${path}.target`, "Backfire effects must target the caster."));

  switch (value.type) {
    case "damage": {
      const keys = new Set(["type", "target", "pool", "amount", "damageType", "bypassArmor"]);
      if (!hasExactKeys(value, keys)) issues.push(issue("invalid_ability", path, "Damage effect contains unexpected fields."));
      if (!MAGIC_POOLS.has(value.pool as MagicPool)) issues.push(issue("invalid_ability", `${path}.pool`, "Damage pool is unsupported."));
      validateFormula(value.amount, `${path}.amount`, issues);
      if (!DAMAGE_TYPES.has(value.damageType as string)) issues.push(issue("invalid_ability", `${path}.damageType`, "Damage type is unsupported."));
      if (typeof value.bypassArmor !== "boolean") issues.push(issue("invalid_ability", `${path}.bypassArmor`, "bypassArmor must be boolean."));
      break;
    }
    case "heal": {
      const keys = new Set(["type", "target", "pool", "amount"]);
      if (!hasExactKeys(value, keys)) issues.push(issue("invalid_ability", path, "Heal effect contains unexpected fields."));
      if (!MAGIC_POOLS.has(value.pool as MagicPool)) issues.push(issue("invalid_ability", `${path}.pool`, "Healing pool is unsupported."));
      validateFormula(value.amount, `${path}.amount`, issues);
      break;
    }
    case "armor": {
      const keys = new Set(["type", "target", "amount"]);
      if (!hasExactKeys(value, keys)) issues.push(issue("invalid_ability", path, "Armor effect contains unexpected fields."));
      validateFormula(value.amount, `${path}.amount`, issues);
      break;
    }
    case "condition": {
      const keys = new Set(["type", "target", "condition", "intensity"]);
      if (!hasExactKeys(value, keys)) issues.push(issue("invalid_ability", path, "Condition effect contains unexpected fields."));
      if (!CONDITION_IDS.has(value.condition as MagicConditionId)) issues.push(issue("invalid_ability", `${path}.condition`, "Condition is unsupported."));
      if (!isIntegerIn(value.intensity, 1, 100)) issues.push(issue("invalid_ability", `${path}.intensity`, "Condition intensity is out of bounds."));
      break;
    }
    case "movement": {
      const keys = new Set(["type", "target", "direction", "meters"]);
      if (!hasExactKeys(value, keys)) issues.push(issue("invalid_ability", path, "Movement effect contains unexpected fields."));
      if (value.direction !== "toward" && value.direction !== "away") issues.push(issue("invalid_ability", `${path}.direction`, "Movement direction is unsupported."));
      validateFormula(value.meters, `${path}.meters`, issues);
      break;
    }
    default:
      issues.push(issue("invalid_ability", `${path}.type`, "Effect type is unsupported."));
      return false;
  }
  return targetValid;
}

export function validateMagicAbility(value: unknown): MagicValidationResult<MagicAbility> {
  const issues: MagicValidationIssue[] = [];
  if (!isRecord(value) || !hasExactKeys(value, ABILITY_KEYS)) {
    return { ok: false, issues: [issue("invalid_ability", "ability", "Ability has missing or unexpected fields.")] };
  }
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) issues.push(issue("invalid_ability", "ability.id", "Ability id is invalid."));
  if (typeof value.name !== "string" || value.name.length < 1 || value.name.length > 200) issues.push(issue("invalid_ability", "ability.name", "Ability name is invalid."));
  if (typeof value.description !== "string" || value.description.length > 2_000) issues.push(issue("invalid_ability", "ability.description", "Ability description is too long."));
  if (!MAGIC_CATEGORIES.has(value.category as MagicCategory)) issues.push(issue("invalid_ability", "ability.category", "Magic category is unsupported."));
  if (!Array.isArray(value.tags) || value.tags.length > 20 || !value.tags.every((tag) => typeof tag === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(tag))) {
    issues.push(issue("invalid_ability", "ability.tags", "Tags must be short safe identifiers."));
  }
  if (!MAGIC_TARGET_RULES.has(value.target as MagicTargetRule)) issues.push(issue("invalid_ability", "ability.target", "Target rule is unsupported."));
  validateCost(value.cost, "ability.cost", issues);

  if (!isRecord(value.range) || !hasExactKeys(value.range, RANGE_KEYS)) {
    issues.push(issue("invalid_ability", "ability.range", "Range must contain min and max."));
  } else {
    if (!isFiniteNumber(value.range.min) || value.range.min < 0 || value.range.min > MAX_MAGIC_DISTANCE) issues.push(issue("invalid_ability", "ability.range.min", "Minimum range is invalid."));
    if (!isFiniteNumber(value.range.max) || value.range.max < 0 || value.range.max > MAX_MAGIC_DISTANCE) issues.push(issue("invalid_ability", "ability.range.max", "Maximum range is invalid."));
    if (isFiniteNumber(value.range.min) && isFiniteNumber(value.range.max) && value.range.min > value.range.max) issues.push(issue("invalid_ability", "ability.range", "Minimum range cannot exceed maximum range."));
  }

  if (!isRecord(value.check) || !hasExactKeys(value.check, CHECK_KEYS)) {
    issues.push(issue("invalid_ability", "ability.check", "Check configuration is invalid."));
  } else {
    if (typeof value.check.skill !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value.check.skill)) issues.push(issue("invalid_ability", "ability.check.skill", "Casting skill id is invalid."));
    if (!STAT_KEYS.has(value.check.fallbackStat as StatKey)) issues.push(issue("invalid_ability", "ability.check.fallbackStat", "Fallback stat is invalid."));
    if (!MAGIC_DEFENSES.has(value.check.defense as MagicDefense)) issues.push(issue("invalid_ability", "ability.check.defense", "Defense is unsupported."));
    if (!isIntegerIn(value.check.difficulty, 0, 100)) issues.push(issue("invalid_ability", "ability.check.difficulty", "Difficulty is out of bounds."));
    if (!isIntegerIn(value.check.modifier, -100, 100)) issues.push(issue("invalid_ability", "ability.check.modifier", "Casting modifier is out of bounds."));
  }

  for (const [key, isBackfire] of [["effects", false], ["backfire", true]] as const) {
    const effects = value[key];
    if (!Array.isArray(effects) || effects.length > MAX_MAGIC_EFFECTS || (key === "effects" && effects.length === 0)) {
      issues.push(issue("invalid_ability", `ability.${key}`, `${key} must be a bounded non-empty list for normal effects.`));
    } else {
      effects.forEach((effect, index) => validateEffect(effect, `ability.${key}[${index}]`, issues, isBackfire));
    }
  }

  if (!isIntegerIn(value.duration, 0, MAX_MAGIC_DURATION)) issues.push(issue("invalid_ability", "ability.duration", "Duration is out of bounds."));
  if (value.sustain !== null) {
    if (!isRecord(value.sustain) || !hasExactKeys(value.sustain, SUSTAIN_KEYS)) {
      issues.push(issue("invalid_ability", "ability.sustain", "Sustain configuration is invalid."));
    } else {
      if (!isIntegerIn(value.sustain.vigorPerRound, 0, MAX_MAGIC_COST)) issues.push(issue("invalid_ability", "ability.sustain.vigorPerRound", "Sustain Vigor is out of bounds."));
      if (!isIntegerIn(value.sustain.staminaPerRound, 0, MAX_MAGIC_COST)) issues.push(issue("invalid_ability", "ability.sustain.staminaPerRound", "Sustain stamina is out of bounds."));
      if (!isIntegerIn(value.sustain.maxRounds, 1, MAX_MAGIC_DURATION)) issues.push(issue("invalid_ability", "ability.sustain.maxRounds", "Sustain duration is out of bounds."));
    }
  }
  if (!isIntegerIn(value.cooldown, 0, MAX_MAGIC_DURATION)) issues.push(issue("invalid_ability", "ability.cooldown", "Cooldown is out of bounds."));

  const normalPersistent = (Array.isArray(value.effects) ? value.effects : [])
    .some((effect) => isRecord(effect) && (effect.type === "armor" || effect.type === "condition"));
  const backfirePersistent = (Array.isArray(value.backfire) ? value.backfire : [])
    .some((effect) => isRecord(effect) && (effect.type === "armor" || effect.type === "condition"));
  if (normalPersistent && value.duration === 0 && value.sustain === null) {
    issues.push(issue("invalid_ability", "ability.duration", "Armor and conditions require duration or sustain."));
  }
  if (backfirePersistent && value.duration === 0) issues.push(issue("invalid_ability", "ability.duration", "Persistent backfire effects require a numeric duration."));
  return issues.length ? { ok: false, issues } : { ok: true, value: value as MagicAbility };
}

function validDurationLink(remainingRounds: unknown, sustainId: unknown): boolean {
  if (sustainId === null) return isIntegerIn(remainingRounds, 1, MAX_MAGIC_DURATION);
  return typeof sustainId === "string" && ID_PATTERN.test(sustainId) && remainingRounds === null;
}

export function validateMagicState(value: unknown): MagicValidationResult<MagicState> {
  const issues: MagicValidationIssue[] = [];
  if (!isRecord(value) || !hasExactKeys(value, STATE_KEYS)) {
    return { ok: false, issues: [issue("invalid_state", "state", "Magic state has missing or unexpected fields.")] };
  }
  if (!isIntegerIn(value.round, 1, Number.MAX_SAFE_INTEGER)) issues.push(issue("invalid_state", "state.round", "Round is invalid."));
  if (!isFiniteNumber(value.distance) || value.distance < 0 || value.distance > MAX_MAGIC_DISTANCE) issues.push(issue("invalid_state", "state.distance", "Distance is invalid."));

  if (!Array.isArray(value.sides) || value.sides.length !== 2) {
    issues.push(issue("invalid_state", "state.sides", "Exactly two magic side states are required."));
  } else {
    value.sides.forEach((side, index) => {
      const path = `state.sides[${index}]`;
      if (!isRecord(side) || !hasExactKeys(side, SIDE_STATE_KEYS)) {
        issues.push(issue("invalid_state", path, "Magic side state is invalid."));
        return;
      }
      if (!isFiniteNumber(side.vigor) || side.vigor < 0) issues.push(issue("invalid_state", `${path}.vigor`, "Vigor is invalid."));
      if (!isFiniteNumber(side.maxVigor) || side.maxVigor < 0 || (isFiniteNumber(side.vigor) && side.vigor > side.maxVigor)) issues.push(issue("invalid_state", `${path}.maxVigor`, "Maximum Vigor is invalid."));
      if (!isRecord(side.cooldowns) || Object.entries(side.cooldowns).some(([id, ready]) => !ID_PATTERN.test(id) || !isIntegerIn(ready, 1, Number.MAX_SAFE_INTEGER))) {
        issues.push(issue("invalid_state", `${path}.cooldowns`, "Cooldown map is invalid."));
      }
    });
  }

  const ids = new Set<string>();
  const sustainIds = new Set<string>();
  if (!Array.isArray(value.sustains) || value.sustains.length > 100) {
    issues.push(issue("invalid_state", "state.sustains", "Sustain list is invalid."));
  } else {
    value.sustains.forEach((entry, index) => {
      const path = `state.sustains[${index}]`;
      if (!isRecord(entry) || !hasExactKeys(entry, SUSTAIN_INSTANCE_KEYS)) {
        issues.push(issue("invalid_state", path, "Sustain entry is invalid."));
        return;
      }
      if (typeof entry.id !== "string" || !ID_PATTERN.test(entry.id) || ids.has(entry.id)) issues.push(issue("invalid_state", `${path}.id`, "Sustain id is invalid or duplicated."));
      else { ids.add(entry.id); sustainIds.add(entry.id); }
      if (typeof entry.abilityId !== "string" || !ID_PATTERN.test(entry.abilityId)) issues.push(issue("invalid_state", `${path}.abilityId`, "Ability id is invalid."));
      if (!isSide(entry.caster)) issues.push(issue("invalid_state", `${path}.caster`, "Sustain caster is invalid."));
      validateStateCost(entry.upkeep, `${path}.upkeep`, issues);
      if (!isIntegerIn(entry.remainingRounds, 1, MAX_MAGIC_DURATION)) issues.push(issue("invalid_state", `${path}.remainingRounds`, "Remaining sustain duration is invalid."));
    });
  }

  if (!Array.isArray(value.armor) || value.armor.length > 200) {
    issues.push(issue("invalid_state", "state.armor", "Magic armor list is invalid."));
  } else {
    value.armor.forEach((entry, index) => {
      const path = `state.armor[${index}]`;
      if (!isRecord(entry) || !hasExactKeys(entry, ARMOR_INSTANCE_KEYS)) {
        issues.push(issue("invalid_state", path, "Magic armor entry is invalid."));
        return;
      }
      validateInstanceIdentity(entry, path, ids, issues);
      if (!isSide(entry.target)) issues.push(issue("invalid_state", `${path}.target`, "Armor target is invalid."));
      if (!isFiniteNumber(entry.points) || entry.points < 0 || entry.points > 100_000) issues.push(issue("invalid_state", `${path}.points`, "Armor points are invalid."));
      if (!validDurationLink(entry.remainingRounds, entry.sustainId)) issues.push(issue("invalid_state", `${path}.remainingRounds`, "Armor duration link is invalid."));
      if (typeof entry.sustainId === "string" && !sustainIds.has(entry.sustainId)) issues.push(issue("invalid_state", `${path}.sustainId`, "Armor references an unknown sustain."));
    });
  }

  if (!Array.isArray(value.conditions) || value.conditions.length > 200) {
    issues.push(issue("invalid_state", "state.conditions", "Condition list is invalid."));
  } else {
    value.conditions.forEach((entry, index) => {
      const path = `state.conditions[${index}]`;
      if (!isRecord(entry) || !hasExactKeys(entry, CONDITION_INSTANCE_KEYS)) {
        issues.push(issue("invalid_state", path, "Condition entry is invalid."));
        return;
      }
      validateInstanceIdentity(entry, path, ids, issues);
      if (!isSide(entry.target)) issues.push(issue("invalid_state", `${path}.target`, "Condition target is invalid."));
      if (!CONDITION_IDS.has(entry.condition as MagicConditionId)) issues.push(issue("invalid_state", `${path}.condition`, "Condition is unsupported."));
      if (!isIntegerIn(entry.intensity, 1, 100)) issues.push(issue("invalid_state", `${path}.intensity`, "Condition intensity is invalid."));
      if (!validDurationLink(entry.remainingRounds, entry.sustainId)) issues.push(issue("invalid_state", `${path}.remainingRounds`, "Condition duration link is invalid."));
      if (typeof entry.sustainId === "string" && !sustainIds.has(entry.sustainId)) issues.push(issue("invalid_state", `${path}.sustainId`, "Condition references an unknown sustain."));
    });
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: value as MagicState };
}

function validateStateCost(value: unknown, path: string, issues: MagicValidationIssue[]): void {
  if (!isRecord(value) || !hasExactKeys(value, COST_KEYS)
    || !isIntegerIn(value.vigor, 0, MAX_MAGIC_COST)
    || !isIntegerIn(value.stamina, 0, MAX_MAGIC_COST)) {
    issues.push(issue("invalid_state", path, "Resource cost is invalid."));
  }
}

function validateInstanceIdentity(value: JsonRecord, path: string, ids: Set<string>, issues: MagicValidationIssue[]): void {
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id) || ids.has(value.id)) issues.push(issue("invalid_state", `${path}.id`, "Instance id is invalid or duplicated."));
  else ids.add(value.id);
  if (typeof value.sourceAbilityId !== "string" || !ID_PATTERN.test(value.sourceAbilityId)) issues.push(issue("invalid_state", `${path}.sourceAbilityId`, "Source ability id is invalid."));
}

export type CreateMagicStateOptions = {
  maxVigor?: [number, number];
  currentVigor?: [number, number];
  distance?: number;
  round?: number;
};

/** Generic simulator defaults; callers may replace them with campaign-specific values. */
export function createMagicState(options: CreateMagicStateOptions = {}): MagicState {
  const maxVigor: [number, number] = options.maxVigor ?? [5, 5];
  const current: [number, number] = options.currentVigor ?? [...maxVigor];
  return {
    round: options.round ?? 1,
    distance: options.distance ?? 2,
    sides: [
      { vigor: Math.max(0, Math.min(maxVigor[0], current[0])), maxVigor: Math.max(0, maxVigor[0]), cooldowns: {} },
      { vigor: Math.max(0, Math.min(maxVigor[1], current[1])), maxVigor: Math.max(0, maxVigor[1]), cooldowns: {} },
    ],
    armor: [],
    conditions: [],
    sustains: [],
  };
}

function validateDeclarationShape(value: unknown, issues: MagicValidationIssue[]): value is MagicDeclaration {
  const before = issues.length;
  if (!isRecord(value) || !hasExactKeys(value, DECLARATION_KEYS)) {
    issues.push(issue("invalid_declaration", "declaration", "Declaration has missing or unexpected fields."));
    return false;
  }
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) issues.push(issue("invalid_declaration", "declaration.id", "Declaration id is invalid."));
  if (typeof value.abilityId !== "string" || !ID_PATTERN.test(value.abilityId)) issues.push(issue("invalid_declaration", "declaration.abilityId", "Ability id is invalid."));
  if (!isSide(value.caster)) issues.push(issue("invalid_declaration", "declaration.caster", "Caster side is invalid."));
  if (!isSide(value.target)) issues.push(issue("invalid_declaration", "declaration.target", "Target side is invalid."));
  return issues.length === before;
}

export type ValidateMagicDeclarationArgs = {
  ability: MagicAbility;
  declaration: MagicDeclaration;
  fighters: [PreparedFighter, PreparedFighter];
  state: MagicState;
};

export function validateMagicDeclaration(args: ValidateMagicDeclarationArgs): MagicValidationResult<MagicDeclaration> {
  const issues: MagicValidationIssue[] = [];
  const abilityValidation = validateMagicAbility(args.ability);
  if (!abilityValidation.ok) issues.push(...abilityValidation.issues);
  const stateValidation = validateMagicState(args.state);
  if (!stateValidation.ok) issues.push(...stateValidation.issues);
  const declarationValid = validateDeclarationShape(args.declaration, issues);
  if (!abilityValidation.ok || !stateValidation.ok || !declarationValid) return { ok: false, issues };

  const { ability, declaration, fighters, state } = args;
  if (declaration.abilityId !== ability.id) issues.push(issue("wrong_ability", "declaration.abilityId", "Declaration does not reference the supplied ability."));
  if (ability.target === "self" && declaration.target !== declaration.caster) issues.push(issue("wrong_target", "declaration.target", "This ability targets only its caster."));
  if (ability.target === "opponent" && declaration.target === declaration.caster) issues.push(issue("wrong_target", "declaration.target", "This ability requires the opposing fighter."));
  if (declaration.target !== declaration.caster && (state.distance < ability.range.min || state.distance > ability.range.max)) {
    issues.push(issue("out_of_range", "state.distance", "Target is outside the ability range."));
  }

  const casterMagic = state.sides[declaration.caster];
  const caster = fighters[declaration.caster];
  if (casterMagic.vigor < ability.cost.vigor) issues.push(issue("insufficient_vigor", `state.sides[${declaration.caster}].vigor`, "Caster does not have enough Vigor."));
  if (caster.sta < ability.cost.stamina) issues.push(issue("insufficient_stamina", `fighters[${declaration.caster}].sta`, "Caster does not have enough stamina."));
  if (state.round < (casterMagic.cooldowns[ability.id] ?? 0)) issues.push(issue("cooldown", `state.sides[${declaration.caster}].cooldowns`, "Ability is still on cooldown."));
  if (state.conditions.some((entry) => entry.target === declaration.caster && MAGIC_CONDITIONS[entry.condition].blocksCasting)) {
    issues.push(issue("casting_blocked", "state.conditions", "A current condition blocks casting."));
  }
  if (ability.sustain && state.sustains.some((entry) => entry.caster === declaration.caster && entry.abilityId === ability.id)) {
    issues.push(issue("already_sustaining", "state.sustains", "The caster is already sustaining this ability."));
  }
  if (state.sustains.some((entry) => entry.id === declaration.id)
    || state.armor.some((entry) => entry.id.startsWith(`${declaration.id}:`))
    || state.conditions.some((entry) => entry.id.startsWith(`${declaration.id}:`))) {
    issues.push(issue("invalid_declaration", "declaration.id", "Declaration id has already been used in the current magic state."));
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: declaration };
}

export type MagicRng = () => number;

function randomDie(sides: number, rng: MagicRng): number {
  const sampled = rng();
  const safe = Number.isFinite(sampled) ? Math.min(1 - Number.EPSILON, Math.max(0, sampled)) : 0;
  return Math.floor(safe * sides) + 1;
}

export function rollMagicFormula(formula: MagicFormula, rng: MagicRng): MagicRoll {
  const rolls = Array.from({ length: formula.dice }, () => randomDie(formula.sides, rng));
  const total = rolls.reduce((sum, value) => sum + value, 0) + formula.bonus;
  const diceText = formula.dice ? `${formula.dice}d${formula.sides}` : "0";
  const bonusText = formula.bonus ? `${formula.bonus > 0 ? "+" : "−"}${Math.abs(formula.bonus)}` : "";
  return { rolls, total, natural: null, text: `${diceText}${bonusText} (${rolls.join(" + ") || "0"})` };
}

function rollCastingDie(rng: MagicRng, exploding: boolean): MagicRoll {
  const first = randomDie(10, rng);
  const rolls = [first];
  let total = first;
  if (exploding && (first === 1 || first === 10)) {
    let extra = randomDie(10, rng);
    rolls.push(extra);
    total = first === 10 ? 10 + extra : 1 - extra;
    let guard = 0;
    while (extra === 10 && guard < 20) {
      extra = randomDie(10, rng);
      rolls.push(extra);
      total += first === 10 ? extra : -extra;
      guard += 1;
    }
  }
  return {
    rolls,
    total,
    natural: first,
    text: rolls.length === 1 ? `1d10 (${first})` : `d10 (${rolls.join(first === 10 ? " + " : " − ")})`,
  };
}

function conditionCastingModifier(state: MagicState, side: MagicSide): number {
  return state.conditions
    .filter((entry) => entry.target === side)
    .reduce((sum, entry) => sum + MAGIC_CONDITIONS[entry.condition].castingModifierPerIntensity * entry.intensity, 0);
}

function conditionDefenseModifier(state: MagicState, side: MagicSide): number {
  return state.conditions
    .filter((entry) => entry.target === side)
    .reduce((sum, entry) => sum + MAGIC_CONDITIONS[entry.condition].defenseModifierPerIntensity * entry.intensity, 0);
}

function resolveEffect(effect: MagicEffect, declaration: MagicDeclaration, rng: MagicRng): ResolvedMagicEffect {
  const target: MagicSide = effect.target === "caster" ? declaration.caster : declaration.target;
  switch (effect.type) {
    case "damage": {
      const roll = rollMagicFormula(effect.amount, rng);
      return { ...effect, target, amount: Math.max(0, roll.total), roll };
    }
    case "heal": {
      const roll = rollMagicFormula(effect.amount, rng);
      return { ...effect, target, amount: Math.max(0, roll.total), roll };
    }
    case "armor": {
      const roll = rollMagicFormula(effect.amount, rng);
      return { ...effect, target, amount: Math.max(0, roll.total), roll };
    }
    case "condition": return { ...effect, target };
    case "movement": {
      const roll = rollMagicFormula(effect.meters, rng);
      return { ...effect, target, meters: Math.max(0, roll.total), roll };
    }
  }
}

export type ResolveMagicArgs = ValidateMagicDeclarationArgs & {
  rng: MagicRng;
  explodingDice?: boolean;
};

export function resolveMagic(args: ResolveMagicArgs): MagicResolveResult {
  const validation = validateMagicDeclaration(args);
  if (!validation.ok) return validation;
  const { ability, declaration, fighters, state, rng } = args;
  const caster = fighters[declaration.caster];
  const target = fighters[declaration.target];
  const attackBase = (caster.skills[ability.check.skill] ?? caster.stats[ability.check.fallbackStat])
    + ability.check.modifier
    + conditionCastingModifier(state, declaration.caster);
  const attackRoll = rollCastingDie(rng, args.explodingDice ?? true);
  const attackTotal = Math.max(0, attackBase + attackRoll.total);

  let defenseRoll: MagicRoll | null = null;
  let defenseBase: number;
  let defenseTotal: number;
  if (ability.check.defense === "none") {
    defenseBase = ability.check.difficulty;
    defenseTotal = ability.check.difficulty;
  } else {
    const skill = ability.check.defense === "resist_magic" ? "resist_magic" : "dodge_escape";
    const fallback = ability.check.defense === "resist_magic" ? target.stats.WILL : target.stats.REF;
    defenseBase = (target.skills[skill] ?? fallback) + conditionDefenseModifier(state, declaration.target);
    defenseRoll = rollCastingDie(rng, args.explodingDice ?? true);
    defenseTotal = Math.max(0, defenseBase + defenseRoll.total);
  }

  const criticalFailure = attackRoll.natural === 1;
  const success = ability.check.defense === "none" ? attackTotal >= defenseTotal : attackTotal > defenseTotal;
  const outcome: MagicResolution["outcome"] = criticalFailure ? "backfire" : success ? "success" : "failure";
  const sourceEffects = outcome === "success" ? ability.effects : outcome === "backfire" ? ability.backfire : [];
  const effects = sourceEffects.map((effect) => resolveEffect(effect, declaration, rng));
  return {
    ok: true,
    resolution: {
      id: declaration.id,
      declaration: { ...declaration },
      abilityId: ability.id,
      category: ability.category,
      round: state.round,
      outcome,
      attackRoll,
      defenseRoll,
      attackBase,
      defenseBase,
      attackTotal,
      defenseTotal,
      margin: attackTotal - defenseTotal,
      cost: { ...ability.cost },
      duration: ability.duration,
      sustain: ability.sustain ? { ...ability.sustain } : null,
      cooldownUntilRound: state.round + ability.cooldown,
      effects,
    },
  };
}

const RESOLUTION_KEYS = new Set([
  "id", "declaration", "abilityId", "category", "round", "outcome", "attackRoll", "defenseRoll", "attackBase",
  "defenseBase", "attackTotal", "defenseTotal", "margin", "cost", "duration", "sustain", "cooldownUntilRound", "effects",
]);
const ROLL_KEYS = new Set(["rolls", "total", "natural", "text"]);

function validateMagicRoll(value: unknown, path: string, issues: MagicValidationIssue[]): value is MagicRoll {
  if (!isRecord(value) || !hasExactKeys(value, ROLL_KEYS)) {
    issues.push(issue("invalid_resolution", path, "Roll is malformed."));
    return false;
  }
  if (!Array.isArray(value.rolls) || value.rolls.length > 20 || value.rolls.some((roll) => !isIntegerIn(roll, 1, 100))) issues.push(issue("invalid_resolution", `${path}.rolls`, "Roll values are invalid."));
  if (!isFiniteNumber(value.total)) issues.push(issue("invalid_resolution", `${path}.total`, "Roll total is invalid."));
  if (value.natural !== null && !isIntegerIn(value.natural, 1, 10)) issues.push(issue("invalid_resolution", `${path}.natural`, "Natural die is invalid."));
  if (typeof value.text !== "string" || value.text.length > 1_000) issues.push(issue("invalid_resolution", `${path}.text`, "Roll text is invalid."));
  return true;
}

function validateResolvedEffect(value: unknown, path: string, issues: MagicValidationIssue[]): value is ResolvedMagicEffect {
  if (!isRecord(value) || typeof value.type !== "string" || !isSide(value.target)) {
    issues.push(issue("invalid_resolution", path, "Resolved effect is malformed."));
    return false;
  }
  switch (value.type) {
    case "damage": {
      const keys = new Set(["type", "target", "pool", "amount", "damageType", "bypassArmor", "roll"]);
      if (!hasExactKeys(value, keys) || !MAGIC_POOLS.has(value.pool as MagicPool) || !DAMAGE_TYPES.has(value.damageType as string)
        || typeof value.bypassArmor !== "boolean" || !isFiniteNumber(value.amount) || value.amount < 0) {
        issues.push(issue("invalid_resolution", path, "Resolved damage is invalid."));
      }
      validateMagicRoll(value.roll, `${path}.roll`, issues);
      break;
    }
    case "heal": {
      const keys = new Set(["type", "target", "pool", "amount", "roll"]);
      if (!hasExactKeys(value, keys) || !MAGIC_POOLS.has(value.pool as MagicPool) || !isFiniteNumber(value.amount) || value.amount < 0) {
        issues.push(issue("invalid_resolution", path, "Resolved healing is invalid."));
      }
      validateMagicRoll(value.roll, `${path}.roll`, issues);
      break;
    }
    case "armor": {
      const keys = new Set(["type", "target", "amount", "roll"]);
      if (!hasExactKeys(value, keys) || !isFiniteNumber(value.amount) || value.amount < 0) issues.push(issue("invalid_resolution", path, "Resolved armor is invalid."));
      validateMagicRoll(value.roll, `${path}.roll`, issues);
      break;
    }
    case "condition": {
      const keys = new Set(["type", "target", "condition", "intensity"]);
      if (!hasExactKeys(value, keys) || !CONDITION_IDS.has(value.condition as MagicConditionId) || !isIntegerIn(value.intensity, 1, 100)) {
        issues.push(issue("invalid_resolution", path, "Resolved condition is invalid."));
      }
      break;
    }
    case "movement": {
      const keys = new Set(["type", "target", "direction", "meters", "roll"]);
      if (!hasExactKeys(value, keys) || (value.direction !== "toward" && value.direction !== "away") || !isFiniteNumber(value.meters) || value.meters < 0) {
        issues.push(issue("invalid_resolution", path, "Resolved movement is invalid."));
      }
      validateMagicRoll(value.roll, `${path}.roll`, issues);
      break;
    }
    default:
      issues.push(issue("invalid_resolution", `${path}.type`, "Resolved effect type is unsupported."));
      return false;
  }
  return true;
}

export function validateMagicResolution(value: unknown): MagicValidationResult<MagicResolution> {
  const issues: MagicValidationIssue[] = [];
  if (!isRecord(value) || !hasExactKeys(value, RESOLUTION_KEYS)) {
    return { ok: false, issues: [issue("invalid_resolution", "resolution", "Resolution has missing or unexpected fields.")] };
  }
  validateDeclarationShape(value.declaration, issues);
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) issues.push(issue("invalid_resolution", "resolution.id", "Resolution id is invalid."));
  if (isRecord(value.declaration) && value.id !== value.declaration.id) issues.push(issue("invalid_resolution", "resolution.id", "Resolution id does not match declaration."));
  if (typeof value.abilityId !== "string" || !ID_PATTERN.test(value.abilityId)) issues.push(issue("invalid_resolution", "resolution.abilityId", "Ability id is invalid."));
  if (isRecord(value.declaration) && value.abilityId !== value.declaration.abilityId) issues.push(issue("invalid_resolution", "resolution.abilityId", "Ability id does not match declaration."));
  if (!MAGIC_CATEGORIES.has(value.category as MagicCategory)) issues.push(issue("invalid_resolution", "resolution.category", "Magic category is invalid."));
  if (!isIntegerIn(value.round, 1, Number.MAX_SAFE_INTEGER)) issues.push(issue("invalid_resolution", "resolution.round", "Resolution round is invalid."));
  if (value.outcome !== "success" && value.outcome !== "failure" && value.outcome !== "backfire") issues.push(issue("invalid_resolution", "resolution.outcome", "Outcome is invalid."));
  validateMagicRoll(value.attackRoll, "resolution.attackRoll", issues);
  if (value.defenseRoll !== null) validateMagicRoll(value.defenseRoll, "resolution.defenseRoll", issues);
  for (const key of ["attackBase", "defenseBase", "attackTotal", "defenseTotal", "margin"] as const) {
    if (!isFiniteNumber(value[key])) issues.push(issue("invalid_resolution", `resolution.${key}`, `${key} is invalid.`));
  }
  if (isFiniteNumber(value.attackBase) && isRecord(value.attackRoll) && isFiniteNumber(value.attackRoll.total)
    && value.attackTotal !== Math.max(0, value.attackBase + value.attackRoll.total)) issues.push(issue("invalid_resolution", "resolution.attackTotal", "Attack total is inconsistent."));
  if (isFiniteNumber(value.attackTotal) && isFiniteNumber(value.defenseTotal) && value.margin !== value.attackTotal - value.defenseTotal) issues.push(issue("invalid_resolution", "resolution.margin", "Margin is inconsistent."));
  if (isRecord(value.attackRoll) && value.attackRoll.natural === 1 && value.outcome !== "backfire") issues.push(issue("invalid_resolution", "resolution.outcome", "A natural 1 must backfire."));
  if (isRecord(value.attackRoll) && value.attackRoll.natural !== 1 && value.outcome === "backfire") issues.push(issue("invalid_resolution", "resolution.outcome", "Backfire requires a natural 1."));

  if (!isRecord(value.cost) || !hasExactKeys(value.cost, COST_KEYS)
    || !isIntegerIn(value.cost.vigor, 0, MAX_MAGIC_COST)
    || !isIntegerIn(value.cost.stamina, 0, MAX_MAGIC_COST)) issues.push(issue("invalid_resolution", "resolution.cost", "Resolution cost is invalid."));
  if (!isIntegerIn(value.duration, 0, MAX_MAGIC_DURATION)) issues.push(issue("invalid_resolution", "resolution.duration", "Resolution duration is invalid."));
  if (value.sustain !== null && (!isRecord(value.sustain) || !hasExactKeys(value.sustain, SUSTAIN_KEYS)
    || !isIntegerIn(value.sustain.vigorPerRound, 0, MAX_MAGIC_COST)
    || !isIntegerIn(value.sustain.staminaPerRound, 0, MAX_MAGIC_COST)
    || !isIntegerIn(value.sustain.maxRounds, 1, MAX_MAGIC_DURATION))) issues.push(issue("invalid_resolution", "resolution.sustain", "Resolution sustain is invalid."));
  if (!isIntegerIn(value.cooldownUntilRound, 1, Number.MAX_SAFE_INTEGER)
    || (isFiniteNumber(value.round) && (value.cooldownUntilRound as number) < value.round)) issues.push(issue("invalid_resolution", "resolution.cooldownUntilRound", "Cooldown round is invalid."));
  if (!Array.isArray(value.effects) || value.effects.length > MAX_MAGIC_EFFECTS) issues.push(issue("invalid_resolution", "resolution.effects", "Resolved effects list is invalid."));
  else value.effects.forEach((effect, index) => validateResolvedEffect(effect, `resolution.effects[${index}]`, issues));
  if (value.outcome === "failure" && Array.isArray(value.effects) && value.effects.length) issues.push(issue("invalid_resolution", "resolution.effects", "A normal failure cannot apply effects."));
  const persistent = Array.isArray(value.effects) && value.effects.some((effect) => isRecord(effect) && (effect.type === "armor" || effect.type === "condition"));
  if (persistent && value.duration === 0 && (value.outcome !== "success" || value.sustain === null)) {
    issues.push(issue("invalid_resolution", "resolution.duration", "Persistent resolution effects require duration or successful sustain."));
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: value as MagicResolution };
}

function cloneFighters(fighters: [PreparedFighter, PreparedFighter]): [PreparedFighter, PreparedFighter] {
  return structuredClone(fighters);
}

function cloneState(state: MagicState): MagicState {
  return structuredClone(state);
}

function absorbMagicArmor(state: MagicState, target: MagicSide, incoming: number): { damage: number; absorbed: number } {
  let damage = incoming;
  let absorbed = 0;
  for (const armor of state.armor) {
    if (armor.target !== target || armor.points <= 0 || damage <= 0) continue;
    const blocked = Math.min(armor.points, damage);
    armor.points -= blocked;
    damage -= blocked;
    absorbed += blocked;
  }
  state.armor = state.armor.filter((entry) => entry.points > 0);
  return { damage, absorbed };
}

function applyDamage(
  fighters: [PreparedFighter, PreparedFighter],
  state: MagicState,
  target: MagicSide,
  pool: MagicPool,
  amount: number,
  bypassArmor: boolean,
): { applied: number; absorbed: number } {
  const requested = Math.max(0, amount);
  const absorption = pool === "hp" && !bypassArmor ? absorbMagicArmor(state, target, requested) : { damage: requested, absorbed: 0 };
  if (pool === "hp") {
    const before = fighters[target].hp;
    fighters[target].hp = Math.max(0, before - absorption.damage);
    return { applied: before - fighters[target].hp, absorbed: absorption.absorbed };
  }
  if (pool === "sta") {
    const before = fighters[target].sta;
    fighters[target].sta = Math.max(0, before - requested);
    return { applied: before - fighters[target].sta, absorbed: 0 };
  }
  if (pool === "resolve") {
    const before = fighters[target].resolve;
    fighters[target].resolve = Math.max(0, before - requested);
    return { applied: before - fighters[target].resolve, absorbed: 0 };
  }
  const before = state.sides[target].vigor;
  state.sides[target].vigor = Math.max(0, before - requested);
  return { applied: before - state.sides[target].vigor, absorbed: 0 };
}

function applyHealing(
  fighters: [PreparedFighter, PreparedFighter],
  state: MagicState,
  target: MagicSide,
  pool: MagicPool,
  amount: number,
): number {
  const requested = Math.max(0, amount);
  if (pool === "hp") {
    const before = fighters[target].hp;
    fighters[target].hp = Math.min(fighters[target].maxHp, before + requested);
    return fighters[target].hp - before;
  }
  if (pool === "sta") {
    const before = fighters[target].sta;
    fighters[target].sta = Math.min(fighters[target].maxSta, before + requested);
    return fighters[target].sta - before;
  }
  if (pool === "resolve") {
    const before = fighters[target].resolve;
    fighters[target].resolve = Math.min(fighters[target].maxResolve, before + requested);
    return fighters[target].resolve - before;
  }
  const before = state.sides[target].vigor;
  state.sides[target].vigor = Math.min(state.sides[target].maxVigor, before + requested);
  return state.sides[target].vigor - before;
}

export type ApplyMagicResolutionArgs = {
  fighters: [PreparedFighter, PreparedFighter];
  state: MagicState;
  resolution: MagicResolution;
};

export function applyMagicResolution(args: ApplyMagicResolutionArgs): MagicApplicationResult {
  const issues: MagicValidationIssue[] = [];
  const stateValidation = validateMagicState(args.state);
  if (!stateValidation.ok) issues.push(...stateValidation.issues);
  const resolutionValidation = validateMagicResolution(args.resolution);
  if (!resolutionValidation.ok) issues.push(...resolutionValidation.issues);
  if (issues.length) return { ok: false, issues };

  const { resolution } = args;
  if (resolution.round !== args.state.round) return { ok: false, issues: [issue("stale_round", "resolution.round", "Resolution belongs to a different round.")] };
  const caster = resolution.declaration.caster;
  if (args.state.sides[caster].vigor < resolution.cost.vigor) issues.push(issue("insufficient_vigor", `state.sides[${caster}].vigor`, "Caster no longer has enough Vigor."));
  if (args.fighters[caster].sta < resolution.cost.stamina) issues.push(issue("insufficient_stamina", `fighters[${caster}].sta`, "Caster no longer has enough stamina."));
  if (issues.length) return { ok: false, issues };

  const fighters = cloneFighters(args.fighters);
  const state = cloneState(args.state);
  const events: MagicApplicationEvent[] = [];
  state.sides[caster].vigor -= resolution.cost.vigor;
  fighters[caster].sta -= resolution.cost.stamina;
  if (resolution.cost.vigor) events.push({ type: "cost", target: caster, amount: resolution.cost.vigor, absorbed: 0, sourceId: resolution.id, detail: "vigor" });
  if (resolution.cost.stamina) events.push({ type: "cost", target: caster, amount: resolution.cost.stamina, absorbed: 0, sourceId: resolution.id, detail: "stamina" });
  state.sides[caster].cooldowns[resolution.abilityId] = Math.max(
    state.sides[caster].cooldowns[resolution.abilityId] ?? state.round,
    resolution.cooldownUntilRound,
  );

  const startsSustain = resolution.outcome === "success" && resolution.sustain !== null;
  const sustainId = startsSustain ? resolution.id : null;
  if (resolution.sustain && startsSustain) {
    state.sustains.push({
      id: resolution.id,
      abilityId: resolution.abilityId,
      caster,
      upkeep: { vigor: resolution.sustain.vigorPerRound, stamina: resolution.sustain.staminaPerRound },
      remainingRounds: resolution.sustain.maxRounds,
    });
    events.push({ type: "sustain", target: caster, amount: resolution.sustain.maxRounds, absorbed: 0, sourceId: resolution.id, detail: "started" });
  }

  resolution.effects.forEach((effect, index) => {
    const sourceId = `${resolution.id}:effect:${index}`;
    switch (effect.type) {
      case "damage": {
        const applied = applyDamage(fighters, state, effect.target, effect.pool, effect.amount, effect.bypassArmor);
        events.push({ type: "damage", target: effect.target, amount: applied.applied, absorbed: applied.absorbed, sourceId, detail: `${effect.pool}:${effect.damageType}` });
        break;
      }
      case "heal": {
        const applied = applyHealing(fighters, state, effect.target, effect.pool, effect.amount);
        events.push({ type: "heal", target: effect.target, amount: applied, absorbed: 0, sourceId, detail: effect.pool });
        break;
      }
      case "armor": {
        if (effect.amount <= 0) break;
        state.armor.push({
          id: sourceId,
          sourceAbilityId: resolution.abilityId,
          target: effect.target,
          points: effect.amount,
          remainingRounds: sustainId ? null : Math.max(1, resolution.duration),
          sustainId,
        });
        events.push({ type: "armor", target: effect.target, amount: effect.amount, absorbed: 0, sourceId, detail: "magic" });
        break;
      }
      case "condition": {
        state.conditions.push({
          id: sourceId,
          sourceAbilityId: resolution.abilityId,
          target: effect.target,
          condition: effect.condition,
          intensity: effect.intensity,
          remainingRounds: sustainId ? null : Math.max(1, resolution.duration),
          sustainId,
        });
        events.push({ type: "condition", target: effect.target, amount: effect.intensity, absorbed: 0, sourceId, detail: effect.condition });
        break;
      }
      case "movement": {
        const before = state.distance;
        state.distance = Math.min(MAX_MAGIC_DISTANCE, Math.max(0, before + (effect.direction === "away" ? effect.meters : -effect.meters)));
        events.push({ type: "movement", target: effect.target, amount: Math.abs(state.distance - before), absorbed: 0, sourceId, detail: effect.direction });
        break;
      }
    }
  });
  return { ok: true, fighters, state, events };
}

export type AdvanceMagicRoundArgs = {
  fighters: [PreparedFighter, PreparedFighter];
  state: MagicState;
};

/**
 * Advances timed effects, pays sustain upkeep, applies condition ticks, and
 * expires cooldown markers that are ready. No input object is mutated.
 */
export function advanceMagicRound(args: AdvanceMagicRoundArgs): MagicApplicationResult {
  const validation = validateMagicState(args.state);
  if (!validation.ok) return validation;
  const fighters = cloneFighters(args.fighters);
  const state = cloneState(args.state);
  const events: MagicApplicationEvent[] = [];
  state.round += 1;

  const retainedSustains: MagicSustainInstance[] = [];
  for (const sustain of state.sustains) {
    if (sustain.remainingRounds <= 1) {
      events.push({ type: "expire", target: sustain.caster, amount: 0, absorbed: 0, sourceId: sustain.id, detail: "sustain:max_rounds" });
      continue;
    }
    const magicSide = state.sides[sustain.caster];
    const fighter = fighters[sustain.caster];
    if (magicSide.vigor < sustain.upkeep.vigor || fighter.sta < sustain.upkeep.stamina) {
      events.push({ type: "expire", target: sustain.caster, amount: 0, absorbed: 0, sourceId: sustain.id, detail: "sustain:unpaid" });
      continue;
    }
    magicSide.vigor -= sustain.upkeep.vigor;
    fighter.sta -= sustain.upkeep.stamina;
    retainedSustains.push({ ...sustain, remainingRounds: sustain.remainingRounds - 1 });
    if (sustain.upkeep.vigor) events.push({ type: "cost", target: sustain.caster, amount: sustain.upkeep.vigor, absorbed: 0, sourceId: sustain.id, detail: "sustain:vigor" });
    if (sustain.upkeep.stamina) events.push({ type: "cost", target: sustain.caster, amount: sustain.upkeep.stamina, absorbed: 0, sourceId: sustain.id, detail: "sustain:stamina" });
  }
  state.sustains = retainedSustains;
  const activeSustains = new Set(retainedSustains.map((entry) => entry.id));
  state.armor = state.armor.filter((entry) => entry.sustainId === null || activeSustains.has(entry.sustainId));
  state.conditions = state.conditions.filter((entry) => entry.sustainId === null || activeSustains.has(entry.sustainId));

  for (const condition of state.conditions) {
    const damage = MAGIC_CONDITIONS[condition.condition].damagePerRoundPerIntensity * condition.intensity;
    if (!damage) continue;
    const applied = applyDamage(fighters, state, condition.target, "hp", damage, false);
    events.push({ type: "damage", target: condition.target, amount: applied.applied, absorbed: applied.absorbed, sourceId: condition.id, detail: `condition:${condition.condition}` });
  }

  state.armor = state.armor
    .map((entry) => entry.remainingRounds === null ? entry : { ...entry, remainingRounds: entry.remainingRounds - 1 })
    .filter((entry) => entry.remainingRounds === null || entry.remainingRounds > 0);
  state.conditions = state.conditions
    .map((entry) => entry.remainingRounds === null ? entry : { ...entry, remainingRounds: entry.remainingRounds - 1 })
    .filter((entry) => entry.remainingRounds === null || entry.remainingRounds > 0);

  for (const side of state.sides) {
    side.cooldowns = Object.fromEntries(Object.entries(side.cooldowns).filter(([, readyRound]) => readyRound > state.round));
  }
  return { ok: true, fighters, state, events };
}

export function cancelMagicSustain(state: MagicState, sustainId: string): MagicValidationResult<MagicState> {
  const validation = validateMagicState(state);
  if (!validation.ok) return validation;
  const next = cloneState(state);
  next.sustains = next.sustains.filter((entry) => entry.id !== sustainId);
  next.armor = next.armor.filter((entry) => entry.sustainId !== sustainId);
  next.conditions = next.conditions.filter((entry) => entry.sustainId !== sustainId);
  return { ok: true, value: next };
}

export function findMagicAbility(id: string, abilities: readonly MagicAbility[] = BUILTIN_MAGIC_ABILITIES): MagicAbility | null {
  return abilities.find((ability) => ability.id === id) ?? null;
}
