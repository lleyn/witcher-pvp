/**
 * Pure, host-authoritative 1-v-1 battlefield rules.
 *
 * The module deliberately does not roll dice and does not depend on React.
 * A host declares an action, pays its cost once, and (for opposed actions)
 * later supplies the two check totals to `resolvePhysicalAction`.
 */

export const BATTLEFIELD_ACTION_TYPES = [
  "move", "sprint", "stand", "kneel", "go_prone", "grapple", "escape_grapple",
  "shove", "disarm", "knockdown", "stun", "aim", "ready",
] as const;

export const CONTESTED_PHYSICAL_ACTIONS = [
  "grapple", "escape_grapple", "shove", "disarm", "knockdown", "stun",
] as const;

export type BattlefieldSide = 0 | 1;
export type Stance = "standing" | "kneeling" | "prone";
export type CoverLevel = "none" | "partial" | "full";
export type DistanceZone = "engaged" | "close" | "near" | "far" | "extreme";
export type MovementMode = "stationary" | "moved" | "sprinted";
export type BattlefieldActionType = (typeof BATTLEFIELD_ACTION_TYPES)[number];
export type ContestedPhysicalAction = (typeof CONTESTED_PHYSICAL_ACTIONS)[number];

export type BattlefieldHazard = {
  id: string;
  label: string;
  severity: 1 | 2 | 3;
  /** Applied to checks made while standing in the zone. Usually negative. */
  actionModifier: number;
};

export type BattlefieldTerrainZone = {
  id: string;
  label: string;
  fromMeters: number;
  toMeters: number;
  elevationMeters: number;
  cover: CoverLevel;
  hazard: BattlefieldHazard | null;
  /** 1 is ordinary ground, 2 means that every metre consumes two metres of movement. */
  movementMultiplier: number;
};

export type BattlefieldLayout = {
  minMeters: number;
  maxMeters: number;
  zones: BattlefieldTerrainZone[];
};

export type MovementState = {
  mode: MovementMode;
  voluntaryMeters: number;
  forcedMeters: number;
  movementCost: number;
  startedAtMeters: number;
};

export type AimState = { target: BattlefieldSide; bonus: number };
export type ReadyState = { trigger: string };

export type BattlefieldActorState = {
  side: BattlefieldSide;
  positionMeters: number;
  stance: Stance;
  sta: number;
  maxSta: number;
  moveMeters: number;
  sprintMeters: number;
  movement: MovementState;
  grappledWith: BattlefieldSide | null;
  disarmed: boolean;
  stunnedTurns: number;
  aim: AimState | null;
  ready: ReadyState | null;
};

export type BattlefieldTurnState = {
  number: number;
  active: BattlefieldSide;
  movementUsed: boolean;
  actionUsed: boolean;
};

export type ModifierItem = {
  code: string;
  label: string;
  value: number;
};

export type BattlefieldModifiers = {
  attacker: number;
  defender: number;
  attackerItems: ModifierItem[];
  defenderItems: ModifierItem[];
};

type DeclarationBase<T extends BattlefieldActionType> = {
  id: string;
  type: T;
  actor: BattlefieldSide;
};

export type MoveDeclaration =
  | (DeclarationBase<"move"> & { toMeters: number })
  | (DeclarationBase<"sprint"> & { toMeters: number });
export type StanceDeclaration =
  | DeclarationBase<"stand">
  | DeclarationBase<"kneel">
  | DeclarationBase<"go_prone">;
export type TargetDeclaration = {
  [Action in ContestedPhysicalAction]: DeclarationBase<Action> & { target: BattlefieldSide };
}[ContestedPhysicalAction];
export type AimDeclaration = DeclarationBase<"aim"> & { target: BattlefieldSide };
export type ReadyDeclaration = DeclarationBase<"ready"> & { trigger?: string };

export type PhysicalActionDeclaration =
  | MoveDeclaration
  | StanceDeclaration
  | TargetDeclaration
  | AimDeclaration
  | ReadyDeclaration;

export type PendingPhysicalAction = {
  declaration: TargetDeclaration;
  staminaSpent: number;
  modifiers: BattlefieldModifiers;
  distanceMeters: number;
};

export type BattlefieldState = {
  revision: number;
  layout: BattlefieldLayout;
  actors: [BattlefieldActorState, BattlefieldActorState];
  turn: BattlefieldTurnState;
  pending: PendingPhysicalAction | null;
};

export type DistanceBands = {
  engagedMax: number;
  closeMax: number;
  nearMax: number;
  farMax: number;
};

export type BattlefieldRules = {
  distanceBands: DistanceBands;
  staminaCosts: Record<BattlefieldActionType, number>;
  stanceMovementMultipliers: Record<Stance, number>;
  modifiers: {
    kneelingAction: number;
    proneAction: number;
    kneelingDefense: number;
    proneDefense: number;
    movedAction: number;
    sprintedAction: number;
    movedDefense: number;
    sprintedDefense: number;
    partialCoverDefense: number;
    fullCoverDefense: number;
    elevationStepMeters: number;
    maximumElevationModifier: number;
    readyDefense: number;
    aim: number;
  };
  shoveMeters: number;
  stunTurns: number;
};

export type BattlefieldRulesOverrides = {
  distanceBands?: Partial<DistanceBands>;
  staminaCosts?: Partial<Record<BattlefieldActionType, number>>;
  stanceMovementMultipliers?: Partial<Record<Stance, number>>;
  modifiers?: Partial<BattlefieldRules["modifiers"]>;
  shoveMeters?: number;
  stunTurns?: number;
};

export const DEFAULT_BATTLEFIELD_RULES: BattlefieldRules = {
  distanceBands: { engagedMax: 2, closeMax: 6, nearMax: 12, farMax: 30 },
  staminaCosts: {
    move: 0,
    sprint: 2,
    stand: 0,
    kneel: 0,
    go_prone: 0,
    grapple: 2,
    escape_grapple: 2,
    shove: 2,
    disarm: 3,
    knockdown: 3,
    stun: 3,
    aim: 0,
    ready: 0,
  },
  stanceMovementMultipliers: { standing: 1, kneeling: 2, prone: Number.POSITIVE_INFINITY },
  modifiers: {
    kneelingAction: -1,
    proneAction: -3,
    kneelingDefense: -1,
    proneDefense: -2,
    movedAction: -1,
    sprintedAction: -3,
    movedDefense: 1,
    sprintedDefense: 2,
    partialCoverDefense: 2,
    fullCoverDefense: 5,
    elevationStepMeters: 2,
    maximumElevationModifier: 2,
    readyDefense: 1,
    aim: 1,
  },
  shoveMeters: 2,
  stunTurns: 1,
};

export type BattlefieldValidationCode =
  | "invalid_state"
  | "invalid_declaration"
  | "invalid_resolution"
  | "stale_revision"
  | "wrong_actor"
  | "pending_action"
  | "no_pending_action"
  | "wrong_declaration"
  | "movement_already_used"
  | "action_already_used"
  | "insufficient_stamina"
  | "out_of_bounds"
  | "too_far"
  | "wrong_stance"
  | "grapple_restriction"
  | "invalid_target"
  | "stunned";

export type BattlefieldValidationResult =
  | { ok: true }
  | { ok: false; code: BattlefieldValidationCode; message: string };

export type BattlefieldEffect =
  | { type: "position"; side: BattlefieldSide; fromMeters: number; toMeters: number; forced: boolean }
  | { type: "stance"; side: BattlefieldSide; from: Stance; to: Stance }
  | { type: "stamina"; side: BattlefieldSide; before: number; after: number; spent: number }
  | { type: "grapple"; sides: [BattlefieldSide, BattlefieldSide]; active: boolean }
  | { type: "disarmed"; side: BattlefieldSide }
  | { type: "stunned"; side: BattlefieldSide; turns: number }
  | { type: "aim"; side: BattlefieldSide; target: BattlefieldSide; bonus: number }
  | { type: "ready"; side: BattlefieldSide; trigger: string }
  | { type: "hazard_entry"; side: BattlefieldSide; hazard: BattlefieldHazard };

export type ImmediatePhysicalActionResult = {
  kind: "applied";
  declaration: PhysicalActionDeclaration;
  staminaSpent: number;
  modifiers: BattlefieldModifiers;
  effects: BattlefieldEffect[];
};

export type PendingPhysicalActionResult = {
  kind: "contest_required";
  declaration: TargetDeclaration;
  staminaSpent: number;
  modifiers: BattlefieldModifiers;
};

export type ResolvedPhysicalActionResult = {
  kind: "resolved";
  declaration: TargetDeclaration;
  success: boolean;
  margin: number;
  attackerTotal: number;
  defenderTotal: number;
  staminaSpent: number;
  modifiers: BattlefieldModifiers;
  effects: BattlefieldEffect[];
};

export type PhysicalActionResult =
  | ImmediatePhysicalActionResult
  | PendingPhysicalActionResult
  | ResolvedPhysicalActionResult;

export type BattlefieldTransition =
  | { ok: true; state: BattlefieldState; result: PhysicalActionResult }
  | { ok: false; code: BattlefieldValidationCode; message: string };

export type BattlefieldActionConsumptionResult =
  | { ok: true; state: BattlefieldState; staminaSpent: number }
  | { ok: false; code: BattlefieldValidationCode; message: string };

export type PhysicalActionResolution = {
  declarationId: string;
  expectedRevision: number;
  /** Skill/stat base plus die result, before battlefield modifiers. */
  attackerCheck: number;
  /** Skill/stat base plus die result, before battlefield modifiers. */
  defenderCheck: number;
};

export type BattlefieldActorSetup = {
  positionMeters: number;
  sta: number;
  maxSta: number;
  moveMeters: number;
  sprintMeters: number;
  stance?: Stance;
};

export type BattlefieldSetup = {
  layout: BattlefieldLayout;
  actors: [BattlefieldActorSetup, BattlefieldActorSetup];
  active?: BattlefieldSide;
  turnNumber?: number;
};

/** Structural shape accepted from PreparedFighter without importing the character module. */
export type BattlefieldFighterLike = {
  sta: number;
  maxSta: number;
  /** Explicit values win when a future fighter model exposes them. */
  moveMeters?: number;
  sprintMeters?: number;
  /** Current Witcher sheets expose SPD and RUN (RUN = SPD x 3). */
  stats?: { SPD?: number };
  run?: number;
};

const ACTION_SET = new Set<string>(BATTLEFIELD_ACTION_TYPES);
const CONTEST_SET = new Set<string>(CONTESTED_PHYSICAL_ACTIONS);
const STANCES = new Set<string>(["standing", "kneeling", "prone"]);
const COVER_LEVELS = new Set<string>(["none", "partial", "full"]);
const MOVEMENT_MODES = new Set<string>(["stationary", "moved", "sprinted"]);
const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSide(value: unknown): value is BattlefieldSide {
  return value === 0 || value === 1;
}

function otherSide(side: BattlefieldSide): BattlefieldSide {
  return side === 0 ? 1 : 0;
}

function failure(code: BattlefieldValidationCode, message: string): BattlefieldValidationResult {
  return { ok: false, code, message };
}

export function mergeBattlefieldRules(overrides: BattlefieldRulesOverrides = {}): BattlefieldRules {
  return {
    distanceBands: { ...DEFAULT_BATTLEFIELD_RULES.distanceBands, ...overrides.distanceBands },
    staminaCosts: { ...DEFAULT_BATTLEFIELD_RULES.staminaCosts, ...overrides.staminaCosts },
    stanceMovementMultipliers: { ...DEFAULT_BATTLEFIELD_RULES.stanceMovementMultipliers, ...overrides.stanceMovementMultipliers },
    modifiers: { ...DEFAULT_BATTLEFIELD_RULES.modifiers, ...overrides.modifiers },
    shoveMeters: overrides.shoveMeters ?? DEFAULT_BATTLEFIELD_RULES.shoveMeters,
    stunTurns: overrides.stunTurns ?? DEFAULT_BATTLEFIELD_RULES.stunTurns,
  };
}

function idleMovement(positionMeters: number): MovementState {
  return { mode: "stationary", voluntaryMeters: 0, forcedMeters: 0, movementCost: 0, startedAtMeters: positionMeters };
}

export function createBattlefieldState(setup: BattlefieldSetup): BattlefieldState {
  const actors = setup.actors.map((actor, side) => ({
    side: side as BattlefieldSide,
    positionMeters: actor.positionMeters,
    stance: actor.stance ?? "standing",
    sta: actor.sta,
    maxSta: actor.maxSta,
    moveMeters: actor.moveMeters,
    sprintMeters: actor.sprintMeters,
    movement: idleMovement(actor.positionMeters),
    grappledWith: null,
    disarmed: false,
    stunnedTurns: 0,
    aim: null,
    ready: null,
  })) as [BattlefieldActorState, BattlefieldActorState];
  return {
    revision: 0,
    layout: structuredClone(setup.layout),
    actors,
    turn: { number: setup.turnNumber ?? 1, active: setup.active ?? 0, movementUsed: false, actionUsed: false },
    pending: null,
  };
}

export function validateBattlefieldLayout(layout: unknown): BattlefieldValidationResult {
  if (!isRecord(layout) || !isFiniteNumber(layout.minMeters) || !isFiniteNumber(layout.maxMeters)
    || layout.maxMeters <= layout.minMeters || !Array.isArray(layout.zones)) {
    return failure("invalid_state", "Battlefield bounds or zones are invalid.");
  }
  const ids = new Set<string>();
  const zones = layout.zones;
  for (const zone of zones) {
    if (!isRecord(zone) || typeof zone.id !== "string" || !ID_PATTERN.test(zone.id) || ids.has(zone.id)
      || typeof zone.label !== "string" || zone.label.length > 200
      || !isFiniteNumber(zone.fromMeters) || !isFiniteNumber(zone.toMeters)
      || zone.fromMeters < layout.minMeters || zone.toMeters > layout.maxMeters || zone.toMeters <= zone.fromMeters
      || !isFiniteNumber(zone.elevationMeters) || !COVER_LEVELS.has(String(zone.cover))
      || !isFiniteNumber(zone.movementMultiplier) || zone.movementMultiplier < 1) {
      return failure("invalid_state", "A battlefield terrain zone is invalid.");
    }
    ids.add(zone.id);
    if (zone.hazard !== null) {
      const hazard = zone.hazard;
      if (!isRecord(hazard) || typeof hazard.id !== "string" || !ID_PATTERN.test(hazard.id)
        || typeof hazard.label !== "string" || hazard.label.length > 200
        || ![1, 2, 3].includes(hazard.severity as number) || !isFiniteNumber(hazard.actionModifier)) {
        return failure("invalid_state", "A battlefield hazard is invalid.");
      }
    }
  }
  const ordered = [...zones].sort((a, b) => (a as BattlefieldTerrainZone).fromMeters - (b as BattlefieldTerrainZone).fromMeters) as BattlefieldTerrainZone[];
  if (ordered.some((zone, index) => index > 0 && zone.fromMeters < ordered[index - 1].toMeters)) {
    return failure("invalid_state", "Terrain zones may touch but may not overlap.");
  }
  return { ok: true };
}

function validMovement(value: unknown): value is MovementState {
  return isRecord(value) && MOVEMENT_MODES.has(String(value.mode))
    && isFiniteNumber(value.voluntaryMeters) && value.voluntaryMeters >= 0
    && isFiniteNumber(value.forcedMeters) && value.forcedMeters >= 0
    && isFiniteNumber(value.movementCost) && value.movementCost >= 0
    && isFiniteNumber(value.startedAtMeters);
}

function validActor(value: unknown, side: BattlefieldSide, layout: BattlefieldLayout): value is BattlefieldActorState {
  if (!isRecord(value) || value.side !== side || !isFiniteNumber(value.positionMeters)
    || value.positionMeters < layout.minMeters || value.positionMeters > layout.maxMeters
    || !STANCES.has(String(value.stance)) || !isFiniteNumber(value.sta) || value.sta < 0
    || !isFiniteNumber(value.maxSta) || value.maxSta < value.sta
    || !isFiniteNumber(value.moveMeters) || value.moveMeters < 0
    || !isFiniteNumber(value.sprintMeters) || value.sprintMeters < value.moveMeters
    || !validMovement(value.movement)
    || !(value.grappledWith === null || (isSide(value.grappledWith) && value.grappledWith !== side))
    || typeof value.disarmed !== "boolean" || !Number.isSafeInteger(value.stunnedTurns) || (value.stunnedTurns as number) < 0) return false;
  const aim = value.aim;
  if (!(aim === null || (isRecord(aim) && isSide(aim.target) && aim.target !== side && isFiniteNumber(aim.bonus)))) return false;
  const ready = value.ready;
  return ready === null || (isRecord(ready) && typeof ready.trigger === "string" && ready.trigger.length <= 200);
}

export function validateBattlefieldState(value: unknown): BattlefieldValidationResult {
  if (!isRecord(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    return failure("invalid_state", "Battlefield revision is invalid.");
  }
  const layoutCheck = validateBattlefieldLayout(value.layout);
  if (!layoutCheck.ok) return layoutCheck;
  const layout = value.layout as BattlefieldLayout;
  if (!Array.isArray(value.actors) || value.actors.length !== 2
    || !validActor(value.actors[0], 0, layout) || !validActor(value.actors[1], 1, layout)) {
    return failure("invalid_state", "Battlefield actors are invalid.");
  }
  const [first, second] = value.actors as [BattlefieldActorState, BattlefieldActorState];
  if ((first.grappledWith === 1) !== (second.grappledWith === 0)) {
    return failure("invalid_state", "A grapple must be represented symmetrically.");
  }
  if (!isRecord(value.turn) || !Number.isSafeInteger(value.turn.number) || (value.turn.number as number) < 1
    || !isSide(value.turn.active) || typeof value.turn.movementUsed !== "boolean" || typeof value.turn.actionUsed !== "boolean") {
    return failure("invalid_state", "Battlefield turn state is invalid.");
  }
  if (value.pending !== null && !isPendingPhysicalAction(value.pending)) {
    return failure("invalid_state", "Pending physical action is invalid.");
  }
  return { ok: true };
}

export function isPhysicalActionDeclaration(value: unknown): value is PhysicalActionDeclaration {
  if (!isRecord(value) || typeof value.id !== "string" || !ID_PATTERN.test(value.id)
    || !ACTION_SET.has(String(value.type)) || !isSide(value.actor)) return false;
  const type = value.type as BattlefieldActionType;
  const keys = Object.keys(value);
  if (type === "move" || type === "sprint") {
    return keys.length === 4 && keys.every((key) => key === "id" || key === "type" || key === "actor" || key === "toMeters")
      && isFiniteNumber(value.toMeters);
  }
  if (type === "stand" || type === "kneel" || type === "go_prone") {
    return keys.length === 3 && keys.every((key) => key === "id" || key === "type" || key === "actor");
  }
  if (type === "aim" || CONTEST_SET.has(type)) {
    return keys.length === 4 && keys.every((key) => key === "id" || key === "type" || key === "actor" || key === "target")
      && isSide(value.target) && value.target !== value.actor;
  }
  if (type !== "ready" || !keys.every((key) => key === "id" || key === "type" || key === "actor" || key === "trigger")) return false;
  return (keys.length === 3 || keys.length === 4)
    && (value.trigger === undefined || (typeof value.trigger === "string" && value.trigger.length <= 200));
}

function isModifierItems(value: unknown): value is ModifierItem[] {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.code === "string"
    && typeof item.label === "string" && isFiniteNumber(item.value));
}

function isPendingPhysicalAction(value: unknown): value is PendingPhysicalAction {
  if (!isRecord(value) || !isPhysicalActionDeclaration(value.declaration)
    || !CONTEST_SET.has(value.declaration.type) || !isFiniteNumber(value.staminaSpent)
    || value.staminaSpent < 0 || !isFiniteNumber(value.distanceMeters) || !isRecord(value.modifiers)) return false;
  const modifiers = value.modifiers;
  return isFiniteNumber(modifiers.attacker) && isFiniteNumber(modifiers.defender)
    && isModifierItems(modifiers.attackerItems) && isModifierItems(modifiers.defenderItems);
}

export function validatePhysicalActionResolution(value: unknown): BattlefieldValidationResult {
  if (!isRecord(value) || typeof value.declarationId !== "string" || !ID_PATTERN.test(value.declarationId)
    || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0
    || !isFiniteNumber(value.attackerCheck) || !isFiniteNumber(value.defenderCheck)) {
    return failure("invalid_resolution", "Physical action resolution is invalid.");
  }
  return { ok: true };
}

export function zoneAtPosition(layout: BattlefieldLayout, positionMeters: number): BattlefieldTerrainZone | null {
  return layout.zones.find((zone) => positionMeters >= zone.fromMeters
    && (positionMeters < zone.toMeters || (positionMeters === layout.maxMeters && zone.toMeters === layout.maxMeters))) ?? null;
}

export function distanceBetween(state: BattlefieldState): number {
  return Math.abs(state.actors[0].positionMeters - state.actors[1].positionMeters);
}

export function distanceZone(distanceMeters: number, rules: BattlefieldRules = DEFAULT_BATTLEFIELD_RULES): DistanceZone {
  const distance = Math.max(0, distanceMeters);
  if (distance <= rules.distanceBands.engagedMax) return "engaged";
  if (distance <= rules.distanceBands.closeMax) return "close";
  if (distance <= rules.distanceBands.nearMax) return "near";
  if (distance <= rules.distanceBands.farMax) return "far";
  return "extreme";
}

export function actorPositionContext(state: BattlefieldState, side: BattlefieldSide, rules: BattlefieldRules = DEFAULT_BATTLEFIELD_RULES) {
  const actor = state.actors[side];
  const zone = zoneAtPosition(state.layout, actor.positionMeters);
  return {
    positionMeters: actor.positionMeters,
    distanceToOpponentMeters: Math.abs(actor.positionMeters - state.actors[otherSide(side)].positionMeters),
    distanceZone: distanceZone(Math.abs(actor.positionMeters - state.actors[otherSide(side)].positionMeters), rules),
    elevationMeters: zone?.elevationMeters ?? 0,
    cover: zone?.cover ?? "none" as CoverLevel,
    hazard: zone?.hazard ?? null,
    terrainZone: zone,
  };
}

/** Weighted distance across terrain boundaries, used against move/sprint allowance. */
export function movementCostBetween(layout: BattlefieldLayout, fromMeters: number, toMeters: number): number {
  if (fromMeters === toMeters) return 0;
  const low = Math.min(fromMeters, toMeters);
  const high = Math.max(fromMeters, toMeters);
  const boundaries = new Set<number>([low, high]);
  for (const zone of layout.zones) {
    if (zone.fromMeters > low && zone.fromMeters < high) boundaries.add(zone.fromMeters);
    if (zone.toMeters > low && zone.toMeters < high) boundaries.add(zone.toMeters);
  }
  const points = [...boundaries].sort((a, b) => a - b);
  let cost = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const midpoint = start + (end - start) / 2;
    cost += (end - start) * (zoneAtPosition(layout, midpoint)?.movementMultiplier ?? 1);
  }
  return cost;
}

function addModifier(items: ModifierItem[], code: string, label: string, value: number) {
  if (value !== 0) items.push({ code, label, value });
}

export function physicalActionModifiers(
  state: BattlefieldState,
  actorSide: BattlefieldSide,
  targetSide: BattlefieldSide,
  rules: BattlefieldRules = DEFAULT_BATTLEFIELD_RULES,
): BattlefieldModifiers {
  const actor = state.actors[actorSide];
  const target = state.actors[targetSide];
  const actorContext = actorPositionContext(state, actorSide, rules);
  const targetContext = actorPositionContext(state, targetSide, rules);
  const attackerItems: ModifierItem[] = [];
  const defenderItems: ModifierItem[] = [];

  if (actor.stance === "kneeling") addModifier(attackerItems, "stance_kneeling", "Атакующий на колене", rules.modifiers.kneelingAction);
  if (actor.stance === "prone") addModifier(attackerItems, "stance_prone", "Атакующий лежит", rules.modifiers.proneAction);
  if (target.stance === "kneeling") addModifier(defenderItems, "stance_kneeling", "Защитник на колене", rules.modifiers.kneelingDefense);
  if (target.stance === "prone") addModifier(defenderItems, "stance_prone", "Защитник лежит", rules.modifiers.proneDefense);
  if (actor.movement.mode === "moved") addModifier(attackerItems, "moved", "Движение", rules.modifiers.movedAction);
  if (actor.movement.mode === "sprinted") addModifier(attackerItems, "sprinted", "Спринт", rules.modifiers.sprintedAction);
  if (target.movement.mode === "moved") addModifier(defenderItems, "target_moved", "Цель двигалась", rules.modifiers.movedDefense);
  if (target.movement.mode === "sprinted") addModifier(defenderItems, "target_sprinted", "Цель спринтовала", rules.modifiers.sprintedDefense);
  if (targetContext.cover === "partial") addModifier(defenderItems, "partial_cover", "Частичное укрытие", rules.modifiers.partialCoverDefense);
  if (targetContext.cover === "full") addModifier(defenderItems, "full_cover", "Полное укрытие", rules.modifiers.fullCoverDefense);
  if (target.ready) addModifier(defenderItems, "ready", "Подготовленное действие", rules.modifiers.readyDefense);
  if (actor.aim?.target === targetSide) addModifier(attackerItems, "aim", "Прицеливание", actor.aim.bonus);
  if (actorContext.hazard) addModifier(attackerItems, `hazard:${actorContext.hazard.id}`, actorContext.hazard.label, actorContext.hazard.actionModifier);
  if (targetContext.hazard) addModifier(defenderItems, `hazard:${targetContext.hazard.id}`, targetContext.hazard.label, targetContext.hazard.actionModifier);

  const elevationDifference = actorContext.elevationMeters - targetContext.elevationMeters;
  const elevation = Math.max(-rules.modifiers.maximumElevationModifier, Math.min(
    rules.modifiers.maximumElevationModifier,
    Math.trunc(elevationDifference / rules.modifiers.elevationStepMeters),
  ));
  addModifier(attackerItems, "elevation", elevation > 0 ? "Преимущество высоты" : "Цель выше", elevation);

  return {
    attacker: attackerItems.reduce((sum, item) => sum + item.value, 0),
    defender: defenderItems.reduce((sum, item) => sum + item.value, 0),
    attackerItems,
    defenderItems,
  };
}

function actionUsesMovement(type: BattlefieldActionType) {
  return type === "move" || type === "sprint" || type === "stand" || type === "kneel" || type === "go_prone";
}

function actionUsesMainAction(type: BattlefieldActionType) {
  return type !== "move" && type !== "stand" && type !== "kneel" && type !== "go_prone";
}

export function validatePhysicalAction(
  state: BattlefieldState,
  declaration: unknown,
  rules: BattlefieldRules = DEFAULT_BATTLEFIELD_RULES,
): BattlefieldValidationResult {
  const stateCheck = validateBattlefieldState(state);
  if (!stateCheck.ok) return stateCheck;
  if (!isPhysicalActionDeclaration(declaration)) return failure("invalid_declaration", "Physical action declaration is invalid.");
  if (state.pending) return failure("pending_action", "Resolve the pending physical action first.");
  if (declaration.actor !== state.turn.active) return failure("wrong_actor", "Only the active fighter may act.");
  const actor = state.actors[declaration.actor];
  if (actor.stunnedTurns > 0) return failure("stunned", "A stunned fighter cannot declare an action.");
  if (actionUsesMovement(declaration.type) && state.turn.movementUsed) return failure("movement_already_used", "Movement has already been used this turn.");
  if (actionUsesMainAction(declaration.type) && state.turn.actionUsed) return failure("action_already_used", "The main action has already been used this turn.");
  const cost = rules.staminaCosts[declaration.type];
  if (!isFiniteNumber(cost) || cost < 0 || actor.sta < cost) return failure("insufficient_stamina", "Not enough stamina for this action.");

  if (declaration.type === "move" || declaration.type === "sprint") {
    if (declaration.toMeters < state.layout.minMeters || declaration.toMeters > state.layout.maxMeters) return failure("out_of_bounds", "Destination is outside the battlefield.");
    if (actor.grappledWith !== null) return failure("grapple_restriction", "Escape the grapple before moving.");
    if (actor.stance === "prone") return failure("wrong_stance", "Stand or kneel before moving.");
    if (declaration.type === "sprint" && actor.stance !== "standing") return failure("wrong_stance", "Only a standing fighter can sprint.");
    const terrainCost = movementCostBetween(state.layout, actor.positionMeters, declaration.toMeters);
    const adjustedCost = terrainCost * rules.stanceMovementMultipliers[actor.stance];
    const allowance = declaration.type === "sprint" ? actor.sprintMeters : actor.moveMeters;
    if (adjustedCost > allowance + Number.EPSILON) return failure("too_far", "Destination exceeds this action's movement allowance.");
    return { ok: true };
  }

  if (declaration.type === "stand" && actor.stance === "standing") return failure("wrong_stance", "The fighter is already standing.");
  if (declaration.type === "kneel" && actor.stance === "kneeling") return failure("wrong_stance", "The fighter is already kneeling.");
  if (declaration.type === "go_prone" && actor.stance === "prone") return failure("wrong_stance", "The fighter is already prone.");
  if ((declaration.type === "stand" || declaration.type === "kneel" || declaration.type === "go_prone") && actor.grappledWith !== null) {
    return failure("grapple_restriction", "A grapple prevents changing stance.");
  }

  if (declaration.type === "ready") return { ok: true };
  const target = "target" in declaration ? declaration.target : null;
  if (target === null || target === declaration.actor || target !== otherSide(declaration.actor)) return failure("invalid_target", "The opposing fighter must be the target.");
  if (declaration.type === "aim") {
    if (actor.grappledWith !== null) return failure("grapple_restriction", "A grapple prevents aiming.");
    return { ok: true };
  }
  if (declaration.type === "escape_grapple") {
    return actor.grappledWith === target
      ? { ok: true }
      : failure("grapple_restriction", "The fighter is not grappled by this target.");
  }
  if (actor.grappledWith !== null) return failure("grapple_restriction", "Only escape is available while grappled.");
  if (declaration.type === "grapple" && state.actors[target].grappledWith !== null) {
    return failure("grapple_restriction", "The target is already in a grapple.");
  }
  if (distanceZone(Math.abs(actor.positionMeters - state.actors[target].positionMeters), rules) !== "engaged") {
    return failure("too_far", "This physical action requires engaged range.");
  }
  return { ok: true };
}

function cloneState(state: BattlefieldState): BattlefieldState {
  return structuredClone(state);
}

function spendStamina(next: BattlefieldState, side: BattlefieldSide, amount: number, effects: BattlefieldEffect[]) {
  if (amount <= 0) return;
  const actor = next.actors[side];
  const before = actor.sta;
  actor.sta = Math.max(0, actor.sta - amount);
  effects.push({ type: "stamina", side, before, after: actor.sta, spent: amount });
}

function clearPreparedStates(actor: BattlefieldActorState) {
  actor.aim = null;
  actor.ready = null;
}

function hazardEntryEffect(state: BattlefieldState, side: BattlefieldSide, from: number, to: number): BattlefieldEffect | null {
  const before = zoneAtPosition(state.layout, from)?.hazard ?? null;
  const after = zoneAtPosition(state.layout, to)?.hazard ?? null;
  return after && before?.id !== after.id ? { type: "hazard_entry", side, hazard: structuredClone(after) } : null;
}

export function declarePhysicalAction(
  state: BattlefieldState,
  declaration: PhysicalActionDeclaration,
  rules: BattlefieldRules = DEFAULT_BATTLEFIELD_RULES,
): BattlefieldTransition {
  const checked = validatePhysicalAction(state, declaration, rules);
  if (!checked.ok) return checked;
  const next = cloneState(state);
  const actor = next.actors[declaration.actor];
  const cost = rules.staminaCosts[declaration.type];
  const effects: BattlefieldEffect[] = [];
  const target = "target" in declaration ? declaration.target : otherSide(declaration.actor);
  const modifiers = physicalActionModifiers(state, declaration.actor, target, rules);
  spendStamina(next, declaration.actor, cost, effects);

  if (actionUsesMovement(declaration.type)) next.turn.movementUsed = true;
  if (actionUsesMainAction(declaration.type)) next.turn.actionUsed = true;

  if (declaration.type === "move" || declaration.type === "sprint") {
    const from = actor.positionMeters;
    const rawDistance = Math.abs(declaration.toMeters - from);
    const terrainCost = movementCostBetween(next.layout, from, declaration.toMeters)
      * rules.stanceMovementMultipliers[actor.stance];
    actor.positionMeters = declaration.toMeters;
    actor.movement = {
      mode: declaration.type === "sprint" ? "sprinted" : "moved",
      voluntaryMeters: rawDistance,
      forcedMeters: actor.movement.forcedMeters,
      movementCost: terrainCost,
      startedAtMeters: actor.movement.startedAtMeters,
    };
    clearPreparedStates(actor);
    effects.push({ type: "position", side: declaration.actor, fromMeters: from, toMeters: declaration.toMeters, forced: false });
    const hazard = hazardEntryEffect(state, declaration.actor, from, declaration.toMeters);
    if (hazard) effects.push(hazard);
  } else if (declaration.type === "stand" || declaration.type === "kneel" || declaration.type === "go_prone") {
    const from = actor.stance;
    const to: Stance = declaration.type === "stand" ? "standing" : declaration.type === "kneel" ? "kneeling" : "prone";
    actor.stance = to;
    clearPreparedStates(actor);
    effects.push({ type: "stance", side: declaration.actor, from, to });
  } else if (declaration.type === "aim") {
    actor.aim = { target: declaration.target, bonus: rules.modifiers.aim };
    actor.ready = null;
    effects.push({ type: "aim", side: declaration.actor, target: declaration.target, bonus: rules.modifiers.aim });
  } else if (declaration.type === "ready") {
    const trigger = declaration.trigger?.trim().slice(0, 200) || "По заявленному условию";
    actor.ready = { trigger };
    actor.aim = null;
    effects.push({ type: "ready", side: declaration.actor, trigger });
  } else {
    clearPreparedStates(actor);
    const pending: PendingPhysicalAction = {
      declaration: structuredClone(declaration),
      staminaSpent: cost,
      modifiers,
      distanceMeters: Math.abs(actor.positionMeters - next.actors[declaration.target].positionMeters),
    };
    next.pending = pending;
    next.revision += 1;
    return {
      ok: true,
      state: next,
      result: { kind: "contest_required", declaration: pending.declaration, staminaSpent: cost, modifiers },
    };
  }

  next.revision += 1;
  return { ok: true, state: next, result: { kind: "applied", declaration, staminaSpent: cost, modifiers, effects } };
}

function applySuccessfulContest(
  next: BattlefieldState,
  declaration: TargetDeclaration,
  rules: BattlefieldRules,
): BattlefieldEffect[] {
  const effects: BattlefieldEffect[] = [];
  const actor = next.actors[declaration.actor];
  const target = next.actors[declaration.target];
  switch (declaration.type) {
    case "grapple":
      actor.grappledWith = declaration.target;
      target.grappledWith = declaration.actor;
      effects.push({ type: "grapple", sides: [declaration.actor, declaration.target], active: true });
      break;
    case "escape_grapple":
      actor.grappledWith = null;
      target.grappledWith = null;
      effects.push({ type: "grapple", sides: [declaration.actor, declaration.target], active: false });
      break;
    case "shove": {
      const from = target.positionMeters;
      const direction = target.positionMeters === actor.positionMeters
        ? (declaration.actor === 0 ? 1 : -1)
        : Math.sign(target.positionMeters - actor.positionMeters);
      const to = Math.max(next.layout.minMeters, Math.min(next.layout.maxMeters, from + direction * rules.shoveMeters));
      target.positionMeters = to;
      target.movement.forcedMeters += Math.abs(to - from);
      clearPreparedStates(target);
      effects.push({ type: "position", side: declaration.target, fromMeters: from, toMeters: to, forced: true });
      const hazard = hazardEntryEffect(next, declaration.target, from, to);
      if (hazard) effects.push(hazard);
      break;
    }
    case "disarm":
      target.disarmed = true;
      target.ready = null;
      effects.push({ type: "disarmed", side: declaration.target });
      break;
    case "knockdown": {
      const from = target.stance;
      target.stance = "prone";
      clearPreparedStates(target);
      effects.push({ type: "stance", side: declaration.target, from, to: "prone" });
      break;
    }
    case "stun":
      target.stunnedTurns = Math.max(target.stunnedTurns, rules.stunTurns);
      clearPreparedStates(target);
      effects.push({ type: "stunned", side: declaration.target, turns: target.stunnedTurns });
      break;
  }
  return effects;
}

export function resolvePhysicalAction(
  state: BattlefieldState,
  resolution: PhysicalActionResolution,
  rules: BattlefieldRules = DEFAULT_BATTLEFIELD_RULES,
): BattlefieldTransition {
  const stateCheck = validateBattlefieldState(state);
  if (!stateCheck.ok) return stateCheck;
  const resolutionCheck = validatePhysicalActionResolution(resolution);
  if (!resolutionCheck.ok) return resolutionCheck;
  if (!state.pending) return { ok: false, code: "no_pending_action", message: "There is no physical contest to resolve." };
  if (resolution.expectedRevision !== state.revision) return { ok: false, code: "stale_revision", message: "Battlefield state changed before this resolution." };
  if (resolution.declarationId !== state.pending.declaration.id) return { ok: false, code: "wrong_declaration", message: "Resolution does not match the pending declaration." };

  const next = cloneState(state);
  const pending = next.pending as PendingPhysicalAction;
  const attackerTotal = resolution.attackerCheck + pending.modifiers.attacker;
  const defenderTotal = resolution.defenderCheck + pending.modifiers.defender;
  const margin = attackerTotal - defenderTotal;
  const success = margin > 0;
  const effects = success ? applySuccessfulContest(next, pending.declaration, rules) : [];
  next.pending = null;
  next.revision += 1;
  return {
    ok: true,
    state: next,
    result: {
      kind: "resolved",
      declaration: pending.declaration,
      success,
      margin,
      attackerTotal,
      defenderTotal,
      staminaSpent: pending.staminaSpent,
      modifiers: pending.modifiers,
      effects,
    },
  };
}

/** Switch turns and reset movement/action slots. Stun expires after the affected fighter loses that turn. */
export function advanceBattlefieldTurn(state: BattlefieldState, nextSide: BattlefieldSide = otherSide(state.turn.active)):
  | { ok: true; state: BattlefieldState }
  | { ok: false; code: BattlefieldValidationCode; message: string } {
  const checked = validateBattlefieldState(state);
  if (!checked.ok) return checked;
  if (state.pending) return { ok: false, code: "pending_action", message: "Resolve the pending physical action before ending the turn." };
  const next = cloneState(state);
  const outgoing = next.actors[next.turn.active];
  if (outgoing.stunnedTurns > 0) outgoing.stunnedTurns -= 1;
  next.turn = { number: next.turn.number + 1, active: nextSide, movementUsed: false, actionUsed: false };
  const incoming = next.actors[nextSide];
  incoming.movement = idleMovement(incoming.positionMeters);
  next.revision += 1;
  return { ok: true, state: next };
}

/**
 * Reserve the main-action slot for an ordinary weapon attack, spell, or other
 * action resolved by a different module. The battlefield remains the source
 * of truth for action availability and stamina payment.
 */
export function consumeBattlefieldAction(
  state: BattlefieldState,
  side: BattlefieldSide,
  staminaSpent = 0,
): BattlefieldActionConsumptionResult {
  const checked = validateBattlefieldState(state);
  if (!checked.ok) return checked;
  if (!isFiniteNumber(staminaSpent) || staminaSpent < 0) {
    return { ok: false, code: "invalid_declaration", message: "Action stamina cost must be a non-negative finite number." };
  }
  if (state.pending) return { ok: false, code: "pending_action", message: "Resolve the pending physical action first." };
  if (state.turn.active !== side) return { ok: false, code: "wrong_actor", message: "Only the active fighter may act." };
  if (state.turn.actionUsed) return { ok: false, code: "action_already_used", message: "The main action has already been used this turn." };
  const actor = state.actors[side];
  if (actor.stunnedTurns > 0) return { ok: false, code: "stunned", message: "A stunned fighter cannot act." };
  if (actor.sta < staminaSpent) return { ok: false, code: "insufficient_stamina", message: "Not enough stamina for this action." };

  const next = cloneState(state);
  next.turn.actionUsed = true;
  next.actors[side].sta -= staminaSpent;
  next.revision += 1;
  return { ok: true, state: next, staminaSpent };
}

/**
 * Pull current resources from the duel fighters into battlefield state.
 * PreparedFighter maps naturally: move = SPD and sprint = RUN. Explicit
 * `moveMeters` / `sprintMeters` values override that legacy mapping.
 */
export function syncBattlefieldFighters(
  state: BattlefieldState,
  fighters: [BattlefieldFighterLike, BattlefieldFighterLike],
): BattlefieldState {
  const next = cloneState(state);
  let changed = false;
  for (const side of [0, 1] as const) {
    const source = fighters[side];
    const actor = next.actors[side];
    const maxSta = isFiniteNumber(source.maxSta) ? Math.max(0, source.maxSta) : actor.maxSta;
    const sta = isFiniteNumber(source.sta) ? Math.max(0, Math.min(maxSta, source.sta)) : actor.sta;
    const inferredMove = source.moveMeters ?? source.stats?.SPD
      ?? (isFiniteNumber(source.run) ? source.run / 3 : actor.moveMeters);
    const moveMeters = isFiniteNumber(inferredMove) ? Math.max(0, inferredMove) : actor.moveMeters;
    const inferredSprint = source.sprintMeters ?? source.run ?? moveMeters * 3;
    const sprintMeters = isFiniteNumber(inferredSprint) ? Math.max(moveMeters, inferredSprint) : actor.sprintMeters;
    if (actor.sta !== sta || actor.maxSta !== maxSta || actor.moveMeters !== moveMeters || actor.sprintMeters !== sprintMeters) changed = true;
    actor.sta = sta;
    actor.maxSta = maxSta;
    actor.moveMeters = moveMeters;
    actor.sprintMeters = sprintMeters;
  }
  if (changed) next.revision += 1;
  return changed ? next : state;
}

/** Consume aim from an ordinary combat attack without coupling this module to the dice engine. */
export function consumeAim(
  state: BattlefieldState,
  actor: BattlefieldSide,
  target: BattlefieldSide,
): { state: BattlefieldState; modifier: number } {
  const next = cloneState(state);
  const modifier = next.actors[actor].aim?.target === target ? next.actors[actor].aim?.bonus ?? 0 : 0;
  next.actors[actor].aim = null;
  if (modifier !== 0) next.revision += 1;
  return { state: next, modifier };
}

/** Consume a readied state when the external combat controller fires its trigger. */
export function consumeReady(state: BattlefieldState, side: BattlefieldSide): { state: BattlefieldState; ready: ReadyState | null } {
  const next = cloneState(state);
  const ready = next.actors[side].ready;
  next.actors[side].ready = null;
  if (ready) next.revision += 1;
  return { state: next, ready };
}

/** Clear the disarmed marker after an external pickup/draw-weapon operation. */
export function clearDisarmed(state: BattlefieldState, side: BattlefieldSide): BattlefieldState {
  if (!state.actors[side].disarmed) return state;
  const next = cloneState(state);
  next.actors[side].disarmed = false;
  next.revision += 1;
  return next;
}
