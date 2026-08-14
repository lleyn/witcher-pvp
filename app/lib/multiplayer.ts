import type { CombatSettings, DefenseMode, LogEntry, PendingAttack, StrikeMode } from "./combat";
import {
  EXTRA_ATTACK_HIT_MODIFIER,
  EXTRA_ATTACK_STAMINA_COST,
  declareTurnAttack,
  isAttackTurnState,
  standardAttackComplete,
  type AttackTurnError,
  type AttackTurnState,
} from "./turn-economy.ts";
import type { LocationKey, PreparedFighter } from "./witcher";

export const MULTIPLAYER_PROTOCOL_VERSION = 2 as const;
export const MAX_FIGHTER_MESSAGE_BYTES = 1_000_000;
export const MAX_SNAPSHOT_MESSAGE_BYTES = 4_000_000;

export type Side = 0 | 1;
export type RoomPhase = "setup" | "combat" | "complete";
export type RoomStage = "setup" | "action" | "defense" | "resolution" | "complete";

export type AttackDeclaration = {
  attacker: Side;
  defender: Side;
  weaponUid: string;
  strikeMode: StrikeMode;
  locationChoice: LocationKey | "random";
  modifier: number;
  modifierNote: string;
  /** Derived by the host from attackTurn; clients never send this value. */
  extra: boolean;
  /** Only the extra-action modifier. Strong-strike accuracy remains in combat.ts. */
  automaticModifier: 0 | typeof EXTRA_ATTACK_HIT_MODIFIER;
  staminaCost: 0 | typeof EXTRA_ATTACK_STAMINA_COST;
};

export type RoomPlayer = {
  side: Side;
  connected: boolean;
  ready: boolean;
};

/**
 * The host owns this entire value and increments revision after every accepted
 * action. Guests render snapshots; they never calculate dice or damage locally.
 */
export type RoomSnapshot = {
  protocolVersion: typeof MULTIPLAYER_PROTOCOL_VERSION;
  roomId: string;
  revision: number;
  phase: RoomPhase;
  stage: RoomStage;
  players: [RoomPlayer, RoomPlayer];
  prepared: [PreparedFighter | null, PreparedFighter | null];
  fighters: [PreparedFighter, PreparedFighter] | null;
  settings: CombatSettings;
  active: Side;
  /** Needed because initiative totals can tie while side 1 still wins the tie-break. */
  firstSide: Side;
  initiative: [number, number];
  round: number;
  turn: number;
  attackTurn: AttackTurnState;
  attackDeclaration: AttackDeclaration | null;
  pending: PendingAttack | null;
  log: LogEntry[];
};

export type DeclareAttackAction = {
  type: "declare_attack";
  weaponUid: string;
  strikeMode: StrikeMode;
  locationChoice: LocationKey | "random";
  modifier: number;
  modifierNote: string;
};

export type ClientAction =
  | { type: "submit_fighter"; fighter: PreparedFighter }
  | { type: "set_ready"; ready: boolean }
  | { type: "set_settings"; settings: CombatSettings }
  | { type: "start_battle" }
  | DeclareAttackAction
  | { type: "choose_defense"; defenseMode: DefenseMode }
  | { type: "apply_pending" }
  | { type: "finish_miss" }
  | { type: "end_turn" }
  | { type: "recover" }
  | { type: "pass" }
  | { type: "continue_battle" }
  | { type: "reset_room" };

export type ClientMessage =
  | {
      type: "hello";
      protocolVersion: number;
      roomId: string;
      requestId: string;
    }
  | {
      type: "request_snapshot";
      protocolVersion: number;
      roomId: string;
      requestId: string;
    }
  | {
      type: "action";
      protocolVersion: number;
      roomId: string;
      requestId: string;
      expectedRevision: number;
      action: ClientAction;
    };

export type RejectionCode =
  | "invalid_message"
  | "protocol_mismatch"
  | "wrong_room"
  | "stale_revision"
  | "host_only"
  | "wrong_phase"
  | "not_your_turn"
  | "players_not_ready"
  | "fighter_missing"
  | "unknown_weapon"
  | "invalid_attack_sequence"
  | "insufficient_stamina"
  | "pending_resolution_required"
  | "no_pending_attack"
  | "wrong_resolution";

export type HostMessage =
  | {
      type: "welcome";
      protocolVersion: typeof MULTIPLAYER_PROTOCOL_VERSION;
      side: Side;
      snapshot: RoomSnapshot;
    }
  | {
      type: "snapshot";
      protocolVersion: typeof MULTIPLAYER_PROTOCOL_VERSION;
      snapshot: RoomSnapshot;
      ackRequestId?: string;
    }
  | {
      type: "rejected";
      protocolVersion: typeof MULTIPLAYER_PROTOCOL_VERSION;
      code: RejectionCode;
      message: string;
      requestId?: string;
      snapshot?: RoomSnapshot;
    };

export type DecodeResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "invalid_message" | "protocol_mismatch"; message: string };

export type ActionValidationResult =
  | { ok: true }
  | { ok: false; code: RejectionCode; message: string };

export type DerivedAttackDeclarationResult =
  | { ok: true; declaration: AttackDeclaration; attackTurn: AttackTurnState }
  | { ok: false; code: AttackTurnError | "fighter_missing" };

const ROOM_ID = /^[A-Za-z0-9_-]{4,128}$/;
const REQUEST_ID = /^[A-Za-z0-9_.:-]{4,128}$/;
const DEFENSE_MODES = new Set<DefenseMode>(["dodge", "reposition", "block", "none"]);
const STRIKE_MODES = new Set<StrikeMode>(["normal", "strong"]);
const LOCATIONS = new Set<LocationKey | "random">(["head", "torso", "arms", "legs", "random"]);
const PHASES = new Set<RoomPhase>(["setup", "combat", "complete"]);
const STAGES = new Set<RoomStage>(["setup", "action", "defense", "resolution", "complete"]);
const REJECTION_CODES = new Set<RejectionCode>([
  "invalid_message", "protocol_mismatch", "wrong_room", "stale_revision", "host_only", "wrong_phase", "not_your_turn",
  "players_not_ready", "fighter_missing", "unknown_weapon", "invalid_attack_sequence", "insufficient_stamina",
  "pending_resolution_required", "no_pending_attack", "wrong_resolution",
]);
const COMBAT_SETTINGS_KEYS = new Set(["explodingDice", "armorAblation", "criticals", "aimedLocations", "stopAtZero", "seed"]);
const ROOM_PLAYER_KEYS = new Set(["side", "connected", "ready"]);
const ROOM_SNAPSHOT_KEYS = new Set([
  "protocolVersion", "roomId", "revision", "phase", "stage", "players", "prepared", "fighters", "settings", "active",
  "firstSide", "initiative", "round", "turn", "attackTurn", "attackDeclaration", "pending", "log",
]);
const DECLARE_ATTACK_ACTION_KEYS = new Set(["type", "weaponUid", "strikeMode", "locationChoice", "modifier", "modifierNote"]);
const ATTACK_DECLARATION_KEYS = new Set([
  "attacker", "defender", "weaponUid", "strikeMode", "locationChoice", "modifier", "modifierNote",
  "extra", "automaticModifier", "staminaCost",
]);
const CLIENT_HELLO_KEYS = new Set(["type", "protocolVersion", "roomId", "requestId"]);
const CLIENT_ACTION_MESSAGE_KEYS = new Set(["type", "protocolVersion", "roomId", "requestId", "expectedRevision", "action"]);
const HOST_WELCOME_KEYS = new Set(["type", "protocolVersion", "side", "snapshot"]);
const HOST_SNAPSHOT_KEYS = new Set(["type", "protocolVersion", "snapshot", "ackRequestId"]);
const HOST_REJECTED_KEYS = new Set(["type", "protocolVersion", "code", "message", "requestId", "snapshot"]);
const FIGHTER_STAT_KEYS = ["INT", "REF", "DEX", "BODY", "SPD", "EMP", "CRA", "WILL", "LUCK"] as const;
const FIGHTER_KEYS = new Set([
  "id", "name", "race", "profession", "stats", "skills", "hp", "maxHp", "sta", "maxSta",
  "stun", "rec", "run", "leap", "initiativeBase", "meleeDamageBonus", "armor", "weapons", "warnings",
]);
const WEAPON_KEYS = new Set([
  "uid", "name", "category", "damage", "accuracy", "reliability", "range", "equipped", "effects", "attackSkill", "bodyDamage",
]);
const ARMOR_ZONE_KEYS = new Set(["sp", "originalSp", "source", "natural"]);
const DICE_ROLL_KEYS = new Set(["rolls", "total", "text"]);
const PENDING_ATTACK_KEYS = new Set([
  "attacker", "defender", "weapon", "defenseMode", "strikeMode", "location", "attackRoll", "defenseRoll",
  "attackBase", "defenseBase", "attackModifier", "aimedModifier", "attackTotal", "defenseTotal", "hit", "margin",
  "damageRoll", "rolledDamage", "armorSp", "appliedArmorSp", "multiplier", "normalDamage", "criticalBonus",
  "criticalLevel", "finalDamage", "formula",
]);
const ARMOR_LOCATIONS: LocationKey[] = ["head", "torso", "arms", "legs"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSide(value: unknown): value is Side {
  return value === 0 || value === 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function jsonFits(value: unknown, maxBytes: number) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes;
  } catch {
    return false;
  }
}

function isCombatSettings(value: unknown): value is CombatSettings {
  if (!isRecord(value) || !hasOnlyKeys(value, COMBAT_SETTINGS_KEYS) || Object.keys(value).length !== COMBAT_SETTINGS_KEYS.size) return false;
  return typeof value.explodingDice === "boolean"
    && typeof value.armorAblation === "boolean"
    && typeof value.criticals === "boolean"
    && typeof value.aimedLocations === "boolean"
    && typeof value.stopAtZero === "boolean"
    && Number.isSafeInteger(value.seed);
}

function isDeclareAttackAction(value: Record<string, unknown>): value is DeclareAttackAction {
  return hasOnlyKeys(value, DECLARE_ATTACK_ACTION_KEYS)
    && Object.keys(value).length === DECLARE_ATTACK_ACTION_KEYS.size
    && value.type === "declare_attack"
    && isBoundedString(value.weaponUid, 256)
    && value.weaponUid.length > 0
    && STRIKE_MODES.has(value.strikeMode as StrikeMode)
    && LOCATIONS.has(value.locationChoice as LocationKey | "random")
    && Number.isSafeInteger(value.modifier)
    && Math.abs(value.modifier as number) <= 1_000
    && isBoundedString(value.modifierNote, 500);
}

function isClientAction(value: unknown): value is ClientAction {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "submit_fighter": return hasOnlyKeys(value, new Set(["type", "fighter"])) && Object.keys(value).length === 2
      && isPreparedFighter(value.fighter) && jsonFits(value.fighter, MAX_FIGHTER_MESSAGE_BYTES);
    case "set_ready": return hasOnlyKeys(value, new Set(["type", "ready"])) && Object.keys(value).length === 2 && typeof value.ready === "boolean";
    case "set_settings": return hasOnlyKeys(value, new Set(["type", "settings"])) && Object.keys(value).length === 2 && isCombatSettings(value.settings);
    case "declare_attack": return isDeclareAttackAction(value);
    case "choose_defense": return hasOnlyKeys(value, new Set(["type", "defenseMode"])) && Object.keys(value).length === 2
      && DEFENSE_MODES.has(value.defenseMode as DefenseMode);
    case "start_battle":
    case "apply_pending":
    case "finish_miss":
    case "end_turn":
    case "recover":
    case "pass":
    case "continue_battle":
    case "reset_room":
      return Object.keys(value).length === 1;
    default:
      return false;
  }
}

function isRoomPlayer(value: unknown, expectedSide: Side): value is RoomPlayer {
  return isRecord(value)
    && hasOnlyKeys(value, ROOM_PLAYER_KEYS)
    && Object.keys(value).length === ROOM_PLAYER_KEYS.size
    && value.side === expectedSide
    && typeof value.connected === "boolean"
    && typeof value.ready === "boolean";
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isWeapon(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, WEAPON_KEYS)) return false;
  return isBoundedString(value.uid, 256) && value.uid.length > 0
    && isBoundedString(value.name, 500)
    && isBoundedString(value.category, 100)
    && isBoundedString(value.damage, 100)
    && isFiniteNumber(value.accuracy)
    && isFiniteNumber(value.reliability)
    && isBoundedString(value.range, 100)
    && typeof value.equipped === "boolean"
    && Array.isArray(value.effects)
    && value.effects.length <= 100
    && value.effects.every((effect) => isBoundedString(effect, 1_000))
    && isBoundedString(value.attackSkill, 100)
    && typeof value.bodyDamage === "boolean";
}

function isArmor(value: unknown) {
  if (!isRecord(value) || Object.keys(value).length !== ARMOR_LOCATIONS.length) return false;
  return ARMOR_LOCATIONS.every((location) => {
    const zone = value[location];
    return isRecord(zone)
      && hasOnlyKeys(zone, ARMOR_ZONE_KEYS)
      && isFiniteNumber(zone.sp)
      && isFiniteNumber(zone.originalSp)
      && isBoundedString(zone.source, 500)
      && isFiniteNumber(zone.natural);
  });
}

export function isPreparedFighter(value: unknown): value is PreparedFighter {
  if (!isRecord(value) || !hasOnlyKeys(value, FIGHTER_KEYS) || Object.keys(value).length !== FIGHTER_KEYS.size) return false;
  if (!isBoundedString(value.id, 256) || !isBoundedString(value.name, 500)
    || !isBoundedString(value.race, 100) || !isBoundedString(value.profession, 100)) return false;
  const stats = value.stats;
  if (!isRecord(stats) || Object.keys(stats).length !== FIGHTER_STAT_KEYS.length || !FIGHTER_STAT_KEYS.every((key) => isFiniteNumber(stats[key]))) return false;
  if (!isRecord(value.skills) || Object.keys(value.skills).length > 500 || !Object.entries(value.skills).every(([key, score]) => /^[A-Za-z0-9_-]{1,100}$/.test(key) && isFiniteNumber(score))) return false;
  if (![value.hp, value.maxHp, value.sta, value.maxSta, value.stun, value.rec, value.run, value.leap, value.initiativeBase, value.meleeDamageBonus].every(isFiniteNumber)) return false;
  if (!isArmor(value.armor) || !Array.isArray(value.weapons) || value.weapons.length > 100 || !value.weapons.every(isWeapon)) return false;
  return Array.isArray(value.warnings)
    && value.warnings.length <= 100
    && value.warnings.every((warning) => isBoundedString(warning, 2_000));
}

function isAttackDeclaration(value: unknown): value is AttackDeclaration {
  return isRecord(value)
    && hasOnlyKeys(value, ATTACK_DECLARATION_KEYS)
    && Object.keys(value).length === ATTACK_DECLARATION_KEYS.size
    && isSide(value.attacker)
    && isSide(value.defender)
    && value.attacker !== value.defender
    && isBoundedString(value.weaponUid, 256)
    && value.weaponUid.length > 0
    && STRIKE_MODES.has(value.strikeMode as StrikeMode)
    && LOCATIONS.has(value.locationChoice as LocationKey | "random")
    && Number.isSafeInteger(value.modifier)
    && Math.abs(value.modifier as number) <= 1_000
    && isBoundedString(value.modifierNote, 500)
    && typeof value.extra === "boolean"
    && value.automaticModifier === (value.extra ? EXTRA_ATTACK_HIT_MODIFIER : 0)
    && value.staminaCost === (value.extra ? EXTRA_ATTACK_STAMINA_COST : 0);
}

function isDiceRoll(value: unknown) {
  return isRecord(value)
    && hasOnlyKeys(value, DICE_ROLL_KEYS)
    && Object.keys(value).length === DICE_ROLL_KEYS.size
    && Array.isArray(value.rolls)
    && value.rolls.length <= 50
    && value.rolls.every((roll) => Number.isSafeInteger(roll) && roll >= 1 && roll <= 100)
    && isFiniteNumber(value.total)
    && isBoundedString(value.text, 2_000);
}

function isPendingAttack(value: unknown): value is PendingAttack {
  if (!isRecord(value) || !hasOnlyKeys(value, PENDING_ATTACK_KEYS) || Object.keys(value).length !== PENDING_ATTACK_KEYS.size) return false;
  const numericFields = [
    value.attackBase, value.defenseBase, value.attackModifier, value.aimedModifier, value.attackTotal, value.defenseTotal,
    value.margin, value.rolledDamage, value.armorSp, value.appliedArmorSp, value.multiplier, value.normalDamage,
    value.criticalBonus, value.finalDamage,
  ];
  return isSide(value.attacker)
    && isSide(value.defender)
    && value.attacker !== value.defender
    && isWeapon(value.weapon)
    && DEFENSE_MODES.has(value.defenseMode as DefenseMode)
    && STRIKE_MODES.has(value.strikeMode as StrikeMode)
    && LOCATIONS.has(value.location as LocationKey)
    && value.location !== "random"
    && isDiceRoll(value.attackRoll)
    && (value.defenseRoll === null || isDiceRoll(value.defenseRoll))
    && typeof value.hit === "boolean"
    && (value.damageRoll === null || isDiceRoll(value.damageRoll))
    && numericFields.every(isFiniteNumber)
    && (value.criticalLevel === null || isBoundedString(value.criticalLevel, 200))
    && isBoundedString(value.formula, 4_000);
}

function isLogEntry(value: unknown): value is LogEntry {
  return isRecord(value)
    && typeof value.id === "string"
    && isNonNegativeInteger(value.round)
    && isNonNegativeInteger(value.turn)
    && ["system", "roll", "damage", "condition"].includes(value.type as string)
    && isBoundedString(value.title, 1_000)
    && isBoundedString(value.detail, 4_000)
    && isBoundedString(value.createdAt, 100);
}

export function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ROOM_SNAPSHOT_KEYS)
    || Object.keys(value).length !== ROOM_SNAPSHOT_KEYS.size
    || !jsonFits(value, MAX_SNAPSHOT_MESSAGE_BYTES)) return false;
  if (value.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION || typeof value.roomId !== "string" || !ROOM_ID.test(value.roomId)) return false;
  if (!isNonNegativeInteger(value.revision) || !PHASES.has(value.phase as RoomPhase) || !STAGES.has(value.stage as RoomStage)) return false;
  if (!Array.isArray(value.players) || value.players.length !== 2 || !isRoomPlayer(value.players[0], 0) || !isRoomPlayer(value.players[1], 1)) return false;
  if (!Array.isArray(value.prepared) || value.prepared.length !== 2 || !value.prepared.every((item) => item === null || isPreparedFighter(item))) return false;
  if (value.fighters !== null && (!Array.isArray(value.fighters) || value.fighters.length !== 2 || !value.fighters.every(isPreparedFighter))) return false;
  if (!isCombatSettings(value.settings) || !isSide(value.active) || !isSide(value.firstSide)) return false;
  if (!Array.isArray(value.initiative) || value.initiative.length !== 2 || !value.initiative.every(isFiniteNumber)) return false;
  if (!isNonNegativeInteger(value.round) || value.round < 1 || !isNonNegativeInteger(value.turn)) return false;
  if (!isAttackTurnState(value.attackTurn)) return false;
  if (value.attackDeclaration !== null && !isAttackDeclaration(value.attackDeclaration)) return false;
  if (value.pending !== null && !isPendingAttack(value.pending)) return false;
  if (value.attackDeclaration !== null && value.pending !== null) return false;
  const expectedStage: RoomStage = value.phase === "setup"
    ? "setup"
    : value.phase === "complete"
      ? "complete"
      : value.pending
        ? "resolution"
        : value.attackDeclaration
          ? "defense"
          : "action";
  if (value.stage !== expectedStage) return false;
  const attackTurn = value.attackTurn as AttackTurnState;
  if (value.phase === "setup" && (value.fighters !== null || value.attackDeclaration !== null || value.pending !== null
    || attackTurn.standardMode !== null || attackTurn.standardStrikes !== 0 || attackTurn.extraUsed || attackTurn.ended)) return false;
  if (value.phase !== "setup" && value.fighters === null) return false;
  if (value.phase === "complete" && (value.attackDeclaration !== null || value.pending !== null)) return false;
  if (value.attackDeclaration) {
    const declaration = value.attackDeclaration as AttackDeclaration;
    const fighters = value.fighters as [PreparedFighter, PreparedFighter] | null;
    if (declaration.attacker !== value.active
      || declaration.defender === value.active
      || !fighters?.[declaration.attacker].weapons.some((weapon) => weapon.uid === declaration.weaponUid)
      || (declaration.extra
        ? !attackTurn.extraUsed || !attackTurn.ended || !standardAttackComplete(attackTurn)
        : attackTurn.extraUsed || attackTurn.ended || attackTurn.standardMode !== declaration.strikeMode)) return false;
  }
  if (value.pending && (value.pending.attacker !== value.active
    || attackTurn.standardMode === null
    || (!attackTurn.extraUsed && (attackTurn.ended || attackTurn.standardMode !== value.pending.strikeMode)))) return false;
  return Array.isArray(value.log) && value.log.length <= 10_000 && value.log.every(isLogEntry);
}

export function decodeClientMessage(value: unknown): DecodeResult<ClientMessage> {
  if (!isRecord(value)) return { ok: false, code: "invalid_message", message: "Client message must be an object." };
  if (value.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION) {
    return { ok: false, code: "protocol_mismatch", message: `Protocol ${String(value.protocolVersion)} is not supported.` };
  }
  if (typeof value.roomId !== "string" || !ROOM_ID.test(value.roomId) || typeof value.requestId !== "string" || !REQUEST_ID.test(value.requestId)) {
    return { ok: false, code: "invalid_message", message: "Room or request identifier is invalid." };
  }
  if (value.type === "hello" || value.type === "request_snapshot") {
    return hasOnlyKeys(value, CLIENT_HELLO_KEYS) && Object.keys(value).length === CLIENT_HELLO_KEYS.size
      ? { ok: true, value: value as ClientMessage }
      : { ok: false, code: "invalid_message", message: "Client message contains unexpected fields." };
  }
  if (value.type !== "action"
    || !hasOnlyKeys(value, CLIENT_ACTION_MESSAGE_KEYS)
    || Object.keys(value).length !== CLIENT_ACTION_MESSAGE_KEYS.size
    || !isNonNegativeInteger(value.expectedRevision)
    || !isClientAction(value.action)) {
    return { ok: false, code: "invalid_message", message: "Client action is invalid." };
  }
  if (!jsonFits(value, MAX_FIGHTER_MESSAGE_BYTES + 16_384)) {
    return { ok: false, code: "invalid_message", message: "Client message is too large." };
  }
  return { ok: true, value: value as ClientMessage };
}

export function decodeHostMessage(value: unknown): DecodeResult<HostMessage> {
  if (!isRecord(value)) return { ok: false, code: "invalid_message", message: "Host message must be an object." };
  if (value.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION) {
    return { ok: false, code: "protocol_mismatch", message: `Protocol ${String(value.protocolVersion)} is not supported.` };
  }
  if (value.type === "welcome"
    && hasOnlyKeys(value, HOST_WELCOME_KEYS)
    && Object.keys(value).length === HOST_WELCOME_KEYS.size
    && isSide(value.side)
    && isRoomSnapshot(value.snapshot)) return { ok: true, value: value as HostMessage };
  if (value.type === "snapshot"
    && hasOnlyKeys(value, HOST_SNAPSHOT_KEYS)
    && (Object.keys(value).length === 3 || Object.keys(value).length === 4)
    && isRoomSnapshot(value.snapshot)
    && (value.ackRequestId === undefined || (typeof value.ackRequestId === "string" && REQUEST_ID.test(value.ackRequestId)))) {
    return { ok: true, value: value as HostMessage };
  }
  if (value.type === "rejected"
    && hasOnlyKeys(value, HOST_REJECTED_KEYS)
    && Object.keys(value).length >= 4
    && REJECTION_CODES.has(value.code as RejectionCode)
    && isBoundedString(value.message, 2_000)
    && (value.requestId === undefined || (typeof value.requestId === "string" && REQUEST_ID.test(value.requestId)))
    && (value.snapshot === undefined || isRoomSnapshot(value.snapshot))) {
    return { ok: true, value: value as HostMessage };
  }
  return { ok: false, code: "invalid_message", message: "Host message is invalid." };
}

function rejected(code: RejectionCode, message: string): ActionValidationResult {
  return { ok: false, code, message };
}

/**
 * Derive the server-owned declaration fields and post-declaration turn state.
 * Both host execution and validation should use this function so a client can
 * never choose whether an attack is extra or bypass its cost and modifier.
 */
export function deriveAttackDeclaration(
  snapshot: Pick<RoomSnapshot, "active" | "fighters" | "attackTurn">,
  action: DeclareAttackAction,
): DerivedAttackDeclarationResult {
  const fighter = snapshot.fighters?.[snapshot.active];
  if (!fighter) return { ok: false, code: "fighter_missing" };
  const extra = standardAttackComplete(snapshot.attackTurn);
  const economy = declareTurnAttack(snapshot.attackTurn, { strikeMode: action.strikeMode, extra }, fighter.sta);
  if (!economy.ok) return economy;
  return {
    ok: true,
    attackTurn: economy.state,
    declaration: {
      attacker: snapshot.active,
      defender: snapshot.active === 0 ? 1 : 0,
      weaponUid: action.weaponUid,
      strikeMode: action.strikeMode,
      locationChoice: action.locationChoice,
      modifier: action.modifier,
      modifierNote: action.modifierNote,
      extra,
      automaticModifier: economy.hitModifier,
      staminaCost: economy.staminaCost,
    },
  };
}

function rejectedAttackEconomy(code: AttackTurnError | "fighter_missing"): ActionValidationResult {
  if (code === "fighter_missing") return rejected("fighter_missing", "The active fighter is unavailable.");
  if (code === "insufficient_stamina") return rejected("insufficient_stamina", "The fighter needs 3 STA for an extra attack.");
  return rejected("invalid_attack_sequence", "That attack is not available in the current attack action.");
}

/** Validate authority and ordering after decodeClientMessage has accepted a message. */
export function validateClientMessage(message: ClientMessage, actor: Side, snapshot: RoomSnapshot): ActionValidationResult {
  if (message.roomId !== snapshot.roomId) return rejected("wrong_room", "Message belongs to another room.");
  if (message.type !== "action") return { ok: true };
  if (message.expectedRevision !== snapshot.revision) return rejected("stale_revision", "Room state changed; request a fresh snapshot.");

  const action = message.action;
  const hostOnly = action.type === "set_settings" || action.type === "start_battle" || action.type === "continue_battle" || action.type === "reset_room";
  if (hostOnly && actor !== 0) return rejected("host_only", "Only the room host can perform this action.");

  if (action.type === "submit_fighter" || action.type === "set_ready" || action.type === "set_settings" || action.type === "start_battle") {
    if (snapshot.phase !== "setup") return rejected("wrong_phase", "Lobby action is only allowed before combat.");
    if (action.type === "set_ready" && action.ready && !snapshot.prepared[actor]) return rejected("fighter_missing", "Upload a character before becoming ready.");
    if (action.type === "start_battle") {
      const ready = snapshot.players.every((player, side) => player.ready && snapshot.prepared[side as Side] !== null);
      if (!ready || !snapshot.players[1].connected) return rejected("players_not_ready", "Both connected players must upload a character and become ready.");
    }
    return { ok: true };
  }

  if (action.type === "reset_room") return { ok: true };
  if (action.type === "continue_battle") {
    return snapshot.phase === "complete" ? { ok: true } : rejected("wrong_phase", "The battle is not complete.");
  }
  if (snapshot.phase !== "combat") return rejected("wrong_phase", "Combat action is only allowed during combat.");
  if (!snapshot.fighters) return rejected("fighter_missing", "Combatants are not initialized.");

  if (action.type === "choose_defense") {
    if (snapshot.pending || !snapshot.attackDeclaration) return rejected("no_pending_attack", "There is no declared attack awaiting a defense.");
    if (snapshot.attackDeclaration.defender !== actor || snapshot.active === actor) return rejected("not_your_turn", "Only the defending player can choose this defense.");
    return { ok: true };
  }

  if (snapshot.active !== actor) return rejected("not_your_turn", "The other fighter is active.");

  if (action.type === "declare_attack") {
    if (snapshot.pending || snapshot.attackDeclaration) return rejected("pending_resolution_required", "Resolve the current attack first.");
    const weapon = snapshot.fighters[actor].weapons.find((item) => item.uid === action.weaponUid);
    if (!weapon) return rejected("unknown_weapon", "The selected weapon does not belong to the active fighter.");
    if (!weapon.damage.trim()) return rejected("invalid_attack_sequence", "The selected weapon has no damage formula.");
    const derived = deriveAttackDeclaration(snapshot, action);
    return derived.ok ? { ok: true } : rejectedAttackEconomy(derived.code);
  }
  if (action.type === "end_turn") {
    if (snapshot.pending || snapshot.attackDeclaration) return rejected("pending_resolution_required", "Resolve the current attack first.");
    return snapshot.attackTurn.standardMode === null
      ? rejected("invalid_attack_sequence", "End an attack turn only after beginning an attack action.")
      : { ok: true };
  }
  if (action.type === "recover" || action.type === "pass") {
    if (snapshot.pending || snapshot.attackDeclaration) return rejected("pending_resolution_required", "Resolve the current attack first.");
    return snapshot.attackTurn.standardMode === null
      ? { ok: true }
      : rejected("invalid_attack_sequence", "Recovery and passing are unavailable after an attack action has begun.");
  }
  if (snapshot.attackDeclaration || !snapshot.pending || snapshot.pending.attacker !== actor) return rejected("no_pending_attack", "There is no resolved attack for this fighter to confirm.");
  if (action.type === "apply_pending" && !snapshot.pending.hit) return rejected("wrong_resolution", "A missed attack cannot apply damage.");
  if (action.type === "finish_miss" && snapshot.pending.hit) return rejected("wrong_resolution", "A successful attack must apply its result.");
  return { ok: true };
}

export function makeRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeActionMessage(roomId: string, expectedRevision: number, action: ClientAction, requestId = makeRequestId()): ClientMessage {
  return { type: "action", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, roomId, requestId, expectedRevision, action };
}
