import type { StrikeMode } from "./combat";

/** Cost and accuracy penalty of the single optional attack bought after an attack action. */
export const EXTRA_ATTACK_STAMINA_COST = 3;
export const EXTRA_ATTACK_HIT_MODIFIER = -3;

/**
 * `normal` is the existing combat-engine name for a fast strike. Keeping the
 * same value here lets the turn model stay independent from UI and transport.
 */
export type AttackTurnState = {
  standardMode: StrikeMode | null;
  standardStrikes: 0 | 1 | 2;
  extraUsed: boolean;
  ended: boolean;
};

export type TurnAttackRequest = {
  strikeMode: StrikeMode;
  extra: boolean;
};

export type AttackTurnError =
  | "invalid_state"
  | "turn_ended"
  | "standard_action_complete"
  | "must_finish_fast_action"
  | "extra_before_standard_complete"
  | "extra_already_used"
  | "insufficient_stamina";

export type AttackTurnResult =
  | {
      ok: true;
      state: AttackTurnState;
      staminaCost: 0 | typeof EXTRA_ATTACK_STAMINA_COST;
      hitModifier: 0 | typeof EXTRA_ATTACK_HIT_MODIFIER;
      endsTurn: boolean;
    }
  | { ok: false; code: AttackTurnError };

export type AttackTurnOptions = {
  canFast: boolean;
  canStrong: boolean;
  canExtraFast: boolean;
  canExtraStrong: boolean;
  canEndTurn: boolean;
  standardComplete: boolean;
  remainingFastStrikes: 0 | 1 | 2;
};

export function createAttackTurnState(): AttackTurnState {
  return { standardMode: null, standardStrikes: 0, extraUsed: false, ended: false };
}

export function isAttackTurnState(value: unknown): value is AttackTurnState {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (Object.keys(state).length !== 4
    || ![null, "normal", "strong"].includes(state.standardMode as StrikeMode | null)
    || ![0, 1, 2].includes(state.standardStrikes as number)
    || typeof state.extraUsed !== "boolean"
    || typeof state.ended !== "boolean") return false;

  if (state.standardMode === null && state.standardStrikes !== 0) return false;
  if (state.standardMode === "normal" && state.standardStrikes !== 1 && state.standardStrikes !== 2) return false;
  if (state.standardMode === "strong" && state.standardStrikes !== 1) return false;
  if (state.extraUsed && (!standardAttackComplete(state as AttackTurnState) || !state.ended)) return false;
  return true;
}

export function standardAttackComplete(state: AttackTurnState): boolean {
  return (state.standardMode === "normal" && state.standardStrikes === 2)
    || (state.standardMode === "strong" && state.standardStrikes === 1);
}

export function attackTurnOptions(state: AttackTurnState, stamina: number): AttackTurnOptions {
  const valid = isAttackTurnState(state);
  const complete = valid && standardAttackComplete(state);
  const available = valid && !state.ended;
  const canBuyExtra = available && complete && !state.extraUsed && stamina >= EXTRA_ATTACK_STAMINA_COST;
  const remainingFastStrikes: 0 | 1 | 2 = !valid || state.standardMode === "strong"
    ? 0
    : state.standardMode === null
      ? 2
      : state.standardStrikes === 1 ? 1 : 0;

  return {
    canFast: available && (state.standardMode === null || (state.standardMode === "normal" && state.standardStrikes === 1)),
    canStrong: available && state.standardMode === null,
    canExtraFast: canBuyExtra,
    canExtraStrong: canBuyExtra,
    canEndTurn: available && state.standardMode !== null,
    standardComplete: complete,
    remainingFastStrikes,
  };
}

/**
 * Register an attack declaration without rolling dice or mutating a fighter.
 * The caller applies the returned cost and accuracy modifier exactly once.
 * A purchased extra attack is the final attack of the turn.
 */
export function declareTurnAttack(
  state: AttackTurnState,
  request: TurnAttackRequest,
  stamina: number,
): AttackTurnResult {
  if (!isAttackTurnState(state)) return { ok: false, code: "invalid_state" };
  if (state.ended) return { ok: false, code: "turn_ended" };

  if (request.extra) {
    if (state.extraUsed) return { ok: false, code: "extra_already_used" };
    if (!standardAttackComplete(state)) return { ok: false, code: "extra_before_standard_complete" };
    if (stamina < EXTRA_ATTACK_STAMINA_COST) return { ok: false, code: "insufficient_stamina" };
    return {
      ok: true,
      state: { ...state, extraUsed: true, ended: true },
      staminaCost: EXTRA_ATTACK_STAMINA_COST,
      hitModifier: EXTRA_ATTACK_HIT_MODIFIER,
      endsTurn: true,
    };
  }

  if (standardAttackComplete(state)) return { ok: false, code: "standard_action_complete" };
  if (state.standardMode === "normal" && request.strikeMode === "strong") {
    return { ok: false, code: "must_finish_fast_action" };
  }

  const nextState: AttackTurnState = request.strikeMode === "strong"
    ? { ...state, standardMode: "strong", standardStrikes: 1 }
    : {
        ...state,
        standardMode: "normal",
        standardStrikes: state.standardMode === "normal" ? 2 : 1,
      };
  return { ok: true, state: nextState, staminaCost: 0, hitModifier: 0, endsTurn: false };
}

export function endAttackTurn(state: AttackTurnState): AttackTurnState {
  return isAttackTurnState(state) ? { ...state, ended: true } : state;
}
