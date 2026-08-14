import {
  advanceBattlefieldTurn,
  createBattlefieldState,
  distanceBetween,
  validateBattlefieldState,
  type BattlefieldLayout,
  type BattlefieldSide,
  type BattlefieldState,
} from "./battlefield";
import { effectModifiers, emptyEffects, isCombatantEffects, type CombatantEffects } from "./effects";
import { createMagicState, validateMagicState, type MagicState } from "./magic";
import type { PreparedFighter } from "./witcher";

export type EncounterMode = "pvp" | "pve";
export type BattlefieldPresetId = "crossroads" | "ruins" | "forest" | "bridge";

export type EncounterState = {
  version: 1;
  mode: EncounterMode;
  monsterId: string | null;
  aiSide: BattlefieldSide | null;
  presetId: BattlefieldPresetId;
  battlefield: BattlefieldState;
  effects: [CombatantEffects, CombatantEffects];
  magic: MagicState;
};

export const BATTLEFIELD_PRESETS: Record<BattlefieldPresetId, { name: string; description: string; layout: BattlefieldLayout; positions: [number, number] }> = {
  crossroads: {
    name: "Перекрёсток",
    description: "Открытая дорога без серьёзных укрытий.",
    layout: {
      minMeters: 0,
      maxMeters: 30,
      zones: [{ id: "road", label: "Дорога", fromMeters: 0, toMeters: 30, elevationMeters: 0, cover: "none", hazard: null, movementMultiplier: 1 }],
    },
    positions: [10, 16],
  },
  ruins: {
    name: "Развалины",
    description: "Камни замедляют движение, стены дают укрытие.",
    layout: {
      minMeters: 0,
      maxMeters: 32,
      zones: [
        { id: "yard", label: "Двор", fromMeters: 0, toMeters: 9, elevationMeters: 0, cover: "none", hazard: null, movementMultiplier: 1 },
        { id: "rubble", label: "Обломки", fromMeters: 9, toMeters: 20, elevationMeters: 1, cover: "partial", hazard: { id: "unstable", label: "Неустойчивые камни", severity: 1, actionModifier: -1 }, movementMultiplier: 2 },
        { id: "wall", label: "Разбитая стена", fromMeters: 20, toMeters: 32, elevationMeters: 2, cover: "full", hazard: null, movementMultiplier: 1 },
      ],
    },
    positions: [6, 24],
  },
  forest: {
    name: "Лесная просека",
    description: "Кустарник и корни затрудняют движение и стрельбу.",
    layout: {
      minMeters: 0,
      maxMeters: 36,
      zones: [
        { id: "brush-a", label: "Кустарник", fromMeters: 0, toMeters: 11, elevationMeters: 0, cover: "partial", hazard: null, movementMultiplier: 2 },
        { id: "clearing", label: "Просека", fromMeters: 11, toMeters: 25, elevationMeters: 0, cover: "none", hazard: null, movementMultiplier: 1 },
        { id: "roots", label: "Корни", fromMeters: 25, toMeters: 36, elevationMeters: 0, cover: "partial", hazard: { id: "roots", label: "Переплетённые корни", severity: 1, actionModifier: -1 }, movementMultiplier: 2 },
      ],
    },
    positions: [8, 28],
  },
  bridge: {
    name: "Старый мост",
    description: "Узкое поле с опасными краями и преимуществом высоты в центре.",
    layout: {
      minMeters: 0,
      maxMeters: 24,
      zones: [
        { id: "bank-a", label: "Берег", fromMeters: 0, toMeters: 5, elevationMeters: 0, cover: "partial", hazard: null, movementMultiplier: 1 },
        { id: "bridge", label: "Мост", fromMeters: 5, toMeters: 19, elevationMeters: 3, cover: "none", hazard: { id: "edge", label: "Опасный край", severity: 2, actionModifier: -1 }, movementMultiplier: 1 },
        { id: "bank-b", label: "Берег", fromMeters: 19, toMeters: 24, elevationMeters: 0, cover: "partial", hazard: null, movementMultiplier: 1 },
      ],
    },
    positions: [3, 21],
  },
};

export function createEncounterState(options: {
  fighters: [PreparedFighter, PreparedFighter];
  active: BattlefieldSide;
  mode?: EncounterMode;
  monsterId?: string | null;
  presetId?: BattlefieldPresetId;
  round?: number;
}): EncounterState {
  const presetId = options.presetId ?? "crossroads";
  const preset = BATTLEFIELD_PRESETS[presetId];
  const battlefield = createBattlefieldState({
    layout: preset.layout,
    active: options.active,
    turnNumber: 1,
    actors: options.fighters.map((fighter, side) => ({
      positionMeters: preset.positions[side],
      sta: fighter.sta,
      maxSta: fighter.maxSta,
      moveMeters: Math.max(1, fighter.stats.SPD),
      sprintMeters: Math.max(1, fighter.run),
      stance: "standing" as const,
    })) as [{ positionMeters: number; sta: number; maxSta: number; moveMeters: number; sprintMeters: number; stance: "standing" }, { positionMeters: number; sta: number; maxSta: number; moveMeters: number; sprintMeters: number; stance: "standing" }],
  });
  return {
    version: 1,
    mode: options.mode ?? "pvp",
    monsterId: options.monsterId ?? null,
    aiSide: options.mode === "pve" ? 1 : null,
    presetId,
    battlefield,
    effects: [emptyEffects(), emptyEffects()],
    magic: createMagicState({
      currentVigor: [options.fighters[0].vigor, options.fighters[1].vigor],
      maxVigor: [options.fighters[0].maxVigor, options.fighters[1].maxVigor],
      distance: distanceBetween(battlefield),
      round: options.round ?? 1,
    }),
  };
}

export function syncEncounterFromFighters(state: EncounterState, fighters: [PreparedFighter, PreparedFighter]): EncounterState {
  const next = structuredClone(state);
  for (const side of [0, 1] as BattlefieldSide[]) {
    const woundAndConditionSpeed = effectModifiers(next.effects[side]).speed;
    const magicSlow = next.magic.conditions
      .filter((condition) => condition.target === side && condition.condition === "slowed")
      .reduce((sum, condition) => sum - condition.intensity * 2, 0);
    const speedModifier = woundAndConditionSpeed + magicSlow;
    next.battlefield.actors[side].sta = fighters[side].sta;
    next.battlefield.actors[side].maxSta = fighters[side].maxSta;
    const moveMeters = Math.max(0, fighters[side].stats.SPD + speedModifier);
    next.battlefield.actors[side].moveMeters = moveMeters;
    next.battlefield.actors[side].sprintMeters = Math.max(moveMeters, fighters[side].run + speedModifier * 3);
    next.magic.sides[side].vigor = fighters[side].vigor;
    next.magic.sides[side].maxVigor = fighters[side].maxVigor;
  }
  next.magic.distance = distanceBetween(next.battlefield);
  return next;
}

export function syncFightersFromEncounter(state: EncounterState, fighters: [PreparedFighter, PreparedFighter]): [PreparedFighter, PreparedFighter] {
  const next = structuredClone(fighters);
  for (const side of [0, 1] as BattlefieldSide[]) {
    next[side].sta = state.battlefield.actors[side].sta;
    next[side].vigor = state.magic.sides[side].vigor;
  }
  return next;
}

export function advanceEncounterTurn(state: EncounterState, nextSide: BattlefieldSide, round: number): EncounterState {
  const next = structuredClone(state);
  const advanced = advanceBattlefieldTurn(next.battlefield, nextSide);
  if (advanced.ok) next.battlefield = advanced.state;
  next.magic.round = round;
  next.magic.distance = distanceBetween(next.battlefield);
  return next;
}

export function isEncounterState(value: unknown): value is EncounterState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (Object.keys(state).length !== 8
    || state.version !== 1
    || (state.mode !== "pvp" && state.mode !== "pve")
    || (state.monsterId !== null && typeof state.monsterId !== "string")
    || (state.aiSide !== null && state.aiSide !== 0 && state.aiSide !== 1)
    || !Object.hasOwn(BATTLEFIELD_PRESETS, state.presetId as string)) return false;
  if (!validateBattlefieldState(state.battlefield).ok || !validateMagicState(state.magic).ok) return false;
  return Array.isArray(state.effects) && state.effects.length === 2 && state.effects.every(isCombatantEffects);
}
