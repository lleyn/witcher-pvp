import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTRA_ATTACK_HIT_MODIFIER,
  EXTRA_ATTACK_STAMINA_COST,
  attackTurnOptions,
  createAttackTurnState,
  declareTurnAttack,
  endAttackTurn,
  isAttackTurnState,
  standardAttackComplete,
} from "../app/lib/turn-economy.ts";

test("an attack action is either two fast strikes or one strong strike", () => {
  const initial = createAttackTurnState();
  assert.deepEqual(attackTurnOptions(initial, 10), {
    canFast: true,
    canStrong: true,
    canExtraFast: false,
    canExtraStrong: false,
    canEndTurn: false,
    standardComplete: false,
    remainingFastStrikes: 2,
  });

  const firstFast = declareTurnAttack(initial, { strikeMode: "normal", extra: false }, 10);
  assert.equal(firstFast.ok, true);
  assert.equal(firstFast.endsTurn, false);
  assert.deepEqual(attackTurnOptions(firstFast.state, 10), {
    canFast: true,
    canStrong: false,
    canExtraFast: false,
    canExtraStrong: false,
    canEndTurn: true,
    standardComplete: false,
    remainingFastStrikes: 1,
  });

  const secondFast = declareTurnAttack(firstFast.state, { strikeMode: "normal", extra: false }, 10);
  assert.equal(secondFast.ok, true);
  assert.equal(standardAttackComplete(secondFast.state), true);
  assert.equal(attackTurnOptions(secondFast.state, 10).canFast, false);
  assert.equal(attackTurnOptions(secondFast.state, 10).canExtraStrong, true);

  const strong = declareTurnAttack(initial, { strikeMode: "strong", extra: false }, 10);
  assert.equal(strong.ok, true);
  assert.equal(standardAttackComplete(strong.state), true);
  assert.equal(strong.state.standardStrikes, 1);
});

test("a fast sequence cannot change its second standard strike to strong", () => {
  const first = declareTurnAttack(createAttackTurnState(), { strikeMode: "normal", extra: false }, 10);
  assert.equal(first.ok, true);
  assert.deepEqual(
    declareTurnAttack(first.state, { strikeMode: "strong", extra: false }, 10),
    { ok: false, code: "must_finish_fast_action" },
  );
});

test("one extra fast or strong attack costs 3 STA, gets -3, and ends the turn", () => {
  for (const strikeMode of ["normal", "strong"]) {
    const base = declareTurnAttack(createAttackTurnState(), { strikeMode: "strong", extra: false }, 10);
    assert.equal(base.ok, true);
    const extra = declareTurnAttack(base.state, { strikeMode, extra: true }, 3);
    assert.equal(extra.ok, true);
    assert.equal(extra.staminaCost, EXTRA_ATTACK_STAMINA_COST);
    assert.equal(extra.hitModifier, EXTRA_ATTACK_HIT_MODIFIER);
    assert.equal(extra.endsTurn, true);
    assert.equal(extra.state.extraUsed, true);
    assert.deepEqual(
      declareTurnAttack(extra.state, { strikeMode: "normal", extra: true }, 10),
      { ok: false, code: "turn_ended" },
    );
  }
});

test("extra attacks require a completed standard action and enough stamina", () => {
  const initial = createAttackTurnState();
  assert.deepEqual(
    declareTurnAttack(initial, { strikeMode: "normal", extra: true }, 10),
    { ok: false, code: "extra_before_standard_complete" },
  );
  const base = declareTurnAttack(initial, { strikeMode: "strong", extra: false }, 10);
  assert.equal(base.ok, true);
  assert.deepEqual(
    declareTurnAttack(base.state, { strikeMode: "normal", extra: true }, 2),
    { ok: false, code: "insufficient_stamina" },
  );
  assert.equal(attackTurnOptions(base.state, 2).canExtraFast, false);
});

test("a completed standard action cannot contain a third standard strike", () => {
  const first = declareTurnAttack(createAttackTurnState(), { strikeMode: "normal", extra: false }, 10);
  assert.equal(first.ok, true);
  const second = declareTurnAttack(first.state, { strikeMode: "normal", extra: false }, 10);
  assert.equal(second.ok, true);
  assert.deepEqual(
    declareTurnAttack(second.state, { strikeMode: "normal", extra: false }, 10),
    { ok: false, code: "standard_action_complete" },
  );
});

test("ending early is explicit and all transitions are immutable", () => {
  const initial = createAttackTurnState();
  const first = declareTurnAttack(initial, { strikeMode: "normal", extra: false }, 10);
  assert.equal(first.ok, true);
  assert.deepEqual(initial, createAttackTurnState());
  const ended = endAttackTurn(first.state);
  assert.notEqual(ended, first.state);
  assert.equal(ended.ended, true);
  assert.deepEqual(
    declareTurnAttack(ended, { strikeMode: "normal", extra: false }, 10),
    { ok: false, code: "turn_ended" },
  );
});

test("transported turn state is validated with its invariants", () => {
  assert.equal(isAttackTurnState(JSON.parse(JSON.stringify(createAttackTurnState()))), true);
  assert.equal(isAttackTurnState({ standardMode: "normal", standardStrikes: 0, extraUsed: false, ended: false }), false);
  assert.equal(isAttackTurnState({ standardMode: "strong", standardStrikes: 2, extraUsed: false, ended: false }), false);
  assert.equal(isAttackTurnState({ standardMode: "strong", standardStrikes: 1, extraUsed: true, ended: false }), false);
});
