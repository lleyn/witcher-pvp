import assert from "node:assert/strict";
import test from "node:test";
import { resolveAttack, createRng } from "../app/lib/combat.ts";
import {
  MULTIPLAYER_PROTOCOL_VERSION,
  decodeClientMessage,
  decodeHostMessage,
  isRoomSnapshot,
  makeActionMessage,
  validateClientMessage,
} from "../app/lib/multiplayer.ts";
import { buildFighter, demoCharacter, parseWitcherFile, prepareFighter } from "../app/lib/witcher.ts";

const settings = {
  explodingDice: true,
  armorAblation: true,
  criticals: true,
  aimedLocations: true,
  stopAtZero: true,
  seed: 123,
};

function prepared(side) {
  const imported = parseWitcherFile(demoCharacter(side))[0];
  return prepareFighter(buildFighter(imported.character, imported.warnings));
}

function snapshot(overrides = {}) {
  const combatants = [prepared("a"), prepared("b")];
  return {
    protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
    roomId: "duel-room_1234",
    revision: 7,
    phase: "combat",
    stage: "action",
    players: [
      { side: 0, connected: true, ready: true },
      { side: 1, connected: true, ready: true },
    ],
    prepared: combatants,
    fighters: structuredClone(combatants),
    settings,
    active: 1,
    firstSide: 1,
    initiative: [17, 17],
    round: 1,
    turn: 1,
    attackDeclaration: null,
    pending: null,
    log: [],
    ...overrides,
  };
}

function declareMessage(state, overrides = {}) {
  return makeActionMessage(state.roomId, state.revision, {
    type: "declare_attack",
    weaponUid: state.fighters[state.active].weapons[0].uid,
    strikeMode: "normal",
    locationChoice: "random",
    modifier: 0,
    modifierNote: "",
    ...overrides,
  }, "request_attack_1");
}

function declaration(state, overrides = {}) {
  return {
    attacker: state.active,
    defender: state.active === 0 ? 1 : 0,
    weaponUid: state.fighters[state.active].weapons[0].uid,
    strikeMode: "normal",
    locationChoice: "random",
    modifier: 0,
    modifierNote: "",
    ...overrides,
  };
}

test("snapshots cross JSON transport without sending the original character sheet", () => {
  const original = snapshot();
  const transported = JSON.parse(JSON.stringify(original));
  assert.equal(isRoomSnapshot(transported), true);
  assert.equal(transported.firstSide, 1);
  assert.equal(Object.hasOwn(transported.prepared[0], "raw"), false);
  assert.equal(Object.hasOwn(transported.fighters[1], "raw"), false);

  const decoded = decodeHostMessage({
    type: "welcome",
    protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
    side: 1,
    snapshot: transported,
  });
  assert.equal(decoded.ok, true);
});

test("snapshot validation rejects a fighter that leaks its raw sheet", () => {
  const state = snapshot();
  const leaked = {
    ...state,
    prepared: [{ ...state.prepared[0], raw: demoCharacter("a") }, state.prepared[1]],
  };
  assert.equal(isRoomSnapshot(leaked), false);
});

test("snapshot stage must match declaration and pending state", () => {
  const base = snapshot();
  assert.equal(isRoomSnapshot({ ...base, stage: "defense" }), false);
  assert.equal(isRoomSnapshot({ ...base, stage: "defense", attackDeclaration: declaration(base) }), true);
  assert.equal(isRoomSnapshot({ ...base, fighters: null }), false);
});

test("decoder rejects incompatible versions and malformed declarations", () => {
  const state = snapshot();
  const wrongVersion = { ...declareMessage(state), protocolVersion: 99 };
  assert.deepEqual(decodeClientMessage(wrongVersion), {
    ok: false,
    code: "protocol_mismatch",
    message: "Protocol 99 is not supported.",
  });

  const malformed = declareMessage(state, { modifier: Number.NaN });
  const decoded = decodeClientMessage(malformed);
  assert.equal(decoded.ok, false);
  assert.equal(decoded.code, "invalid_message");
});

test("fighter submission accepts prepared data and rejects raw sheets", () => {
  const state = snapshot({ phase: "setup", stage: "setup", fighters: null, attackDeclaration: null });
  const valid = makeActionMessage(state.roomId, state.revision, {
    type: "submit_fighter",
    fighter: state.prepared[1],
  }, "request_fighter_1");
  assert.equal(decodeClientMessage(valid).ok, true);

  const leaked = structuredClone(valid);
  leaked.action.fighter.raw = demoCharacter("b");
  assert.equal(decodeClientMessage(leaked).ok, false);
});

test("host accepts only the current revision and the active player's declaration", () => {
  const state = snapshot();
  const valid = declareMessage(state);
  assert.deepEqual(validateClientMessage(valid, 1, state), { ok: true });

  const stale = { ...valid, expectedRevision: state.revision - 1 };
  assert.equal(validateClientMessage(stale, 1, state).code, "stale_revision");
  assert.equal(validateClientMessage(valid, 0, state).code, "not_your_turn");
  assert.equal(validateClientMessage({ ...valid, roomId: "other-room_99" }, 1, state).code, "wrong_room");
});

test("a player cannot declare an attack with the opponent's weapon", () => {
  const state = snapshot();
  const forged = declareMessage(state, { weaponUid: state.fighters[0].weapons[0].uid });
  assert.equal(validateClientMessage(forged, 1, state).code, "unknown_weapon");
});

test("only the defending player chooses defense after an attack declaration", () => {
  const base = snapshot();
  const state = { ...base, stage: "defense", attackDeclaration: declaration(base) };
  const defense = makeActionMessage(state.roomId, state.revision, {
    type: "choose_defense",
    defenseMode: "block",
  }, "request_defense_1");

  assert.deepEqual(validateClientMessage(defense, 0, state), { ok: true });
  assert.equal(validateClientMessage(defense, 1, state).code, "not_your_turn");
  assert.equal(validateClientMessage(defense, 0, { ...state, stage: "action", attackDeclaration: null }).code, "no_pending_attack");
  assert.equal(validateClientMessage(declareMessage(state), 1, state).code, "pending_resolution_required");
});

test("guest cannot start the battle or change authoritative settings", () => {
  const state = snapshot({ phase: "setup", stage: "setup", fighters: null, active: 0 });
  const start = makeActionMessage(state.roomId, state.revision, { type: "start_battle" }, "request_start_1");
  const change = makeActionMessage(state.roomId, state.revision, { type: "set_settings", settings }, "request_settings_1");
  assert.equal(validateClientMessage(start, 1, state).code, "host_only");
  assert.equal(validateClientMessage(change, 1, state).code, "host_only");
  assert.deepEqual(validateClientMessage(start, 0, state), { ok: true });
});

test("battle cannot start until both prepared slots are ready and connected", () => {
  const base = snapshot({ phase: "setup", stage: "setup", fighters: null, active: 0 });
  const start = makeActionMessage(base.roomId, base.revision, { type: "start_battle" }, "request_start_2");
  const disconnected = {
    ...base,
    players: [base.players[0], { ...base.players[1], connected: false }],
  };
  assert.equal(validateClientMessage(start, 0, disconnected).code, "players_not_ready");

  const missingFighter = { ...base, prepared: [base.prepared[0], null] };
  assert.equal(validateClientMessage(start, 0, missingFighter).code, "players_not_ready");
});

test("pending rolls can only be confirmed by the active attacker in the matching way", () => {
  const base = snapshot();
  const weapon = base.fighters[1].weapons[0];
  const pending = resolveAttack({
    fighters: base.fighters,
    attacker: 1,
    weapon,
    defenseMode: "none",
    strikeMode: "normal",
    locationChoice: "torso",
    modifier: 100,
    settings,
    rng: createRng(settings.seed),
  });
  assert.equal(pending.hit, true);
  const state = { ...base, stage: "resolution", pending };
  const apply = makeActionMessage(state.roomId, state.revision, { type: "apply_pending" }, "request_apply_1");
  const finishMiss = makeActionMessage(state.roomId, state.revision, { type: "finish_miss" }, "request_miss_1");
  const anotherAttack = declareMessage(state);

  assert.deepEqual(validateClientMessage(apply, 1, state), { ok: true });
  assert.equal(validateClientMessage(finishMiss, 1, state).code, "wrong_resolution");
  assert.equal(validateClientMessage(apply, 0, state).code, "not_your_turn");
  assert.equal(validateClientMessage(anotherAttack, 1, state).code, "pending_resolution_required");
});

test("guest rejects incomplete resolved attacks instead of rendering unsafe data", () => {
  const base = snapshot();
  const pending = resolveAttack({
    fighters: base.fighters,
    attacker: 1,
    weapon: base.fighters[1].weapons[0],
    defenseMode: "dodge",
    strikeMode: "normal",
    locationChoice: "torso",
    modifier: 0,
    settings,
    rng: createRng(settings.seed),
  });
  const invalidPending = structuredClone(pending);
  delete invalidPending.attackRoll;
  const unsafe = { ...base, stage: "resolution", pending: invalidPending };
  assert.equal(isRoomSnapshot(unsafe), false);
  assert.equal(decodeHostMessage({ type: "snapshot", protocolVersion: 1, snapshot: unsafe }).ok, false);
});

test("recover and pass are blocked while either player must respond", () => {
  const base = snapshot();
  const recover = makeActionMessage(base.roomId, base.revision, { type: "recover" }, "request_recover_1");
  const declared = { ...base, stage: "defense", attackDeclaration: declaration(base) };
  assert.equal(validateClientMessage(recover, 1, declared).code, "pending_resolution_required");
  assert.equal(validateClientMessage(recover, 0, base).code, "not_your_turn");
});

test("ready requires the sender's own prepared fighter slot", () => {
  const base = snapshot({ phase: "setup", stage: "setup", fighters: null, prepared: [prepared("a"), null] });
  const ready = makeActionMessage(base.roomId, base.revision, { type: "set_ready", ready: true }, "request_ready_1");
  assert.equal(validateClientMessage(ready, 1, base).code, "fighter_missing");
  assert.deepEqual(validateClientMessage(ready, 0, base), { ok: true });
});
