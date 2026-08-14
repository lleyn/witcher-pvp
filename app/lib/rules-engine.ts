import {
  consumeBattlefieldAction,
  consumeReady,
  declarePhysicalAction,
  distanceBetween,
  distanceZone,
  physicalActionModifiers,
  resolvePhysicalAction,
  type BattlefieldEffect,
  type BattlefieldSide,
  type PhysicalActionDeclaration,
  type ResolvedPhysicalActionResult,
} from "./battlefield";
import { d10, type DiceRoll } from "./combat";
import {
  addCriticalWound,
  createCriticalWound,
  effectModifiers,
  severityFromMargin,
  stabilizeWound,
  tickEffects,
  treatWound,
  type CriticalWound,
  type EffectModifiers,
} from "./effects";
import {
  advanceEncounterTurn,
  syncEncounterFromFighters,
  syncFightersFromEncounter,
  type EncounterState,
} from "./encounter";
import {
  advanceMagicRound,
  applyMagicResolution,
  canFighterUseMagicAbility,
  findMagicAbility,
  MAGIC_CONDITIONS,
  resolveMagic,
  type MagicAbility,
  type MagicApplicationEvent,
  type MagicDeclaration,
  type MagicResolution,
} from "./magic";
import { generateMonster, type DamageType } from "./monsters";
import type { PreparedFighter, Weapon } from "./witcher";

export type EngineFailure = { ok: false; code: string; message: string };

export type AttackContext = {
  ok: boolean;
  code: "ok" | "too_far" | "disarmed" | "cannot_act";
  message: string;
  distanceMeters: number;
  zone: ReturnType<typeof distanceZone>;
  attackerModifier: number;
  defenderModifier: number;
  notes: string[];
};

export type PhysicalCommandResult = {
  ok: true;
  fighters: [PreparedFighter, PreparedFighter];
  encounter: EncounterState;
  roll: { attacker: DiceRoll; defender: DiceRoll } | null;
  resolution: ResolvedPhysicalActionResult | null;
  effects: BattlefieldEffect[];
  title: string;
  detail: string;
  endsTurn: boolean;
};

export type MagicCommandResult = {
  ok: true;
  fighters: [PreparedFighter, PreparedFighter];
  encounter: EncounterState;
  resolution: MagicResolution;
  events: MagicApplicationEvent[];
  wound: CriticalWound | null;
  title: string;
  detail: string;
  endsTurn: true;
};

export type TreatmentCommandResult = {
  ok: true;
  fighters: [PreparedFighter, PreparedFighter];
  encounter: EncounterState;
  roll: DiceRoll;
  success: boolean;
  title: string;
  detail: string;
  endsTurn: true;
};

export type TurnAdvanceResult = {
  fighters: [PreparedFighter, PreparedFighter];
  encounter: EncounterState;
  upkeep: string[];
};

const PHYSICAL_LABELS: Record<PhysicalActionDeclaration["type"], string> = {
  move: "Перемещение",
  sprint: "Рывок",
  stand: "Встать",
  kneel: "Опуститься на колено",
  go_prone: "Лечь",
  grapple: "Захват",
  escape_grapple: "Выход из захвата",
  shove: "Толчок",
  disarm: "Обезоруживание",
  knockdown: "Сбивание с ног",
  stun: "Оглушение",
  aim: "Прицеливание",
  ready: "Подготовленное действие",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sideOther(side: BattlefieldSide): BattlefieldSide {
  return side === 0 ? 1 : 0;
}

export function magicConditionModifiers(encounter: EncounterState, side: BattlefieldSide): EffectModifiers {
  const result: EffectModifiers = { attack: 0, defense: 0, speed: 0, spellcasting: 0, damageTaken: 0, cannotAct: false, cannotReact: false };
  for (const condition of encounter.magic.conditions) {
    if (condition.target !== side) continue;
    const intensity = Math.max(1, condition.intensity);
    const definition = MAGIC_CONDITIONS[condition.condition];
    result.spellcasting += definition.castingModifierPerIntensity * intensity;
    result.defense += definition.defenseModifierPerIntensity * intensity;
    if (condition.condition === "stunned") { result.cannotAct = true; result.cannotReact = true; }
    if (condition.condition === "slowed") result.speed -= intensity * 2;
    if (condition.condition === "weakened") result.attack -= intensity;
  }
  return result;
}

export function combinedCombatModifiers(encounter: EncounterState, side: BattlefieldSide): EffectModifiers {
  const persistent = effectModifiers(encounter.effects[side]);
  const magical = magicConditionModifiers(encounter, side);
  return {
    attack: persistent.attack + magical.attack,
    defense: persistent.defense + magical.defense,
    speed: persistent.speed + magical.speed,
    spellcasting: persistent.spellcasting + magical.spellcasting,
    damageTaken: persistent.damageTaken + magical.damageTaken,
    cannotAct: persistent.cannotAct || magical.cannotAct,
    cannotReact: persistent.cannotReact || magical.cannotReact,
  };
}

function parseWeaponRange(weapon: Weapon): number {
  if (/очень далеко|distant/i.test(weapon.range)) return 150;
  if (/далеко|far/i.test(weapon.range)) return 30;
  if (/близко|near/i.test(weapon.range)) return 10;
  if (weapon.category === "unarmed" || weapon.bodyDamage) return 2;
  const match = weapon.range.match(/\d+(?:[.,]\d+)?/);
  if (match) return Number(match[0].replace(",", "."));
  if (weapon.category === "thrown") return 12;
  if (weapon.category === "bow") return 100;
  if (weapon.category === "crossbow") return 150;
  return 2;
}

export function weaponAttackContext(
  encounter: EncounterState,
  fighters: [PreparedFighter, PreparedFighter],
  attacker: BattlefieldSide,
  weapon: Weapon,
): AttackContext {
  const defender = sideOther(attacker);
  const battlefield = syncEncounterFromFighters(encounter, fighters).battlefield;
  const distanceMeters = distanceBetween(battlefield);
  const zone = distanceZone(distanceMeters);
  const field = physicalActionModifiers(battlefield, attacker, defender);
  const attackerEffects = combinedCombatModifiers(encounter, attacker);
  const defenderEffects = combinedCombatModifiers(encounter, defender);
  const notes = [
    ...field.attackerItems.map((item) => `${item.label} ${item.value >= 0 ? "+" : ""}${item.value}`),
    ...field.defenderItems.map((item) => `${item.label} ${item.value >= 0 ? "+" : ""}${item.value}`),
  ];
  const maxRange = parseWeaponRange(weapon);
  if (distanceMeters > maxRange) {
    return { ok: false, code: "too_far", message: `Цель в ${distanceMeters.toFixed(1)} м, дальность оружия — ${maxRange} м.`, distanceMeters, zone, attackerModifier: 0, defenderModifier: 0, notes };
  }
  if (battlefield.actors[attacker].disarmed && weapon.category !== "unarmed") {
    return { ok: false, code: "disarmed", message: "Боец обезоружен: доступна только безоружная атака.", distanceMeters, zone, attackerModifier: 0, defenderModifier: 0, notes };
  }
  if (attackerEffects.cannotAct || battlefield.actors[attacker].stunnedTurns > 0) {
    return { ok: false, code: "cannot_act", message: "Состояние бойца не позволяет атаковать.", distanceMeters, zone, attackerModifier: 0, defenderModifier: 0, notes };
  }
  let rangeModifier = 0;
  if (!weapon.bodyDamage && weapon.category !== "unarmed") {
    rangeModifier = zone === "near" ? -1 : zone === "far" ? -3 : zone === "extreme" ? -6 : 0;
    if (rangeModifier) notes.push(`Дистанция ${rangeModifier}`);
  }
  return {
    ok: true,
    code: "ok",
    message: "",
    distanceMeters,
    zone,
    attackerModifier: field.attacker + attackerEffects.attack + rangeModifier,
    defenderModifier: field.defender + defenderEffects.defense,
    notes,
  };
}

export function reserveAttackAction(
  encounter: EncounterState,
  fighters: [PreparedFighter, PreparedFighter],
  side: BattlefieldSide,
): { ok: true; encounter: EncounterState; aimModifier: number } | EngineFailure {
  const synced = syncEncounterFromFighters(encounter, fighters);
  const reserved = consumeBattlefieldAction(synced.battlefield, side, 0);
  if (!reserved.ok) return reserved;
  const next = structuredClone(synced);
  const aimModifier = next.battlefield.actors[side].aim?.target === sideOther(side)
    ? next.battlefield.actors[side].aim?.bonus ?? 0
    : 0;
  next.battlefield = consumeReady(reserved.state, sideOther(side)).state;
  next.battlefield.actors[side].aim = null;
  return { ok: true, encounter: next, aimModifier };
}

function contestBases(type: PhysicalActionDeclaration["type"], fighters: [PreparedFighter, PreparedFighter], actor: BattlefieldSide) {
  const defender = sideOther(actor);
  const source = fighters[actor];
  const target = fighters[defender];
  const attack = type === "disarm"
    ? Math.max(source.skills.melee ?? 0, source.skills.swordsmanship ?? 0, source.skills.small_blades ?? 0)
    : type === "escape_grapple"
      ? Math.max(source.skills.athletics ?? 0, source.skills.brawling ?? 0)
      : type === "shove" || type === "knockdown"
        ? Math.max(source.skills.physique ?? 0, source.skills.brawling ?? 0)
        : source.skills.brawling ?? source.stats.REF;
  const defense = type === "stun"
    ? target.skills.endurance ?? target.stats.BODY
    : type === "disarm"
      ? Math.max(target.skills.melee ?? 0, target.skills.dodge_escape ?? 0)
      : Math.max(target.skills.athletics ?? 0, target.skills.brawling ?? 0, target.skills.physique ?? 0);
  return {
    attack,
    defense,
  };
}

function battlefieldEffectText(effect: BattlefieldEffect) {
  if (effect.type === "position") return `позиция ${effect.fromMeters.toFixed(1)}→${effect.toMeters.toFixed(1)} м`;
  if (effect.type === "stance") return `стойка: ${effect.to}`;
  if (effect.type === "stamina") return `Выносливость ${effect.before}→${effect.after}`;
  if (effect.type === "grapple") return effect.active ? "цель захвачена" : "захват разорван";
  if (effect.type === "disarmed") return "цель обезоружена";
  if (effect.type === "stunned") return `оглушение на ${effect.turns} ход`;
  if (effect.type === "aim") return `прицеливание +${effect.bonus}`;
  if (effect.type === "ready") return `триггер: ${effect.trigger}`;
  return `опасная зона: ${effect.hazard.label}`;
}

export function resolvePhysicalCommand(args: {
  encounter: EncounterState;
  fighters: [PreparedFighter, PreparedFighter];
  declaration: PhysicalActionDeclaration;
  rng: () => number;
  explodingDice: boolean;
}): PhysicalCommandResult | EngineFailure {
  const encounter = syncEncounterFromFighters(args.encounter, args.fighters);
  if (combinedCombatModifiers(encounter, args.declaration.actor).cannotAct) return { ok: false, code: "cannot_act", message: "Состояние бойца не позволяет выполнить действие." };
  const declared = declarePhysicalAction(encounter.battlefield, args.declaration);
  if (!declared.ok) return declared;
  let battlefield = declared.state;
  let effects: BattlefieldEffect[] = declared.result.kind === "contest_required" ? [] : declared.result.effects;
  let roll: PhysicalCommandResult["roll"] = null;
  let resolution: ResolvedPhysicalActionResult | null = null;
  if (declared.result.kind === "contest_required") {
    battlefield = consumeReady(battlefield, sideOther(args.declaration.actor)).state;
    const bases = contestBases(args.declaration.type, args.fighters, args.declaration.actor);
    const attackerRoll = d10(args.rng, args.explodingDice);
    const defendingSide = sideOther(args.declaration.actor);
    const targetCannotReact = encounter.battlefield.actors[defendingSide].stunnedTurns > 0
      || combinedCombatModifiers(encounter, defendingSide).cannotReact;
    const defenderRoll: DiceRoll = targetCannotReact
      ? { rolls: [], total: 0, text: "нет реакции" }
      : d10(args.rng, args.explodingDice);
    const resolved = resolvePhysicalAction(battlefield, {
      declarationId: args.declaration.id,
      expectedRevision: battlefield.revision,
      attackerCheck: bases.attack + attackerRoll.total + combinedCombatModifiers(encounter, args.declaration.actor).attack,
      defenderCheck: targetCannotReact
        ? 10
        : bases.defense + defenderRoll.total + combinedCombatModifiers(encounter, defendingSide).defense,
    });
    if (!resolved.ok || resolved.result.kind !== "resolved") return resolved.ok
      ? { ok: false, code: "invalid_resolution", message: "Физическое действие не было разрешено." }
      : resolved;
    battlefield = resolved.state;
    effects = resolved.result.effects;
    resolution = resolved.result;
    roll = { attacker: attackerRoll, defender: defenderRoll };
  }
  let nextEncounter = { ...encounter, battlefield };
  const fighters = syncFightersFromEncounter(nextEncounter, args.fighters);
  const hazardNotes: string[] = [];
  for (const effect of effects) {
    if (effect.type !== "hazard_entry") continue;
    const damage = Array.from({ length: effect.hazard.severity }, () => Math.floor(args.rng() * 6) + 1).reduce((sum, value) => sum + value, 0);
    fighters[effect.side].hp = Math.max(0, fighters[effect.side].hp - damage);
    hazardNotes.push(`${effect.hazard.label}: −${damage} ПЗ`);
  }
  nextEncounter = syncEncounterFromFighters(nextEncounter, fighters);
  const title = `${fighters[args.declaration.actor].name}: ${PHYSICAL_LABELS[args.declaration.type]}`;
  const detail = resolution
    ? `${roll!.attacker.text} против ${roll!.defender.text}: ${resolution.attackerTotal} против ${resolution.defenderTotal} — ${resolution.success ? "успех" : "неудача"}${effects.length || hazardNotes.length ? `. ${[...effects.map(battlefieldEffectText), ...hazardNotes].join("; ")}` : ""}.`
    : `${[...effects.map(battlefieldEffectText), ...hazardNotes].join("; ") || "действие выполнено"}.`;
  return { ok: true, fighters, encounter: nextEncounter, roll, resolution, effects, title, detail, endsTurn: battlefield.turn.actionUsed };
}

function moveMagicTarget(encounter: EncounterState, resolution: MagicResolution) {
  const next = structuredClone(encounter);
  for (const effect of resolution.effects) {
    if (effect.type !== "movement" || effect.meters <= 0) continue;
    const target = next.battlefield.actors[effect.target];
    const other = next.battlefield.actors[sideOther(effect.target)];
    const direction = target.positionMeters === other.positionMeters
      ? (effect.target === 0 ? -1 : 1)
      : Math.sign(target.positionMeters - other.positionMeters);
    const signed = effect.direction === "away" ? direction : -direction;
    target.positionMeters = clamp(target.positionMeters + signed * effect.meters, next.battlefield.layout.minMeters, next.battlefield.layout.maxMeters);
  }
  next.magic.distance = distanceBetween(next.battlefield);
  return next;
}

function magicEventsText(events: MagicApplicationEvent[]) {
  return events.map((event) => {
    if (event.type === "damage") return `урон ${event.amount}${event.absorbed ? ` (поглощено ${event.absorbed})` : ""}`;
    if (event.type === "heal") return `лечение ${event.amount}`;
    if (event.type === "armor") return `магическая броня ${event.amount}`;
    if (event.type === "condition") return `состояние ${event.detail}`;
    if (event.type === "movement") return `смещение ${event.amount} м`;
    if (event.type === "cost") return `${event.detail} −${event.amount}`;
    if (event.type === "sustain") return `поддержание ${event.detail}`;
    return `эффект завершён`;
  }).join("; ");
}

export function resolveMagicCommand(args: {
  encounter: EncounterState;
  fighters: [PreparedFighter, PreparedFighter];
  abilityId: string;
  caster: BattlefieldSide;
  target: BattlefieldSide;
  rng: () => number;
  explodingDice: boolean;
  criticals?: boolean;
  declarationId?: string;
  abilities?: readonly MagicAbility[];
}): MagicCommandResult | EngineFailure {
  const ability = findMagicAbility(args.abilityId, args.abilities);
  if (!ability) return { ok: false, code: "unknown_magic", message: "Магическая способность не найдена." };
  if (!canFighterUseMagicAbility(args.fighters[args.caster], ability)) return { ok: false, code: "unknown_magic", message: "Эта школа магии не указана в листе бойца." };
  let encounter = syncEncounterFromFighters(args.encounter, args.fighters);
  if (combinedCombatModifiers(encounter, args.caster).cannotAct) return { ok: false, code: "cannot_act", message: "Состояние бойца не позволяет творить магию." };
  const reserved = consumeBattlefieldAction(encounter.battlefield, args.caster, 0);
  if (!reserved.ok) return reserved;
  encounter = { ...encounter, battlefield: reserved.state };
  const field = physicalActionModifiers(encounter.battlefield, args.caster, args.target);
  // MagicState applies its own casting/defense condition modifiers in resolveMagic.
  // Only wound/general effects are folded into the synthetic ability and skills here.
  const casterEffects = effectModifiers(encounter.effects[args.caster]);
  const targetEffects = effectModifiers(encounter.effects[args.target]);
  const targetCannotReact = encounter.battlefield.actors[args.target].stunnedTurns > 0
    || combinedCombatModifiers(encounter, args.target).cannotReact;
  const adjustedAbility: MagicAbility = {
    ...ability,
    check: {
      ...ability.check,
      defense: targetCannotReact && args.target !== args.caster ? "none" : ability.check.defense,
      difficulty: targetCannotReact && args.target !== args.caster ? 10 : ability.check.difficulty,
      modifier: ability.check.modifier + field.attacker + casterEffects.spellcasting,
    },
  };
  const rollFighters = structuredClone(args.fighters);
  if (adjustedAbility.check.defense === "resist_magic") rollFighters[args.target].skills.resist_magic = (rollFighters[args.target].skills.resist_magic ?? rollFighters[args.target].stats.WILL) + field.defender + targetEffects.defense;
  if (adjustedAbility.check.defense === "dodge") rollFighters[args.target].skills.dodge_escape = (rollFighters[args.target].skills.dodge_escape ?? rollFighters[args.target].stats.REF) + field.defender + targetEffects.defense;
  const declaration: MagicDeclaration = {
    id: args.declarationId ?? `magic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    abilityId: adjustedAbility.id,
    caster: args.caster,
    target: args.target,
  };
  const resolved = resolveMagic({ ability: adjustedAbility, declaration, fighters: rollFighters, state: encounter.magic, rng: args.rng, explodingDice: args.explodingDice });
  if (!resolved.ok) return { ok: false, code: resolved.issues[0]?.code ?? "magic_failed", message: resolved.issues.map((item) => item.message).join(" ") };
  const resolution = structuredClone(resolved.resolution);
  if (encounter.mode === "pve" && encounter.aiSide !== null && encounter.monsterId) {
    const monster = generateMonster(encounter.monsterId);
    for (const effect of resolution.effects) {
      if (effect.type !== "damage" || effect.target !== encounter.aiSide) continue;
      const damageType: DamageType = effect.damageType === "fire" || effect.damageType === "frost" || effect.damageType === "poison"
        ? effect.damageType
        : "magic";
      const resistance = monster.resistances.find((item) => item.type === damageType)?.multiplier ?? 1;
      const vulnerability = monster.vulnerabilities.find((item) => item.type === damageType)?.multiplier ?? 1;
      effect.amount = Math.max(0, Math.floor(effect.amount * resistance * vulnerability));
    }
  }
  const applied = applyMagicResolution({ fighters: args.fighters, state: encounter.magic, resolution });
  if (!applied.ok) return { ok: false, code: applied.issues[0]?.code ?? "magic_failed", message: applied.issues.map((item) => item.message).join(" ") };
  encounter = moveMagicTarget({ ...encounter, magic: applied.state }, resolution);
  let wound: CriticalWound | null = null;
  if ((args.criticals ?? true) && resolution.outcome === "success" && resolution.effects.some((effect) => effect.type === "damage")) {
    const severity = severityFromMargin(resolution.margin);
    if (severity) {
      const locations = ["head", "torso", "arms", "legs"] as const;
      wound = createCriticalWound(severity, locations[Math.floor(args.rng() * locations.length)] ?? "torso", args.rng);
      encounter.effects[args.target] = addCriticalWound(encounter.effects[args.target], wound);
    }
  }
  const appliedFighters = structuredClone(applied.fighters);
  for (const side of [0, 1] as BattlefieldSide[]) appliedFighters[side].vigor = encounter.magic.sides[side].vigor;
  encounter = syncEncounterFromFighters(encounter, appliedFighters);
  const fighters = syncFightersFromEncounter(encounter, appliedFighters);
  const outcome = resolution.outcome === "success" ? "успех" : resolution.outcome === "backfire" ? "магическая осечка" : "неудача";
  return {
    ok: true,
    fighters,
    encounter,
    resolution,
    events: applied.events,
    wound,
    title: `${fighters[args.caster].name}: ${ability.name}`,
    detail: `${resolution.attackRoll.text}: ${resolution.attackTotal} против ${resolution.defenseTotal} — ${outcome}. ${magicEventsText(applied.events) || "Эффектов нет"}${wound ? `. Критическая рана: ${wound.name}` : ""}.`,
    endsTurn: true,
  };
}

export function resolveTreatmentCommand(args: {
  encounter: EncounterState;
  fighters: [PreparedFighter, PreparedFighter];
  actor: BattlefieldSide;
  target?: BattlefieldSide;
  woundId: string;
  treatment?: "stabilize" | "treat";
  rng: () => number;
  explodingDice: boolean;
}): TreatmentCommandResult | EngineFailure {
  const target = args.target ?? args.actor;
  const wound = args.encounter.effects[target].wounds.find((item) => item.id === args.woundId);
  if (!wound) return { ok: false, code: "unknown_wound", message: "Рана не найдена." };
  if ((args.treatment ?? "stabilize") === "stabilize" && wound.stabilized) return { ok: false, code: "already_stabilized", message: "Рана уже стабилизирована." };
  if ((args.treatment ?? "stabilize") === "treat" && wound.treated) return { ok: false, code: "already_treated", message: "Рана уже вылечена." };
  let encounter = syncEncounterFromFighters(args.encounter, args.fighters);
  if (combinedCombatModifiers(encounter, args.actor).cannotAct) return { ok: false, code: "cannot_act", message: "Состояние бойца не позволяет оказать помощь." };
  if (target !== args.actor && distanceZone(distanceBetween(encounter.battlefield)) !== "engaged") {
    return { ok: false, code: "too_far", message: "Для первой помощи нужно находиться вплотную к цели." };
  }
  const reserved = consumeBattlefieldAction(encounter.battlefield, args.actor, 0);
  if (!reserved.ok) return reserved;
  encounter = { ...encounter, battlefield: reserved.state };
  const roll = d10(args.rng, args.explodingDice);
  const base = args.fighters[args.actor].skills.first_aid ?? args.fighters[args.actor].stats.CRA;
  const difficulty = { simple: 12, complex: 14, severe: 16, deadly: 18 }[wound.severity] + ((args.treatment ?? "stabilize") === "treat" ? 2 : 0);
  const total = base + roll.total + combinedCombatModifiers(encounter, args.actor).attack;
  const success = total >= difficulty;
  if (success) encounter.effects[target] = (args.treatment ?? "stabilize") === "treat"
    ? treatWound(encounter.effects[target], wound.id)
    : stabilizeWound(encounter.effects[target], wound.id);
  return {
    ok: true,
    fighters: args.fighters,
    encounter,
    roll,
    success,
    title: `${args.fighters[args.actor].name}: первая помощь`,
    detail: `${roll.text} + база ${base} = ${total} против СЛ ${difficulty}: ${success ? `${wound.name} ${(args.treatment ?? "stabilize") === "treat" ? "вылечена" : "стабилизирована"}` : "неудача"}.`,
    endsTurn: true,
  };
}

export function advanceFullTurn(args: {
  encounter: EncounterState;
  fighters: [PreparedFighter, PreparedFighter];
  nextSide: BattlefieldSide;
  nextRound: number;
}): TurnAdvanceResult {
  let fighters = structuredClone(args.fighters);
  let encounter = syncEncounterFromFighters(args.encounter, fighters);
  const upkeep: string[] = [];
  if (args.nextRound > encounter.magic.round) {
    const magic = advanceMagicRound({ fighters, state: encounter.magic });
    if (magic.ok) {
      fighters = magic.fighters;
      encounter.magic = magic.state;
      for (const side of [0, 1] as BattlefieldSide[]) fighters[side].vigor = magic.state.sides[side].vigor;
      if (magic.events.length) upkeep.push(`Магия: ${magicEventsText(magic.events)}`);
    }
  }
  const tick = tickEffects(fighters[args.nextSide], encounter.effects[args.nextSide]);
  fighters[args.nextSide] = tick.fighter;
  encounter.effects[args.nextSide] = tick.effects;
  if (tick.detail.length) upkeep.push(`${fighters[args.nextSide].name}: ${tick.detail.join(", ")}`);
  encounter = advanceEncounterTurn(syncEncounterFromFighters(encounter, fighters), args.nextSide, args.nextRound);
  fighters = syncFightersFromEncounter(encounter, fighters);
  return { fighters, encounter, upkeep };
}
