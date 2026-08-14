import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  actorPositionContext,
  distanceBetween,
  distanceZone,
  type BattlefieldActionType,
  type BattlefieldSide,
  type ContestedPhysicalAction,
  type Stance,
} from "../lib/battlefield";
import type { EncounterState } from "../lib/encounter";
import type { CombatantEffects, CriticalWound } from "../lib/effects";
import {
  BUILTIN_MAGIC_ABILITIES,
  canFighterUseMagicAbility,
  type MagicAbility,
  type MagicSide,
  type MagicState,
} from "../lib/magic";
import { MONSTER_ARCHETYPES, MONSTER_THREAT_LABELS } from "../lib/monsters";
import type { PreparedFighter } from "../lib/witcher";

const SIDE_COLORS = ["#c58b52", "#8fa779"] as const;
const STANCE_LABELS: Record<Stance, string> = {
  standing: "Стоит",
  kneeling: "На колене",
  prone: "Лежит",
};
const DISTANCE_LABELS = {
  engaged: "Вплотную",
  close: "Близко",
  near: "Средняя",
  far: "Далеко",
  extreme: "Предельная",
} as const;
const COVER_LABELS = { none: "без укрытия", partial: "частичное укрытие", full: "полное укрытие" } as const;
const MAGIC_CATEGORY_LABELS: Record<MagicAbility["category"], string> = {
  signs: "Знак",
  spells: "Заклинание",
  invocations: "Инвокация",
  rituals: "Ритуал",
};
const MAGIC_CONDITION_LABELS: Record<string, string> = {
  burning: "Горение",
  stunned: "Оглушение",
  slowed: "Замедление",
  silenced: "Безмолвие",
  weakened: "Ослабление",
  marked: "Метка",
};
const SEVERITY_LABELS: Record<CriticalWound["severity"], string> = {
  simple: "простая",
  complex: "сложная",
  severe: "тяжёлая",
  deadly: "смертельная",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--line, #403b33)",
  background: "rgba(17, 20, 18, .94)",
  padding: 16,
};
const mutedStyle: CSSProperties = { color: "var(--muted, #9e988d)", fontSize: 11, lineHeight: 1.45 };
const buttonStyle: CSSProperties = {
  minHeight: 38,
  border: "1px solid var(--line, #403b33)",
  background: "var(--surface-raised, #262720)",
  color: "inherit",
  borderRadius: 4,
  padding: "7px 11px",
  cursor: "pointer",
};
const selectedButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "var(--copper, #b17843)",
  color: "var(--copper-bright, #dfa666)",
  background: "rgba(177, 120, 67, .12)",
};
const inputStyle: CSSProperties = {
  minHeight: 40,
  width: "100%",
  border: "1px solid var(--line, #403b33)",
  background: "#0d0f0e",
  color: "inherit",
  borderRadius: 3,
  padding: "0 10px",
};

function clampPercent(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function sideLabel(side: BattlefieldSide, fighters: [PreparedFighter, PreparedFighter]) {
  return fighters[side]?.name || `Боец ${side + 1}`;
}

export function BattlefieldView({
  encounter,
  fighters,
}: {
  encounter: EncounterState;
  fighters: [PreparedFighter, PreparedFighter];
}) {
  const field = encounter.battlefield;
  const length = Math.max(1, field.layout.maxMeters - field.layout.minMeters);
  const distance = distanceBetween(field);
  const active = field.turn.active;

  return (
    <section className="battlefield-view" style={{ ...panelStyle, display: "grid", gap: 13 }} aria-label="Условное поле боя">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div>
          <small style={mutedStyle}>ПОЛЕ · {encounter.presetId}</small>
          <h3 style={{ margin: "4px 0 0", font: "700 20px var(--serif, serif)" }}>Позиции и дистанция</h3>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>{distance.toFixed(1)} м</strong>
          <div style={mutedStyle}>{DISTANCE_LABELS[distanceZone(distance)]}</div>
        </div>
      </header>

      <div style={{ position: "relative", minHeight: 104, border: "1px solid var(--line-soft, #302e29)", background: "#0b0d0c", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "0 0 30px", display: "flex" }}>
          {field.layout.zones.map((zone) => {
            const width = ((zone.toMeters - zone.fromMeters) / length) * 100;
            return (
              <div
                key={zone.id}
                title={`${zone.label}: ${COVER_LABELS[zone.cover]}${zone.hazard ? `, ${zone.hazard.label}` : ""}`}
                style={{
                  width: `${width}%`,
                  borderRight: "1px solid rgba(177, 120, 67, .18)",
                  background: zone.hazard ? "rgba(142, 48, 42, .12)" : zone.cover === "none" ? "rgba(255,255,255,.015)" : "rgba(113,134,93,.09)",
                  display: "grid",
                  alignContent: "end",
                  padding: "5px 7px",
                  color: "var(--faint, #756f65)",
                  fontSize: 9,
                  overflow: "hidden",
                }}
              >
                <span style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{zone.label}</span>
              </div>
            );
          })}
        </div>
        {[0, 1].map((sideValue) => {
          const side = sideValue as BattlefieldSide;
          const actor = field.actors[side];
          const left = ((actor.positionMeters - field.layout.minMeters) / length) * 100;
          return (
            <div
              key={side}
              title={`${sideLabel(side, fighters)} · ${actor.positionMeters.toFixed(1)} м · ${STANCE_LABELS[actor.stance]}`}
              style={{
                position: "absolute",
                left: clampPercent(left),
                top: side === 0 ? 16 : 47,
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                maxWidth: "44%",
                color: SIDE_COLORS[side],
                fontSize: 10,
                fontWeight: 700,
                zIndex: 2,
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: SIDE_COLORS[side], boxShadow: active === side ? `0 0 0 5px ${SIDE_COLORS[side]}33` : "none", flex: "none" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sideLabel(side, fighters)}</span>
            </div>
          );
        })}
        <div style={{ position: "absolute", inset: "auto 0 0", height: 30, display: "flex", justifyContent: "space-between", padding: "7px 9px", borderTop: "1px solid var(--line-soft, #302e29)", color: "var(--faint, #756f65)", fontSize: 9 }}>
          <span>{field.layout.minMeters} м</span>
          <span>{field.layout.maxMeters} м</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {[0, 1].map((sideValue) => {
          const side = sideValue as BattlefieldSide;
          const actor = field.actors[side];
          const context = actorPositionContext(field, side);
          const flags = [STANCE_LABELS[actor.stance], COVER_LABELS[context.cover]];
          if (actor.grappledWith !== null) flags.push("в захвате");
          if (actor.disarmed) flags.push("обезоружен");
          if (actor.stunnedTurns > 0) flags.push(`оглушён: ${actor.stunnedTurns}`);
          return (
            <div key={side} style={{ borderLeft: `2px solid ${SIDE_COLORS[side]}`, padding: "7px 10px", background: "rgba(255,255,255,.025)" }}>
              <strong style={{ fontSize: 12 }}>{sideLabel(side, fighters)} · {actor.positionMeters.toFixed(1)} м</strong>
              <div style={mutedStyle}>{flags.join(" · ")}</div>
              {context.hazard && <div style={{ ...mutedStyle, color: "#d39a68" }}>Опасность: {context.hazard.label}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function FighterEffects({
  effects,
  magicState,
  side,
}: {
  effects: CombatantEffects;
  magicState: MagicState;
  side: MagicSide;
}) {
  const magicConditions = magicState.conditions.filter((item) => item.target === side);
  const magicArmor = magicState.armor.filter((item) => item.target === side);
  const sustains = magicState.sustains.filter((item) => item.caster === side);
  const empty = effects.conditions.length === 0 && effects.wounds.length === 0 && magicConditions.length === 0 && magicArmor.length === 0 && sustains.length === 0;

  return (
    <section className="fighter-effects" style={{ display: "grid", gap: 8 }} aria-label="Состояния и критические раны">
      <div className="section-title" style={{ marginBottom: 0 }}><h3>Состояния и раны</h3><span>{empty ? "нет" : "активны"}</span></div>
      {empty && <p style={{ ...mutedStyle, margin: 0 }}>Нет активных эффектов.</p>}
      {effects.conditions.map((condition) => (
        <div key={condition.id} style={{ padding: "8px 9px", border: "1px solid rgba(177,120,67,.25)", background: "rgba(177,120,67,.06)", fontSize: 11 }}>
          <strong>{condition.label}{condition.stacks > 1 ? ` ×${condition.stacks}` : ""}</strong>
          <div style={mutedStyle}>{condition.source} · ходов: {condition.duration}</div>
        </div>
      ))}
      {magicConditions.map((condition) => (
        <div key={condition.id} style={{ padding: "8px 9px", border: "1px solid rgba(107,125,167,.35)", background: "rgba(107,125,167,.08)", fontSize: 11 }}>
          <strong>{MAGIC_CONDITION_LABELS[condition.condition] ?? condition.condition} ×{condition.intensity}</strong>
          <div style={mutedStyle}>Магия · {condition.remainingRounds === null ? "поддерживается" : `ходов: ${condition.remainingRounds}`}</div>
        </div>
      ))}
      {magicArmor.map((armor) => (
        <div key={armor.id} style={{ padding: "8px 9px", border: "1px solid rgba(113,134,93,.35)", background: "rgba(113,134,93,.08)", fontSize: 11 }}>
          <strong>Магическая броня: {armor.points}</strong>
          <div style={mutedStyle}>{armor.remainingRounds === null ? "Пока поддерживается" : `Ходов: ${armor.remainingRounds}`}</div>
        </div>
      ))}
      {sustains.map((sustain) => (
        <div key={sustain.id} style={{ padding: "8px 9px", border: "1px solid rgba(107,125,167,.35)", fontSize: 11 }}>
          <strong>Поддержание: {sustain.abilityId}</strong>
          <div style={mutedStyle}>−{sustain.upkeep.vigor} VIG / −{sustain.upkeep.stamina} STA · {sustain.remainingRounds} ход.</div>
        </div>
      ))}
      {effects.wounds.map((wound) => (
        <div key={wound.id} style={{ padding: "9px", borderLeft: "2px solid var(--blood-bright, #b94c44)", background: "rgba(142,48,42,.08)", fontSize: 11 }}>
          <strong>{wound.name}</strong>
          <div style={{ ...mutedStyle, color: "#cfa176" }}>{SEVERITY_LABELS[wound.severity]} · {wound.location} · кровотечение {wound.bleed}</div>
          <div style={mutedStyle}>{wound.stabilized ? "Стабилизирована" : "Не стабилизирована"}{wound.treated ? " · вылечена" : ""}</div>
        </div>
      ))}
    </section>
  );
}

export function MonsterPicker({ selected, onChange }: { selected: string; onChange: (monsterId: string) => void }) {
  const selectedMonster = MONSTER_ARCHETYPES.find((monster) => monster.id === selected) ?? MONSTER_ARCHETYPES[0];
  return (
    <section className="monster-picker" style={{ ...panelStyle, display: "grid", gap: 12, textAlign: "left" }}>
      <label style={{ display: "grid", gap: 7 }}>
        <span style={{ ...mutedStyle, textTransform: "uppercase", letterSpacing: ".09em" }}>Противник</span>
        <select value={selectedMonster.id} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
          {MONSTER_ARCHETYPES.map((monster) => (
            <option key={monster.id} value={monster.id}>{monster.name} · {MONSTER_THREAT_LABELS[monster.threat]}</option>
          ))}
        </select>
      </label>
      <div>
        <strong style={{ font: "700 18px var(--serif, serif)" }}>{selectedMonster.name}</strong>
        <p style={{ ...mutedStyle, margin: "7px 0" }}>{selectedMonster.description}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Tag>{MONSTER_THREAT_LABELS[selectedMonster.threat]}</Tag>
          <Tag>{selectedMonster.role}</Tag>
          <Tag>HP {selectedMonster.hp}</Tag>
          <Tag>Броня {Math.max(...Object.values(selectedMonster.armor))}</Tag>
          {selectedMonster.vigor > 0 && <Tag>VIG {selectedMonster.vigor}</Tag>}
        </div>
      </div>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 12 }}>Особенности и уязвимости</summary>
        <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
          {selectedMonster.traits.map((trait) => <p key={trait.id} style={{ ...mutedStyle, margin: 0 }}><strong style={{ color: "inherit" }}>{trait.name}.</strong> {trait.description}</p>)}
          {selectedMonster.vulnerabilities.map((item) => <p key={item.type} style={{ ...mutedStyle, margin: 0, color: "#d3a66e" }}>Уязвимость: {item.type} ×{item.multiplier}</p>)}
        </div>
      </details>
    </section>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span style={{ border: "1px solid var(--line-soft, #302e29)", padding: "4px 7px", borderRadius: 999, color: "var(--muted, #9e988d)", fontSize: 9 }}>{children}</span>;
}

export type ExtendedActionTab = "attack" | "movement" | "maneuver" | "magic" | "treatment";
export type MovementCommand = { type: "move" | "sprint"; toMeters: number };
export type StanceCommand = Extract<BattlefieldActionType, "stand" | "kneel" | "go_prone">;
export type ManeuverCommand = ContestedPhysicalAction | "aim" | "ready";
export type MagicCommand = { abilityId: string; target: MagicSide };
export type TreatmentCommand = { type: "stabilize" | "treat"; target: BattlefieldSide; woundId: string };

export type ExtendedActionPanelProps = {
  encounter: EncounterState;
  fighters: [PreparedFighter, PreparedFighter];
  side: BattlefieldSide;
  tab: ExtendedActionTab;
  onTabChange: (tab: ExtendedActionTab) => void;
  /** Existing weapon-attack controls can be passed here without coupling this component to DuelApp. */
  attackContent?: ReactNode;
  abilities?: readonly MagicAbility[];
  disabled?: boolean;
  message?: string | null;
  onMovement: (command: MovementCommand) => void;
  onStance: (command: StanceCommand) => void;
  onManeuver: (command: ManeuverCommand, target: BattlefieldSide) => void;
  onCast: (command: MagicCommand) => void;
  onTreatment: (command: TreatmentCommand) => void;
};

const TABS: Array<{ id: ExtendedActionTab; label: string }> = [
  { id: "attack", label: "Атака" },
  { id: "movement", label: "Движение" },
  { id: "maneuver", label: "Манёвры" },
  { id: "magic", label: "Магия" },
  { id: "treatment", label: "Помощь" },
];
const MANEUVERS: Array<{ id: ManeuverCommand; label: string; detail: string }> = [
  { id: "grapple", label: "Захват", detail: "Сковать противника в ближнем бою." },
  { id: "escape_grapple", label: "Вырваться", detail: "Освободиться от захвата." },
  { id: "shove", label: "Толчок", detail: "Принудительно отодвинуть цель." },
  { id: "disarm", label: "Обезоружить", detail: "Выбить активное оружие." },
  { id: "knockdown", label: "Опрокинуть", detail: "Сбить цель с ног." },
  { id: "stun", label: "Оглушить", detail: "Лишить цель части действий." },
  { id: "aim", label: "Прицелиться", detail: "Подготовить следующую атаку." },
  { id: "ready", label: "Подготовиться", detail: "Задать реакцию на действие врага." },
];

export function ExtendedActionPanel(props: ExtendedActionPanelProps) {
  const { encounter, fighters, side, tab, disabled = false } = props;
  const field = encounter.battlefield;
  const actor = field.actors[side];
  const opponent = (side === 0 ? 1 : 0) as BattlefieldSide;
  const [movementType, setMovementType] = useState<MovementCommand["type"]>("move");
  const [destination, setDestination] = useState(actor.positionMeters);
  const [abilityId, setAbilityId] = useState("");
  const [magicTarget, setMagicTarget] = useState<MagicSide>(opponent);
  const abilities = props.abilities ?? BUILTIN_MAGIC_ABILITIES;
  const availableAbilities = useMemo(() => abilities.filter((ability) => {
    if (!canFighterUseMagicAbility(fighters[side], ability)) return false;
    const cooldown = encounter.magic.sides[side].cooldowns[ability.id] ?? 0;
    return cooldown <= encounter.magic.round;
  }), [abilities, encounter.magic.round, encounter.magic.sides, fighters, side]);
  const selectedAbility = availableAbilities.find((ability) => ability.id === abilityId) ?? availableAbilities[0] ?? null;
  const ownWounds = encounter.effects[side].wounds;
  const otherWounds = encounter.effects[opponent].wounds;

  return (
    <section className="extended-action-panel" style={{ display: "grid", gap: 14 }}>
      <nav aria-label="Тип действия" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5 }}>
        {TABS.map((item) => <button key={item.id} type="button" onClick={() => props.onTabChange(item.id)} style={tab === item.id ? selectedButtonStyle : buttonStyle}>{item.label}</button>)}
      </nav>
      {props.message && <p style={{ ...mutedStyle, margin: 0, color: "#d3a66e" }}>{props.message}</p>}

      {tab === "attack" && (props.attackContent ?? <p style={mutedStyle}>Выберите оружие и режим атаки в основной панели боя.</p>)}

      {tab === "movement" && <div className="action-form">
        <div className="two-columns">
          <label><span>Режим</span><select style={inputStyle} value={movementType} onChange={(event) => setMovementType(event.target.value as MovementCommand["type"])}><option value="move">Перемещение</option><option value="sprint">Бег</option></select></label>
          <label><span>Точка поля, м</span><input style={inputStyle} type="number" min={field.layout.minMeters} max={field.layout.maxMeters} step="0.5" value={destination} onChange={(event) => setDestination(Number(event.target.value))} /></label>
        </div>
        <p style={mutedStyle}>Сейчас: {actor.positionMeters.toFixed(1)} м · доступно {movementType === "move" ? actor.moveMeters : actor.sprintMeters} м{movementType === "sprint" ? " и расход выносливости" : ""}.</p>
        <button type="button" className="button button-primary" disabled={disabled} onClick={() => props.onMovement({ type: movementType, toMeters: destination })}>Переместиться</button>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {(["stand", "kneel", "go_prone"] as StanceCommand[]).map((stance) => <button key={stance} type="button" disabled={disabled} style={buttonStyle} onClick={() => props.onStance(stance)}>{stance === "stand" ? "Встать" : stance === "kneel" ? "На колено" : "Лечь"}</button>)}
        </div>
      </div>}

      {tab === "maneuver" && <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {MANEUVERS.map((maneuver) => <button key={maneuver.id} type="button" disabled={disabled} style={{ ...buttonStyle, minHeight: 66, textAlign: "left" }} onClick={() => props.onManeuver(maneuver.id, opponent)}><strong>{maneuver.label}</strong><small style={{ ...mutedStyle, display: "block", marginTop: 4 }}>{maneuver.detail}</small></button>)}
      </div>}

      {tab === "magic" && <div className="action-form">
        {availableAbilities.length === 0 ? <p style={mutedStyle}>У бойца нет доступной магии или запаса энергии.</p> : <>
          <label><span>Способность</span><select style={inputStyle} value={selectedAbility?.id ?? ""} onChange={(event) => setAbilityId(event.target.value)}>{availableAbilities.map((ability) => <option key={ability.id} value={ability.id}>{MAGIC_CATEGORY_LABELS[ability.category]} · {ability.name}</option>)}</select></label>
          {selectedAbility && <div style={{ ...panelStyle, padding: 12 }}><strong>{selectedAbility.name}</strong><p style={{ ...mutedStyle, margin: "6px 0" }}>{selectedAbility.description}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}><Tag>VIG {selectedAbility.cost.vigor}</Tag><Tag>STA {selectedAbility.cost.stamina}</Tag><Tag>{selectedAbility.range.min}–{selectedAbility.range.max} м</Tag><Tag>{selectedAbility.check.defense === "none" ? `СЛ ${selectedAbility.check.difficulty}` : selectedAbility.check.defense}</Tag></div></div>}
          {selectedAbility?.target === "either" && <label><span>Цель</span><select style={inputStyle} value={magicTarget} onChange={(event) => setMagicTarget(Number(event.target.value) as MagicSide)}><option value={side}>{fighters[side].name}</option><option value={opponent}>{fighters[opponent].name}</option></select></label>}
          <button type="button" className="button button-primary" disabled={disabled || !selectedAbility} onClick={() => selectedAbility && props.onCast({ abilityId: selectedAbility.id, target: selectedAbility.target === "self" ? side : selectedAbility.target === "opponent" ? opponent : magicTarget })}>Сотворить</button>
        </>}
      </div>}

      {tab === "treatment" && <div style={{ display: "grid", gap: 10 }}>
        {ownWounds.length === 0 && otherWounds.length === 0 && <p style={mutedStyle}>Нет критических ран, требующих помощи.</p>}
        {([[side, ownWounds], [opponent, otherWounds]] as Array<[BattlefieldSide, CriticalWound[]]>).map(([target, wounds]) => wounds.map((wound) => <div key={wound.id} style={{ ...panelStyle, padding: 12 }}><strong>{fighters[target].name}: {wound.name}</strong><p style={{ ...mutedStyle, margin: "5px 0 9px" }}>{wound.description}</p><div style={{ display: "flex", gap: 6 }}><button type="button" disabled={disabled || wound.stabilized} style={buttonStyle} onClick={() => props.onTreatment({ type: "stabilize", target, woundId: wound.id })}>{wound.stabilized ? "Стабилизирована" : "Стабилизировать"}</button><button type="button" disabled={disabled || wound.treated} style={buttonStyle} onClick={() => props.onTreatment({ type: "treat", target, woundId: wound.id })}>{wound.treated ? "Вылечена" : "Лечить"}</button></div></div>))}
      </div>}
    </section>
  );
}
