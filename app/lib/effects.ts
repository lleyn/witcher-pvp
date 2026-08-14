import type { LocationKey, PreparedFighter } from "./witcher";

export type ConditionId =
  | "bleeding"
  | "burning"
  | "poisoned"
  | "stunned"
  | "blinded"
  | "slowed"
  | "weakened"
  | "restrained"
  | "regenerating"
  | "warded";

export type Condition = {
  id: string;
  type: ConditionId;
  label: string;
  stacks: number;
  duration: number;
  source: string;
};

export type CriticalSeverity = "simple" | "complex" | "severe" | "deadly";

export type CriticalWound = {
  id: string;
  name: string;
  severity: CriticalSeverity;
  location: LocationKey;
  stabilized: boolean;
  treated: boolean;
  attackPenalty: number;
  defensePenalty: number;
  speedPenalty: number;
  bleed: number;
  description: string;
};

export type CombatantEffects = {
  conditions: Condition[];
  wounds: CriticalWound[];
};

export type EffectModifiers = {
  attack: number;
  defense: number;
  speed: number;
  spellcasting: number;
  damageTaken: number;
  cannotAct: boolean;
  cannotReact: boolean;
};

const CONDITION_LABELS: Record<ConditionId, string> = {
  bleeding: "Кровотечение",
  burning: "Горение",
  poisoned: "Отравление",
  stunned: "Оглушение",
  blinded: "Ослепление",
  slowed: "Замедление",
  weakened: "Ослабление",
  restrained: "Обездвиживание",
  regenerating: "Регенерация",
  warded: "Магическая защита",
};

const WOUNDS: Record<CriticalSeverity, Record<LocationKey, Array<Omit<CriticalWound, "id" | "severity" | "location" | "stabilized" | "treated">>>> = {
  simple: {
    head: [{ name: "Рассечение брови", attackPenalty: -1, defensePenalty: -1, speedPenalty: 0, bleed: 1, description: "Кровь мешает видеть; штраф снимается после лечения." }],
    torso: [{ name: "Ушиб рёбер", attackPenalty: -1, defensePenalty: 0, speedPenalty: -1, bleed: 0, description: "Боль мешает резким движениям." }],
    arms: [{ name: "Повреждение кисти", attackPenalty: -1, defensePenalty: 0, speedPenalty: 0, bleed: 0, description: "Сложнее удерживать оружие и творить жесты." }],
    legs: [{ name: "Растяжение ноги", attackPenalty: 0, defensePenalty: -1, speedPenalty: -2, bleed: 0, description: "Снижает скорость и устойчивость." }],
  },
  complex: {
    head: [{ name: "Сотрясение", attackPenalty: -2, defensePenalty: -2, speedPenalty: -1, bleed: 0, description: "Дезориентация и звон в ушах." }],
    torso: [{ name: "Глубокая рана бока", attackPenalty: -1, defensePenalty: -1, speedPenalty: -1, bleed: 2, description: "Требует стабилизации, иначе кровотечение продолжается." }],
    arms: [{ name: "Вывих плеча", attackPenalty: -3, defensePenalty: -1, speedPenalty: 0, bleed: 0, description: "Двуручное оружие использовать затруднительно." }],
    legs: [{ name: "Повреждение колена", attackPenalty: 0, defensePenalty: -2, speedPenalty: -4, bleed: 0, description: "Бег и рывок недоступны до лечения." }],
  },
  severe: {
    head: [{ name: "Тяжёлая травма головы", attackPenalty: -3, defensePenalty: -3, speedPenalty: -2, bleed: 1, description: "Проверки концентрации и магии сильно затруднены." }],
    torso: [{ name: "Пробитое лёгкое", attackPenalty: -2, defensePenalty: -2, speedPenalty: -3, bleed: 3, description: "Каждое усилие ускоряет потерю сил." }],
    arms: [{ name: "Перелом руки", attackPenalty: -4, defensePenalty: -2, speedPenalty: 0, bleed: 1, description: "Повреждённая рука почти не действует." }],
    legs: [{ name: "Перелом ноги", attackPenalty: -1, defensePenalty: -4, speedPenalty: -8, bleed: 1, description: "Персонаж падает и может только медленно перемещаться." }],
  },
  deadly: {
    head: [{ name: "Раздробление черепа", attackPenalty: -6, defensePenalty: -6, speedPenalty: -4, bleed: 4, description: "Смертельно опасная травма; срочно требуется помощь." }],
    torso: [{ name: "Разрыв внутренних органов", attackPenalty: -5, defensePenalty: -5, speedPenalty: -5, bleed: 5, description: "Состояние быстро ухудшается без стабилизации." }],
    arms: [{ name: "Раздробленная конечность", attackPenalty: -6, defensePenalty: -3, speedPenalty: 0, bleed: 4, description: "Конечность выведена из строя." }],
    legs: [{ name: "Раздробленная нога", attackPenalty: -2, defensePenalty: -6, speedPenalty: -12, bleed: 4, description: "Стоять без помощи невозможно." }],
  },
};

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyEffects(): CombatantEffects {
  return { conditions: [], wounds: [] };
}

export function makeCondition(type: ConditionId, source: string, duration = 1, stacks = 1): Condition {
  return { id: makeId("condition"), type, label: CONDITION_LABELS[type], source, duration: Math.max(1, duration), stacks: Math.max(1, stacks) };
}

export function addCondition(effects: CombatantEffects, condition: Condition): CombatantEffects {
  const current = effects.conditions.find((item) => item.type === condition.type);
  if (!current) return { ...effects, conditions: [...effects.conditions, condition] };
  return {
    ...effects,
    conditions: effects.conditions.map((item) => item.id === current.id ? {
      ...item,
      stacks: Math.min(5, Math.max(item.stacks, condition.stacks)),
      duration: Math.max(item.duration, condition.duration),
      source: condition.source || item.source,
    } : item),
  };
}

export function removeCondition(effects: CombatantEffects, id: string): CombatantEffects {
  return { ...effects, conditions: effects.conditions.filter((condition) => condition.id !== id) };
}

export function createCriticalWound(severity: CriticalSeverity, location: LocationKey, rng: () => number): CriticalWound {
  const options = WOUNDS[severity][location];
  const template = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
  return { ...template, id: makeId("wound"), severity, location, stabilized: false, treated: false };
}

export function addCriticalWound(effects: CombatantEffects, wound: CriticalWound): CombatantEffects {
  const next = { ...effects, wounds: [...effects.wounds, wound] };
  return wound.bleed > 0 ? addCondition(next, makeCondition("bleeding", wound.name, 99, wound.bleed)) : next;
}

export function stabilizeWound(effects: CombatantEffects, woundId: string): CombatantEffects {
  const wound = effects.wounds.find((item) => item.id === woundId);
  if (!wound) return effects;
  const wounds = effects.wounds.map((item) => item.id === woundId ? { ...item, stabilized: true } : item);
  const bleeding = effects.conditions.map((condition) => condition.type === "bleeding"
    ? { ...condition, stacks: Math.max(0, condition.stacks - wound.bleed) }
    : condition).filter((condition) => condition.stacks > 0);
  return { conditions: bleeding, wounds };
}

export function treatWound(effects: CombatantEffects, woundId: string): CombatantEffects {
  const stabilized = stabilizeWound(effects, woundId);
  return {
    ...stabilized,
    wounds: stabilized.wounds.map((wound) => wound.id === woundId ? { ...wound, stabilized: true, treated: true } : wound),
  };
}

export function effectModifiers(effects: CombatantEffects): EffectModifiers {
  const result: EffectModifiers = { attack: 0, defense: 0, speed: 0, spellcasting: 0, damageTaken: 0, cannotAct: false, cannotReact: false };
  for (const wound of effects.wounds) {
    if (wound.treated) continue;
    result.attack += wound.attackPenalty;
    result.defense += wound.defensePenalty;
    result.speed += wound.speedPenalty;
    if (wound.location === "head") result.spellcasting += wound.attackPenalty;
  }
  for (const condition of effects.conditions) {
    const amount = Math.max(1, condition.stacks);
    if (condition.type === "stunned") { result.cannotAct = true; result.cannotReact = true; }
    if (condition.type === "blinded") { result.attack -= 3; result.defense -= 3; result.spellcasting -= 3; }
    if (condition.type === "slowed") result.speed -= amount * 2;
    if (condition.type === "weakened") { result.attack -= amount; result.spellcasting -= amount; }
    if (condition.type === "restrained") { result.speed = Math.min(result.speed, -99); result.defense -= 2; }
    if (condition.type === "warded") result.damageTaken -= amount;
  }
  return result;
}

export function tickEffects(fighter: PreparedFighter, effects: CombatantEffects): {
  fighter: PreparedFighter;
  effects: CombatantEffects;
  hpDelta: number;
  staDelta: number;
  detail: string[];
} {
  const nextFighter = structuredClone(fighter);
  let hpDelta = 0;
  let staDelta = 0;
  const detail: string[] = [];
  for (const condition of effects.conditions) {
    if (condition.type === "bleeding") { hpDelta -= condition.stacks; detail.push(`кровотечение −${condition.stacks} ПЗ`); }
    if (condition.type === "burning") { hpDelta -= condition.stacks * 2; detail.push(`горение −${condition.stacks * 2} ПЗ`); }
    if (condition.type === "poisoned") { staDelta -= condition.stacks; detail.push(`яд −${condition.stacks} Вын`); }
    if (condition.type === "regenerating") { hpDelta += condition.stacks; detail.push(`регенерация +${condition.stacks} ПЗ`); }
  }
  nextFighter.hp = Math.min(nextFighter.maxHp, nextFighter.hp + hpDelta);
  nextFighter.sta = Math.min(nextFighter.maxSta, Math.max(0, nextFighter.sta + staDelta));
  const nextConditions = effects.conditions
    .map((condition) => ({ ...condition, duration: condition.duration - 1 }))
    .filter((condition) => condition.duration > 0);
  return { fighter: nextFighter, effects: { ...effects, conditions: nextConditions }, hpDelta, staDelta, detail };
}

export function severityFromMargin(margin: number): CriticalSeverity | null {
  if (margin >= 15) return "deadly";
  if (margin >= 13) return "severe";
  if (margin >= 10) return "complex";
  if (margin >= 7) return "simple";
  return null;
}

export function isCombatantEffects(value: unknown): value is CombatantEffects {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !Array.isArray(record.conditions) || !Array.isArray(record.wounds)) return false;
  if (record.conditions.length > 100 || record.wounds.length > 100) return false;
  const conditionIds = new Set<ConditionId>(["bleeding", "burning", "poisoned", "stunned", "blinded", "slowed", "weakened", "restrained", "regenerating", "warded"]);
  const severities = new Set<CriticalSeverity>(["simple", "complex", "severe", "deadly"]);
  const locations = new Set<LocationKey>(["head", "torso", "arms", "legs"]);
  const conditionsValid = record.conditions.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>;
    return Object.keys(item).length === 6
      && typeof item.id === "string" && item.id.length <= 128
      && conditionIds.has(item.type as ConditionId)
      && typeof item.label === "string" && item.label.length <= 200
      && Number.isFinite(item.stacks) && Number.isFinite(item.duration)
      && typeof item.source === "string" && item.source.length <= 500;
  });
  const woundsValid = record.wounds.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>;
    return Object.keys(item).length === 11
      && typeof item.id === "string" && item.id.length <= 128
      && typeof item.name === "string" && item.name.length <= 200
      && severities.has(item.severity as CriticalSeverity)
      && locations.has(item.location as LocationKey)
      && typeof item.stabilized === "boolean" && typeof item.treated === "boolean"
      && [item.attackPenalty, item.defensePenalty, item.speedPenalty, item.bleed].every(Number.isFinite)
      && typeof item.description === "string" && item.description.length <= 1_000;
  });
  return conditionsValid && woundsValid;
}
