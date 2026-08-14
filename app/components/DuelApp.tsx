"use client";

import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { DataConnection, Peer } from "peerjs";
import {
  AIM_MODIFIERS, CombatSettings, DefenseMode, LogEntry, PendingAttack, StrikeMode,
  createRng, d10, makeLog, resolveAttack,
} from "../lib/combat";
import {
  AttackDeclaration, ClientAction, ClientMessage, HostMessage, MULTIPLAYER_PROTOCOL_VERSION,
  RoomSnapshot, Side, decodeClientMessage, decodeHostMessage, deriveAttackDeclaration, makeActionMessage, makeRequestId,
  validateClientMessage,
} from "../lib/multiplayer";
import {
  connectionErrorMessage, createRoomCode, inviteUrl, normalizeRoomCode, peerIdFromCode,
  roomCodeFromHash, roomIdFromCode,
} from "../lib/peer-room";
import {
  AttackTurnState, attackTurnOptions, createAttackTurnState, declareTurnAttack, standardAttackComplete,
} from "../lib/turn-economy";
import {
  LOCATION_LABELS, LocationKey, PROFESSION_LABELS, PreparedFighter, RACE_LABELS, RawCharacter,
  STAT_KEYS, buildFighter, characterLabel, demoCharacter, parseWitcherFile, patchRawCharacter,
  prepareFighter, skillLabel,
} from "../lib/witcher";

type Phase = "setup" | "combat" | "complete";
type ImportResult = { character: RawCharacter; warnings: string[]; importedFields: number };
type Session = { kind: "local" | "online-menu" } | { kind: "host" | "guest"; code: string };
type NetworkStatus = "idle" | "connecting" | "waiting" | "connected" | "disconnected" | "error";
type OwnedSource = { side: Side; character: RawCharacter };

const SETTINGS_DEFAULT: CombatSettings = {
  explodingDice: true,
  armorAblation: true,
  criticals: true,
  aimedLocations: true,
  stopAtZero: true,
  seed: 137042,
};

const STORAGE_KEY = "duel-ledger.settings.v1";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function download(name: string, contents: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "") || "duel";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}

function cloneFighters(fighters: [PreparedFighter, PreparedFighter]) {
  return fighters.map((fighter) => ({
    ...fighter,
    armor: Object.fromEntries(Object.entries(fighter.armor).map(([key, zone]) => [key, { ...zone }])),
  })) as [PreparedFighter, PreparedFighter];
}

function cannotContinue(fighter: PreparedFighter, settings: CombatSettings) {
  return fighter.sta <= 0 || (settings.stopAtZero && fighter.hp <= 0);
}

function attackSequenceLabel(state: AttackTurnState, strikeMode: StrikeMode) {
  if (state.extraUsed) return strikeMode === "strong" ? "Дополнительная сильная атака" : "Дополнительная быстрая атака";
  if (strikeMode === "strong") return "Сильная атака";
  return `Быстрая атака ${state.standardStrikes} из 2`;
}

function strikeEndsBattle(
  before: [PreparedFighter, PreparedFighter],
  after: [PreparedFighter, PreparedFighter],
  pending: PendingAttack,
  attackTurn: AttackTurnState,
  settings: CombatSettings,
  damageApplied: boolean,
) {
  // A manually continued battle may already contain a fighter at zero. Only a
  // new defeat or the just-paid extra attack should reopen the victory screen.
  const extraExhaustedAttacker = attackTurn.extraUsed && after[pending.attacker].sta <= 0;
  const defenderFell = damageApplied
    && !cannotContinue(before[pending.defender], settings)
    && cannotContinue(after[pending.defender], settings);
  return extraExhaustedAttacker || defenderFell;
}

function StatusPill({ phase }: { phase: Phase }) {
  const labels = { setup: "Подготовка", combat: "Бой идёт", complete: "Бой завершён" };
  return <span className={`status-pill status-${phase}`}><span aria-hidden="true">●</span>{labels[phase]}</span>;
}

function Meter({ label, value, max, danger = false }: { label: string; value: number; max: number; danger?: boolean }) {
  const percent = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div className="meter-wrap">
      <div className="meter-label"><span>{label}</span><strong>{value} / {max}</strong></div>
      <div className={`meter ${danger ? "meter-danger" : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ImportCard({ side, result, onImport, onDemo }: {
  side: Side;
  result: ImportResult | null;
  onImport: (side: Side, result: ImportResult) => void;
  onDemo: (side: Side) => void;
}) {
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function acceptFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      const candidates = parseWitcherFile(JSON.parse(await file.text()));
      if (candidates.length > 1) candidates[0].warnings.unshift(`В файле ${candidates.length} персонажей — загружен первый.`);
      onImport(side, candidates[0]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось прочитать JSON.");
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  }

  if (result) {
    return (
      <article className="import-card imported-card">
        <div className="eyebrow">Боец {side === 0 ? "A" : "B"}</div>
        <div className="imported-identity">
          <span className="monogram">{initials(String(result.character.name ?? "?"))}</span>
          <div><h2>{String(result.character.name)}</h2><p>{characterLabel(result.character)}</p></div>
        </div>
        <div className="validation-ok"><span aria-hidden="true">✓</span> Лист распознан · {result.importedFields} полей</div>
        {result.warnings.map((warning) => <p className="warning" key={warning}>⚠ {warning}</p>)}
        <button className="button button-quiet" type="button" onClick={() => inputRef.current?.click()}>Заменить файл</button>
        <input ref={inputRef} hidden type="file" accept=".json,.witcher.json,application/json" onChange={(event) => void acceptFile(event.target.files?.[0])} />
      </article>
    );
  }

  return (
    <article className={`import-card ${dragging ? "dragging" : ""}`}>
      <div className="eyebrow">Боец {side === 0 ? "A" : "B"}</div>
      <div className="drop-zone" onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <span className="file-glyph" aria-hidden="true">↥</span>
        <h2>Загрузите персонажа</h2>
        <p>Перетащите сюда экспорт <code>.witcher.json</code></p>
        <button className="button button-primary" type="button" onClick={() => inputRef.current?.click()}>Выбрать файл</button>
        <button className="text-button" type="button" onClick={() => onDemo(side)}>или загрузить пример</button>
        <input ref={inputRef} hidden type="file" accept=".json,.witcher.json,application/json" onChange={(event) => void acceptFile(event.target.files?.[0])} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

function RemoteFighterCard({ fighter, side, connected }: { fighter: PreparedFighter | null; side: Side; connected: boolean }) {
  return (
    <article className="import-card remote-card">
      <div className="eyebrow">Боец {side === 0 ? "A" : "B"} · соперник</div>
      {fighter ? <>
        <div className="imported-identity"><span className="monogram">{initials(fighter.name)}</span><div><h2>{fighter.name}</h2><p>{RACE_LABELS[fighter.race] ?? fighter.race} · {PROFESSION_LABELS[fighter.profession] ?? fighter.profession}</p></div></div>
        <div className="validation-ok"><span aria-hidden="true">✓</span> Соперник готов к бою</div>
        <p className="remote-note">Переданы характеристики, навыки, снаряжение и текущие ресурсы. Биография, деньги и заметки листа остаются на устройстве владельца.</p>
      </> : <div className="remote-wait"><span className="waiting-rune" aria-hidden="true">◇</span><h2>{connected ? "Соперник выбирает бойца" : "Ждём подключения"}</h2><p>{connected ? "Он загрузит собственного персонажа на своём устройстве." : "Отправьте ему ссылку или код комнаты."}</p></div>}
    </article>
  );
}

function UploadWaitingCard({ side }: { side: Side }) {
  return <article className="import-card remote-card"><div className="eyebrow">Боец {side === 0 ? "A" : "B"} · вы</div><div className="remote-wait"><span className="waiting-rune" aria-hidden="true">◇</span><h2>Получаем состояние комнаты</h2><p>Загрузка персонажа станет доступна сразу после синхронизации с владельцем.</p></div></article>;
}

function FighterCard({ fighter, side, active, owned }: { fighter: PreparedFighter; side: Side; active: boolean; owned: boolean }) {
  const lowHp = fighter.hp > 0 && fighter.hp <= Math.floor(fighter.maxHp / 5);
  const state = fighter.hp <= 0 ? "Побеждён" : fighter.sta <= 0 ? "Без сознания" : lowHp ? "Тяжело ранен" : active ? "Ходит" : "Готов";
  const relevantSkills = ["swordsmanship", "small_blades", "staff_spear", "melee", "brawling", "archery", "crossbow", "athletics", "dodge_escape"];
  return (
    <article className={`fighter-card side-${side} ${active ? "fighter-active" : ""} ${owned ? "fighter-owned" : ""}`}>
      <header className="fighter-head">
        <span className="monogram">{initials(fighter.name)}</span>
        <div className="fighter-title"><span className="eyebrow">Боец {side === 0 ? "A" : "B"}{owned ? " · вы" : ""}</span><h2>{fighter.name}</h2><p>{RACE_LABELS[fighter.race] ?? fighter.race} · {PROFESSION_LABELS[fighter.profession] ?? fighter.profession}</p></div>
        <span className={`fighter-state ${fighter.hp <= 0 ? "state-danger" : ""}`}>{state}</span>
      </header>
      <div className="resource-stack"><Meter label="Здоровье" value={fighter.hp} max={fighter.maxHp} danger={lowHp || fighter.hp <= 0} /><Meter label="Выносливость" value={fighter.sta} max={fighter.maxSta} /></div>
      <div className="derived-grid"><span><b>{fighter.stun}</b> Оглушение</span><span><b>{fighter.rec}</b> Восстановление</span><span><b>{fighter.run}</b> Бег</span><span><b>{fighter.leap}</b> Прыжок</span></div>
      <section className="armor-block"><div className="section-title"><h3>Защита</h3><span>ПБ</span></div>{Object.entries(fighter.armor).map(([key, zone]) => <div className="armor-row" key={key}><span>{LOCATION_LABELS[key as LocationKey]}</span><strong>{zone.sp}</strong><small>{zone.sp < zone.originalSp ? `−${zone.originalSp - zone.sp}` : zone.source}</small></div>)}</section>
      <details><summary>Характеристики</summary><div className="stat-grid">{STAT_KEYS.map((key) => <span key={key}><small>{key}</small><b>{fighter.stats[key]}</b></span>)}</div></details>
      <details><summary>Боевые навыки</summary><div className="skill-list">{relevantSkills.map((key) => <span key={key}><span>{skillLabel(key)}</span><b>{fighter.skills[key]}</b></span>)}</div></details>
      <details open><summary>Оружие</summary><div className="weapon-list">{fighter.weapons.map((weapon) => <div key={weapon.uid}><span>{weapon.name}<small>{skillLabel(weapon.attackSkill)}</small></span><b>{weapon.damage}</b></div>)}</div></details>
      {fighter.warnings.length > 0 && <details className="warnings-block"><summary>Проверить импорт ({fighter.warnings.length})</summary>{fighter.warnings.map((item) => <p key={item}>⚠ {item}</p>)}</details>}
    </article>
  );
}

function SettingsPanel({ settings, onChange, onClose }: { settings: CombatSettings; onChange: (settings: CombatSettings) => void; onClose: () => void }) {
  type BooleanSetting = Exclude<keyof CombatSettings, "seed">;
  function toggle(key: BooleanSetting) { onChange({ ...settings, [key]: !settings[key] }); }
  const rows: [BooleanSetting, string, string][] = [
    ["explodingDice", "Взрывные d10", "Единица и десятка запускают дополнительный бросок."],
    ["armorAblation", "Абляция брони", "Если урон прошёл, ПБ зоны уменьшается на 1."],
    ["criticals", "Критические ранения", "Степень определяется разницей атаки и защиты."],
    ["aimedLocations", "Прицельные удары", "Добавляет штрафы за выбор зоны."],
    ["stopAtZero", "Завершать при 0 ПЗ", "Смерть и постоянные увечья остаются на усмотрение группы."],
  ];
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header><div><span className="eyebrow">Профиль боя</span><h2 id="settings-title">Настройки правил</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
        <p className="panel-note">Режим «с подтверждением»: броски и формулы автоматические, урон применяется отдельной кнопкой.</p>
        {rows.map(([key, label, hint]) => <label className="setting-row" key={key}><span><b>{label}</b><small>{hint}</small></span><input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} /></label>)}
        <label className="seed-field"><span>Seed боя</span><input type="number" value={settings.seed} onChange={(event) => onChange({ ...settings, seed: Number(event.target.value) || 1 })} /></label>
        <button className="button button-quiet" type="button" onClick={() => onChange({ ...settings, seed: Math.floor(Math.random() * 2_147_483_647) })}>Создать новый seed</button>
        <div className="rules-boundary"><strong>Граница автоматизации</strong><p>Названия конкретных критических ран и спорные эффекты сверяйте со своей книгой. Симулятор фиксирует степень и бонусный урон.</p></div>
      </aside>
    </div>
  );
}

function ExportPanel({ fighters, settings, log, round, ownedSources, onClose }: {
  fighters: [PreparedFighter, PreparedFighter]; settings: CombatSettings; log: LogEntry[]; round: number;
  ownedSources: OwnedSource[]; onClose: () => void;
}) {
  function exportBattle() {
    const result = fighters.map((fighter) => ({ name: fighter.name, final: { hp: fighter.hp, sta: fighter.sta, armor: fighter.armor } }));
    download(`${slug(fighters[0].name)}-vs-${slug(fighters[1].name)}.duel.json`, JSON.stringify({ kind: "duel-ledger", version: 2, exportedAt: new Date().toISOString(), settings, round, fighters: result, log }, null, 2));
  }
  function exportMarkdown() {
    const lines = [`# ${fighters[0].name} против ${fighters[1].name}`, "", `Раундов: ${round}`, `Seed: ${settings.seed}`, "", `Итог: ${fighters[0].name} — ${fighters[0].hp}/${fighters[0].maxHp} ПЗ; ${fighters[1].name} — ${fighters[1].hp}/${fighters[1].maxHp} ПЗ`, "", "## Журнал", "", ...log.map((entry) => `- **Раунд ${entry.round}.** ${entry.title} — ${entry.detail}`)];
    download(`${slug(fighters[0].name)}-vs-${slug(fighters[1].name)}.md`, lines.join("\n"), "text/markdown");
  }
  function exportCharacters() {
    const updated = ownedSources.map(({ side, character }) => patchRawCharacter(character, fighters[side]));
    download(updated.length === 1 ? `${slug(String(updated[0].name ?? "character"))}-after-duel.witcher.json` : "witcher-characters-after-duel.json", JSON.stringify(updated.length === 1 ? updated[0] : updated, null, 2));
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel export-panel" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header><div><span className="eyebrow">Результат</span><h2 id="export-title">Экспорт боя</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
        <button className="export-option" type="button" onClick={exportBattle}><b>Скачать бой .json</b><small>Настройки, итоговые показатели и полный журнал — без приватных полей листов</small><span>↧</span></button>
        <button className="export-option" type="button" onClick={exportMarkdown}><b>Скачать отчёт .md</b><small>Читаемый протокол для заметок кампании</small><span>↧</span></button>
        {ownedSources.length > 0 && <button className="export-option" type="button" onClick={exportCharacters}><b>{ownedSources.length === 1 ? "Скачать своего обновлённого персонажа" : "Скачать обновлённых персонажей"}</b><small>Новые текущие ПЗ и Выносливость; зональная абляция остаётся в журнале</small><span>↧</span></button>}
      </aside>
    </div>
  );
}

function OnlineMenu({ joinCode, onJoinCode, onCreate, onJoin }: { joinCode: string; onJoinCode: (value: string) => void; onCreate: () => void; onJoin: () => void }) {
  return (
    <section className="online-menu-card">
      <div><span className="eyebrow">Два устройства</span><h3>Онлайн-комната</h3><p>Владелец комнаты управляет бойцом A. Второй игрок открывает приглашение и управляет бойцом B.</p></div>
      <button className="button button-primary" type="button" onClick={onCreate}>Создать комнату</button>
      <span className="online-or">или войти по коду</span>
      <div className="join-row"><input value={joinCode} onChange={(event) => onJoinCode(normalizeRoomCode(event.target.value))} placeholder="16-значный код" aria-label="Код комнаты" /><button className="button button-quiet" type="button" onClick={onJoin} disabled={joinCode.length !== 16}>Войти</button></div>
    </section>
  );
}

function ConnectionBar({ role, code, status, error, onCopy, copied, onRetry }: {
  role: "host" | "guest"; code: string; status: NetworkStatus; error: string; onCopy: () => void; copied: boolean; onRetry: () => void;
}) {
  const statusLabel = status === "connected" ? "Соперник подключён" : status === "waiting" ? "Ожидаем соперника" : status === "connecting" ? "Соединяем…" : "Связь прервана";
  return (
    <section className={`connection-bar connection-${status}`}>
      <span className="connection-dot" aria-hidden="true" />
      <div><span className="eyebrow">{role === "host" ? "Вы — боец A" : "Вы — боец B"}</span><b>{statusLabel}</b>{error && <small>{error}</small>}</div>
      <code>{code.toUpperCase()}</code>
      {role === "host" && <button className="button button-quiet" type="button" onClick={onCopy}>{copied ? "Ссылка скопирована" : "Копировать приглашение"}</button>}
      {(status === "error" || status === "disconnected") && <button className="button button-quiet" type="button" onClick={onRetry}>Подключиться снова</button>}
    </section>
  );
}

function WaitingAction({ title, detail }: { title: string; detail: string }) {
  return <div className="waiting-action"><span className="waiting-rune" aria-hidden="true">◇</span><span className="eyebrow">Онлайн-бой</span><h2>{title}</h2><p>{detail}</p></div>;
}

export default function DuelApp() {
  const hashCode = typeof window === "undefined" ? "" : roomCodeFromHash(window.location.hash);
  const [session, setSession] = useState<Session>(hashCode ? { kind: "guest", code: hashCode } : { kind: "local" });
  const [joinCode, setJoinCode] = useState(hashCode);
  const [imports, setImports] = useState<[ImportResult | null, ImportResult | null]>([null, null]);
  const [prepared, setPrepared] = useState<[PreparedFighter | null, PreparedFighter | null]>([null, null]);
  const [fighters, setFighters] = useState<[PreparedFighter, PreparedFighter] | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [settings, setSettings] = useState<CombatSettings>(SETTINGS_DEFAULT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [active, setActive] = useState<Side>(0);
  const [firstSide, setFirstSide] = useState<Side>(0);
  const [initiative, setInitiative] = useState<[number, number]>([0, 0]);
  const [round, setRound] = useState(1);
  const [turn, setTurn] = useState(1);
  const [weaponUid, setWeaponUid] = useState("");
  const [defense, setDefense] = useState<DefenseMode>("dodge");
  const [strike, setStrike] = useState<StrikeMode>("normal");
  const [location, setLocation] = useState<LocationKey | "random">("random");
  const [modifier, setModifier] = useState(0);
  const [modifierNote, setModifierNote] = useState("");
  const [attackTurn, setAttackTurn] = useState<AttackTurnState>(createAttackTurnState());
  const [attackDeclaration, setAttackDeclaration] = useState<AttackDeclaration | null>(null);
  const [pending, setPending] = useState<PendingAttack | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | LogEntry["type"]>("all");
  const [revision, setRevision] = useState(0);
  const [players, setPlayers] = useState<RoomSnapshot["players"]>([{ side: 0, connected: true, ready: false }, { side: 1, connected: false, ready: false }]);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(hashCode ? "connecting" : "idle");
  const [networkError, setNetworkError] = useState("");
  const [guestSynced, setGuestSynced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const rngRef = useRef<() => number>(createRng(settings.seed));
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const snapshotRef = useRef<RoomSnapshot | null>(null);
  const committingRevisionRef = useRef<number | null>(null);
  const seenRequestIdsRef = useRef(new Set<string>());
  const acceptMessageRef = useRef<(message: ClientMessage, actor: Side) => void>(() => undefined);

  const online = session.kind === "host" || session.kind === "guest";
  const ownSide: Side | null = session.kind === "host" ? 0 : session.kind === "guest" ? 1 : null;
  const roomId = online ? roomIdFromCode(session.code) : "";
  const connected = !online || networkStatus === "connected";

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try { setSettings({ ...SETTINGS_DEFAULT, ...JSON.parse(saved) }); } catch { /* invalid local preference */ }
  }, []);
  useEffect(() => { if (session.kind !== "guest") localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings, session.kind]);

  const snapshot = useMemo<RoomSnapshot | null>(() => online ? {
    protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
    roomId,
    revision,
    phase,
    stage: phase === "setup" ? "setup" : phase === "complete" ? "complete" : attackDeclaration ? "defense" : pending ? "resolution" : "action",
    players,
    prepared,
    fighters,
    settings,
    active,
    firstSide,
    initiative,
    round,
    turn,
    attackTurn,
    attackDeclaration,
    pending,
    log,
  } : null, [online, roomId, revision, phase, players, prepared, fighters, settings, active, firstSide, initiative, round, turn, attackTurn, attackDeclaration, pending, log]);

  useEffect(() => {
    snapshotRef.current = snapshot;
    if (snapshot && committingRevisionRef.current !== null && snapshot.revision >= committingRevisionRef.current) committingRevisionRef.current = null;
    if (session.kind === "host" && snapshot && connectionRef.current?.open) {
      const message: HostMessage = { type: "snapshot", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, snapshot };
      connectionRef.current.send(message);
    }
  }, [snapshot, session.kind]);

  function applySnapshot(next: RoomSnapshot) {
    const current = snapshotRef.current;
    if (current?.roomId === next.roomId && next.revision < current.revision) return;
    snapshotRef.current = next;
    setRevision(next.revision); setPhase(next.phase); setPlayers(next.players); setPrepared(next.prepared); setFighters(next.fighters);
    setSettings(next.settings); setActive(next.active); setFirstSide(next.firstSide); setInitiative(next.initiative); setRound(next.round);
    setTurn(next.turn); setAttackTurn(next.attackTurn); setAttackDeclaration(next.attackDeclaration); setPending(next.pending); setLog(next.log);
    if (next.phase === "setup" && ownSide !== null && next.prepared[ownSide] === null) {
      setImports((current) => ownSide === 0 ? [null, current[1]] : [current[0], null]);
    }
    const currentWeapon = next.fighters?.[next.active].weapons[0]?.uid ?? "";
    setWeaponUid((value) => next.fighters?.[next.active].weapons.some((weapon) => weapon.uid === value) ? value : currentWeapon);
  }

  function bumpRevision(base: RoomSnapshot) {
    const next = base.revision + 1;
    setRevision(next);
  }

  function advanceOnline(base: RoomSnapshot, nextFighters = base.fighters) {
    if (!nextFighters) return;
    const next: Side = base.active === 0 ? 1 : 0;
    setActive(next); setTurn(base.turn + 1); setAttackTurn(createAttackTurnState()); setPending(null); setAttackDeclaration(null);
    setWeaponUid(nextFighters[next].weapons[0]?.uid ?? ""); setModifier(0); setModifierNote(""); setLocation("random"); setStrike("normal");
    if (next === base.firstSide) setRound(base.round + 1);
  }

  function settleOnlineStrike(base: RoomSnapshot, nextFighters = base.fighters, battleEnded = false) {
    if (!nextFighters) return;
    if (battleEnded) {
      setPhase("complete"); setAttackTurn(createAttackTurnState()); setPending(null); setAttackDeclaration(null);
      return;
    }
    if (base.attackTurn.extraUsed) {
      advanceOnline(base, nextFighters);
      return;
    }
    setPending(null); setAttackDeclaration(null); setModifier(0); setModifierNote(""); setLocation("random"); setStrike("normal");
  }

  function performHostAction(action: ClientAction, actor: Side, base: RoomSnapshot) {
    switch (action.type) {
      case "submit_fighter": {
        setPrepared((current) => actor === 0 ? [action.fighter, current[1]] : [current[0], action.fighter]);
        setPlayers((current) => current.map((player) => player.side === actor ? { ...player, ready: true } : player) as RoomSnapshot["players"]);
        break;
      }
      case "set_ready": setPlayers((current) => current.map((player) => player.side === actor ? { ...player, ready: action.ready } : player) as RoomSnapshot["players"]); break;
      case "set_settings": setSettings(action.settings); break;
      case "start_battle": {
        if (!base.prepared[0] || !base.prepared[1]) return;
        const built = structuredClone(base.prepared) as [PreparedFighter, PreparedFighter];
        rngRef.current = createRng(base.settings.seed);
        const rolls = [d10(rngRef.current, base.settings.explodingDice), d10(rngRef.current, base.settings.explodingDice)] as const;
        const values: [number, number] = [built[0].initiativeBase + rolls[0].total, built[1].initiativeBase + rolls[1].total];
        const first: Side = values[0] === values[1] ? (built[0].initiativeBase >= built[1].initiativeBase ? 0 : 1) : values[0] > values[1] ? 0 : 1;
        setFighters(built); setInitiative(values); setActive(first); setFirstSide(first); setWeaponUid(built[first].weapons[0]?.uid ?? "");
        setPhase("combat"); setRound(1); setTurn(1); setAttackTurn(createAttackTurnState()); setPending(null); setAttackDeclaration(null);
        setLog([makeLog(1, 0, "system", "Бой начался", `${built[0].name} против ${built[1].name}. Seed ${base.settings.seed}.`), makeLog(1, 0, "roll", "Инициатива", `${built[0].name}: ${values[0]} (${rolls[0].text}); ${built[1].name}: ${values[1]} (${rolls[1].text}).`)]);
        break;
      }
      case "declare_attack": {
        if (!base.fighters) return;
        const weapon = base.fighters[actor].weapons.find((item) => item.uid === action.weaponUid);
        if (!weapon?.damage.trim()) return;
        const derived = deriveAttackDeclaration(base, action);
        if (!derived.ok) return;
        setAttackTurn(derived.attackTurn);
        setAttackDeclaration(derived.declaration);
        if (derived.declaration.staminaCost) {
          const updated = cloneFighters(base.fighters);
          const fighter = updated[actor];
          const before = fighter.sta;
          fighter.sta = Math.max(0, fighter.sta - derived.declaration.staminaCost);
          setFighters(updated);
          setLog((current) => [makeLog(base.round, base.turn, "system", `${fighter.name} проводит дополнительную атаку`, `Выносливость ${before} → ${fighter.sta}; штраф −3 к попаданию.`), ...current]);
        }
        break;
      }
      case "choose_defense": {
        if (!base.fighters || !base.attackDeclaration) return;
        const declaration = base.attackDeclaration;
        const weapon = base.fighters[declaration.attacker].weapons.find((item) => item.uid === declaration.weaponUid);
        if (!weapon) return;
        const result = resolveAttack({ fighters: base.fighters, attacker: declaration.attacker, weapon, defenseMode: action.defenseMode, strikeMode: declaration.strikeMode, locationChoice: declaration.locationChoice, modifier: declaration.modifier + declaration.automaticModifier, settings: base.settings, rng: rngRef.current });
        setPending(result); setAttackDeclaration(null);
        const totalModifier = result.attackModifier + result.aimedModifier;
        const systemPenalties = [declaration.strikeMode === "strong" ? "сильная −3" : "", declaration.extra ? "дополнительная −3" : ""].filter(Boolean).join(", ");
        setLog((current) => [makeLog(base.round, base.turn, "roll", `${base.fighters![result.attacker].name}: ${attackSequenceLabel(base.attackTurn, declaration.strikeMode).toLowerCase()}`, `${result.attackRoll.text} + база ${result.attackBase}${totalModifier ? ` ${totalModifier >= 0 ? "+" : "−"} ${Math.abs(totalModifier)}` : ""} = ${result.attackTotal}; защита ${result.defenseTotal}.${systemPenalties ? ` Системные штрафы: ${systemPenalties}.` : ""}${declaration.modifierNote ? ` ${declaration.modifierNote}` : ""}`), ...current]);
        break;
      }
      case "apply_pending": {
        if (!base.fighters || !base.pending) return;
        const updated = cloneFighters(base.fighters);
        const target = updated[base.pending.defender];
        target.hp = Math.max(base.settings.stopAtZero ? 0 : -999, target.hp - base.pending.finalDamage);
        if (base.settings.armorAblation && base.pending.normalDamage > 0) target.armor[base.pending.location].sp = Math.max(target.armor[base.pending.location].natural, target.armor[base.pending.location].sp - 1);
        setFighters(updated);
        const critical = base.pending.criticalLevel ? ` ${base.pending.criticalLevel} критическое ранение: +${base.pending.criticalBonus} урона; конкретную рану выберите по книге.` : "";
        setLog((current) => [makeLog(base.round, base.turn, "damage", `${target.name} получает ${base.pending!.finalDamage} урона`, `${LOCATION_LABELS[base.pending!.location]} · ${base.pending!.formula}.${critical}`), ...current]);
        settleOnlineStrike(base, updated, strikeEndsBattle(base.fighters, updated, base.pending, base.attackTurn, base.settings, true));
        break;
      }
      case "finish_miss": {
        if (!base.pending) return;
        setLog((current) => [makeLog(base.round, base.turn, "system", "Атака не попала", `Атака ${base.pending!.attackTotal} против защиты ${base.pending!.defenseTotal}.`), ...current]);
        settleOnlineStrike(base, base.fighters, Boolean(base.fighters && strikeEndsBattle(base.fighters, base.fighters, base.pending, base.attackTurn, base.settings, false)));
        break;
      }
      case "end_turn": {
        if (!base.fighters) return;
        const fighter = base.fighters[base.active];
        const detail = standardAttackComplete(base.attackTurn)
          ? "Основное атакующее действие завершено без дополнительной атаки."
          : "Вторая быстрая атака не использована.";
        setLog((current) => [makeLog(base.round, base.turn, "system", `${fighter.name} завершает ход`, detail), ...current]);
        advanceOnline(base);
        break;
      }
      case "recover":
      case "pass": {
        if (!base.fighters) return;
        const updated = cloneFighters(base.fighters);
        const fighter = updated[base.active];
        if (action.type === "recover") { const before = fighter.sta; fighter.sta = Math.min(fighter.maxSta, fighter.sta + fighter.rec); setLog((current) => [makeLog(base.round, base.turn, "system", `${fighter.name} восстанавливается`, `Выносливость ${before} → ${fighter.sta}.`), ...current]); }
        else setLog((current) => [makeLog(base.round, base.turn, "system", `${fighter.name} пропускает ход`, "Действий не совершено."), ...current]);
        setFighters(updated); advanceOnline(base, updated);
        break;
      }
      case "continue_battle": setPhase("combat"); setLog((current) => [makeLog(base.round, base.turn, "system", "Бой продолжен вручную", "Порог завершения проигнорирован владельцем комнаты."), ...current]); advanceOnline(base); break;
      case "reset_room": {
        setImports([null, null]); setPrepared([null, null]); setFighters(null); setPhase("setup"); setActive(0); setFirstSide(0); setInitiative([0, 0]);
        setRound(1); setTurn(1); setAttackTurn(createAttackTurnState()); setPending(null); setAttackDeclaration(null); setLog([]); setExportOpen(false);
        setPlayers((current) => current.map((player) => ({ ...player, ready: false })) as RoomSnapshot["players"]);
        break;
      }
    }
    bumpRevision(base);
  }

  function acceptClientMessage(message: ClientMessage, actor: Side) {
    const base = snapshotRef.current;
    if (!base) return;
    if (committingRevisionRef.current !== null) {
      if (actor === 1 && connectionRef.current?.open) connectionRef.current.send({ type: "rejected", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, code: "stale_revision", message: "Предыдущее действие ещё применяется. Дождитесь нового состояния.", requestId: message.requestId } satisfies HostMessage);
      return;
    }
    if (seenRequestIdsRef.current.has(message.requestId)) {
      if (actor === 1 && connectionRef.current?.open) connectionRef.current.send({ type: "rejected", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, code: "stale_revision", message: "Это действие уже было обработано.", requestId: message.requestId, snapshot: base } satisfies HostMessage);
      return;
    }
    const checked = validateClientMessage(message, actor, base);
    if (!checked.ok) {
      if (actor === 0) setNetworkError(checked.message);
      else if (connectionRef.current?.open) {
        const rejected: HostMessage = { type: "rejected", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, code: checked.code, message: checked.message, requestId: message.requestId, snapshot: base };
        connectionRef.current.send(rejected);
      }
      return;
    }
    if (message.type === "action") {
      setNetworkError("");
      seenRequestIdsRef.current.add(message.requestId);
      if (seenRequestIdsRef.current.size > 500) seenRequestIdsRef.current.delete(seenRequestIdsRef.current.values().next().value as string);
      committingRevisionRef.current = base.revision + 1;
      performHostAction(message.action, actor, base);
    }
  }
  acceptMessageRef.current = acceptClientMessage;

  useEffect(() => {
    if (session.kind !== "host" && session.kind !== "guest") return;
    const onlineSession = session;
    let disposed = false;
    const isHost = onlineSession.kind === "host";
    const peer = isHost ? new Peer(peerIdFromCode(onlineSession.code), { debug: import.meta.env.DEV ? 2 : 1 }) : new Peer({ debug: import.meta.env.DEV ? 2 : 1 });
    peerRef.current = peer;
    setNetworkStatus("connecting"); setNetworkError("");
    if (!isHost) setGuestSynced(false);

    function handleError(error: { type?: string; message?: string }) {
      if (disposed) return;
      setNetworkStatus("error"); setNetworkError(connectionErrorMessage(error.type));
    }

    function closeConnection(connection: DataConnection) {
      if (connectionRef.current !== connection || disposed) return;
      connectionRef.current = null;
      setNetworkStatus(isHost ? "waiting" : "disconnected");
      if (isHost) setPlayers((current) => [current[0], { ...current[1], connected: false }]);
    }

    function attachHostConnection(connection: DataConnection) {
      if (connectionRef.current?.open) { connection.on("open", () => connection.close()); return; }
      connectionRef.current = connection;
      connection.on("open", () => {
        if (disposed) return;
        setNetworkStatus("connected");
        setPlayers((current) => [current[0], { ...current[1], connected: true }]);
      });
      connection.on("data", (data) => {
        if (disposed) return;
        const decoded = decodeClientMessage(data);
        if (!decoded.ok) {
          const rejected: HostMessage = { type: "rejected", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, code: decoded.code, message: decoded.message };
          if (connection.open) connection.send(rejected);
          return;
        }
        if (decoded.value.roomId !== roomIdFromCode(onlineSession.code)) return;
        if (decoded.value.type === "hello") {
          const current = snapshotRef.current;
          if (current && connection.open) connection.send({ type: "welcome", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, side: 1, snapshot: current } satisfies HostMessage);
        } else if (decoded.value.type === "request_snapshot") {
          const current = snapshotRef.current;
          if (current && connection.open) connection.send({ type: "snapshot", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, snapshot: current } satisfies HostMessage);
        } else acceptMessageRef.current(decoded.value, 1);
      });
      connection.on("close", () => closeConnection(connection));
      connection.on("error", handleError);
    }

    function attachGuestConnection(connection: DataConnection) {
      connectionRef.current = connection;
      connection.on("open", () => {
        if (disposed) return;
        setNetworkStatus("connected"); setNetworkError("");
        connection.send({ type: "hello", protocolVersion: MULTIPLAYER_PROTOCOL_VERSION, roomId: roomIdFromCode(onlineSession.code), requestId: makeRequestId() } satisfies ClientMessage);
      });
      connection.on("data", (data) => {
        if (disposed) return;
        const decoded = decodeHostMessage(data);
        if (!decoded.ok) { setNetworkError("Получен несовместимый ответ комнаты."); return; }
        if (decoded.value.type === "rejected") {
          setNetworkError(decoded.value.message);
          if (decoded.value.snapshot) applySnapshot(decoded.value.snapshot);
          return;
        }
        setGuestSynced(true);
        setNetworkError("");
        applySnapshot(decoded.value.snapshot);
      });
      connection.on("close", () => closeConnection(connection));
      connection.on("error", handleError);
    }

    peer.on("open", () => {
      if (disposed) return;
      if (isHost) { setNetworkStatus("waiting"); setPlayers((current) => [{ ...current[0], connected: true }, current[1]]); }
      else attachGuestConnection(peer.connect(peerIdFromCode(onlineSession.code), { label: "witcher-pvp-v2", serialization: "json", reliable: true }));
    });
    if (isHost) peer.on("connection", attachHostConnection);
    peer.on("error", handleError);
    peer.on("disconnected", () => {
      if (!disposed && !connectionRef.current?.open) setNetworkStatus("disconnected");
    });

    return () => {
      disposed = true;
      connectionRef.current?.close(); connectionRef.current = null;
      peer.destroy(); peerRef.current = null;
      if (!isHost) setGuestSynced(false);
    };
  }, [online, reconnectKey, session]);

  const activeFighter = fighters?.[active] ?? null;
  const selectedWeapon = activeFighter?.weapons.find((weapon) => weapon.uid === weaponUid) ?? activeFighter?.weapons[0] ?? null;
  const filteredLog = logFilter === "all" ? log : log.filter((entry) => entry.type === logFilter);
  const defeatedSides = fighters ? ([0, 1] as Side[]).filter((side) => cannotContinue(fighters[side], settings)) : [];
  const defeated = defeatedSides.length === 1 && fighters ? fighters[defeatedSides[0]] : null;
  const draw = defeatedSides.length === 2;
  const winnerName = defeated && fighters ? fighters[defeatedSides[0] === 0 ? 1 : 0].name : null;
  const turnOptions = attackTurnOptions(attackTurn, activeFighter?.sta ?? 0);
  const choosingExtra = turnOptions.standardComplete && !attackTurn.extraUsed && !attackTurn.ended;
  const secondFast = attackTurn.standardMode === "normal" && attackTurn.standardStrikes === 1;
  const actionStrike: StrikeMode = secondFast ? "normal" : strike;
  const selectedExtraAvailable = actionStrike === "strong" ? turnOptions.canExtraStrong : turnOptions.canExtraFast;
  const rollButtonLabel = secondFast
    ? "Провести вторую быструю"
    : choosingExtra
      ? `Провести дополнительную ${actionStrike === "strong" ? "сильную" : "быструю"}`
      : online ? "Объявить атаку" : "Бросить атаку";
  const currentAttackLabel = attackDeclaration
    ? attackSequenceLabel(attackTurn, attackDeclaration.strikeMode)
    : pending
      ? attackSequenceLabel(attackTurn, pending.strikeMode)
      : null;
  const canAct = !online || (connected && ownSide === active);
  const canDefend = online && connected && attackDeclaration?.defender === ownSide;
  const ownedSources = useMemo<OwnedSource[]>(() => {
    if (!online) return ([0, 1] as Side[]).flatMap((side) => imports[side] ? [{ side, character: imports[side]!.character }] : []);
    return ownSide !== null && imports[ownSide] ? [{ side: ownSide, character: imports[ownSide]!.character }] : [];
  }, [imports, online, ownSide]);

  function dispatchOnline(action: ClientAction) {
    const current = snapshotRef.current;
    if (!current || ownSide === null) return;
    const message = makeActionMessage(current.roomId, current.revision, action);
    if (session.kind === "host") acceptClientMessage(message, 0);
    else if (connectionRef.current?.open) connectionRef.current.send(message);
    else setNetworkError("Нет связи с комнатой. Подключитесь снова.");
  }

  function importResult(side: Side, result: ImportResult) {
    setImports((current) => side === 0 ? [result, current[1]] : [current[0], result]);
    const fighter = prepareFighter(buildFighter(result.character, result.warnings));
    if (!online) setPrepared((current) => side === 0 ? [fighter, current[1]] : [current[0], fighter]);
    else if (side === ownSide) dispatchOnline({ type: "submit_fighter", fighter });
  }
  function loadDemo(side: Side) { importResult(side, parseWitcherFile(demoCharacter(side === 0 ? "a" : "b"))[0]); }
  function swapImports() {
    setImports(([first, second]) => [second, first]);
    setPrepared(([first, second]) => [second, first]);
  }

  function beginLocalCombat() {
    if (!prepared[0] || !prepared[1]) return;
    const built = structuredClone(prepared) as [PreparedFighter, PreparedFighter];
    rngRef.current = createRng(settings.seed);
    const rolls = [d10(rngRef.current, settings.explodingDice), d10(rngRef.current, settings.explodingDice)] as const;
    const values: [number, number] = [built[0].initiativeBase + rolls[0].total, built[1].initiativeBase + rolls[1].total];
    const first: Side = values[0] === values[1] ? (built[0].initiativeBase >= built[1].initiativeBase ? 0 : 1) : values[0] > values[1] ? 0 : 1;
    setFighters(built); setInitiative(values); setActive(first); setFirstSide(first); setWeaponUid(built[first].weapons[0]?.uid ?? ""); setPhase("combat"); setRound(1); setTurn(1); setAttackTurn(createAttackTurnState()); setPending(null); setAttackDeclaration(null);
    setLog([makeLog(1, 0, "system", "Бой начался", `${built[0].name} против ${built[1].name}. Seed ${settings.seed}.`), makeLog(1, 0, "roll", "Инициатива", `${built[0].name}: ${values[0]} (${rolls[0].text}); ${built[1].name}: ${values[1]} (${rolls[1].text}).`)]);
  }

  function beginCombat() { if (online) dispatchOnline({ type: "start_battle" }); else beginLocalCombat(); }

  function rollOrDeclareAttack() {
    if (!fighters || !selectedWeapon || pending || attackDeclaration) return;
    if (!selectedWeapon.damage.trim()) { setLog((current) => [makeLog(round, turn, "system", "Бросок не выполнен", `${selectedWeapon.name}: в исходном листе не указана формула урона.`), ...current]); return; }
    if (online) { dispatchOnline({ type: "declare_attack", weaponUid: selectedWeapon.uid, strikeMode: actionStrike, locationChoice: location, modifier, modifierNote }); return; }
    const extra = standardAttackComplete(attackTurn);
    const transition = declareTurnAttack(attackTurn, { strikeMode: actionStrike, extra }, fighters[active].sta);
    if (!transition.ok) {
      const detail = transition.code === "insufficient_stamina" ? "Для дополнительной атаки нужно 3 Выносливости." : "Эта атака не соответствует выбранной последовательности хода.";
      setLog((current) => [makeLog(round, turn, "system", "Атака недоступна", detail), ...current]);
      return;
    }
    let fightersForAttack = fighters;
    if (transition.staminaCost) {
      const updated = cloneFighters(fighters);
      const fighter = updated[active];
      const before = fighter.sta;
      fighter.sta = Math.max(0, fighter.sta - transition.staminaCost);
      fightersForAttack = updated;
      setFighters(updated);
      setLog((current) => [makeLog(round, turn, "system", `${fighter.name} проводит дополнительную атаку`, `Выносливость ${before} → ${fighter.sta}; штраф −3 к попаданию.`), ...current]);
    }
    setAttackTurn(transition.state);
    const result = resolveAttack({ fighters: fightersForAttack, attacker: active, weapon: selectedWeapon, defenseMode: defense, strikeMode: actionStrike, locationChoice: location, modifier: modifier + transition.hitModifier, settings, rng: rngRef.current });
    setPending(result);
    const totalModifier = result.attackModifier + result.aimedModifier;
    const systemPenalties = [actionStrike === "strong" ? "сильная −3" : "", extra ? "дополнительная −3" : ""].filter(Boolean).join(", ");
    setLog((current) => [makeLog(round, turn, "roll", `${fightersForAttack[result.attacker].name}: ${attackSequenceLabel(transition.state, actionStrike).toLowerCase()}`, `${result.attackRoll.text} + база ${result.attackBase}${totalModifier ? ` ${totalModifier >= 0 ? "+" : "−"} ${Math.abs(totalModifier)}` : ""} = ${result.attackTotal}; защита ${result.defenseTotal}.${systemPenalties ? ` Системные штрафы: ${systemPenalties}.` : ""}${modifierNote ? ` ${modifierNote}` : ""}`), ...current]);
  }

  function advanceLocal(nextFighters = fighters) {
    if (!nextFighters) return;
    const next: Side = active === 0 ? 1 : 0;
    setActive(next); setTurn((value) => value + 1); setAttackTurn(createAttackTurnState()); setPending(null); setAttackDeclaration(null); setWeaponUid(nextFighters[next].weapons[0]?.uid ?? ""); setModifier(0); setModifierNote(""); setLocation("random"); setStrike("normal");
    if (next === firstSide) setRound((value) => value + 1);
  }

  function applyPendingResult() {
    if (online) { dispatchOnline({ type: "apply_pending" }); return; }
    if (!fighters || !pending) return;
    const updated = cloneFighters(fighters);
    const target = updated[pending.defender];
    target.hp = Math.max(settings.stopAtZero ? 0 : -999, target.hp - pending.finalDamage);
    if (settings.armorAblation && pending.normalDamage > 0) target.armor[pending.location].sp = Math.max(target.armor[pending.location].natural, target.armor[pending.location].sp - 1);
    setFighters(updated);
    const critical = pending.criticalLevel ? ` ${pending.criticalLevel} критическое ранение: +${pending.criticalBonus} урона; конкретную рану выберите по книге.` : "";
    setLog((current) => [makeLog(round, turn, "damage", `${target.name} получает ${pending.finalDamage} урона`, `${LOCATION_LABELS[pending.location]} · ${pending.formula}.${critical}`), ...current]);
    if (strikeEndsBattle(fighters, updated, pending, attackTurn, settings, true)) { setPhase("complete"); setAttackTurn(createAttackTurnState()); setPending(null); return; }
    if (attackTurn.extraUsed) advanceLocal(updated);
    else { setPending(null); setModifier(0); setModifierNote(""); setLocation("random"); setStrike("normal"); }
  }

  function finishMiss() {
    if (online) { dispatchOnline({ type: "finish_miss" }); return; }
    if (!pending) return;
    setLog((current) => [makeLog(round, turn, "system", "Атака не попала", `Атака ${pending.attackTotal} против защиты ${pending.defenseTotal}.`), ...current]);
    if (fighters && strikeEndsBattle(fighters, fighters, pending, attackTurn, settings, false)) { setPhase("complete"); setAttackTurn(createAttackTurnState()); setPending(null); return; }
    if (attackTurn.extraUsed) advanceLocal();
    else { setPending(null); setModifier(0); setModifierNote(""); setLocation("random"); setStrike("normal"); }
  }

  function endCurrentTurn() {
    const options = attackTurnOptions(attackTurn, activeFighter?.sta ?? 0);
    if (!options.canEndTurn || pending || attackDeclaration) return;
    if (online) { dispatchOnline({ type: "end_turn" }); return; }
    if (!fighters) return;
    const detail = standardAttackComplete(attackTurn)
      ? "Основное атакующее действие завершено без дополнительной атаки."
      : "Вторая быстрая атака не использована.";
    setLog((current) => [makeLog(round, turn, "system", `${fighters[active].name} завершает ход`, detail), ...current]);
    advanceLocal();
  }

  function recoverOrPass(action: "recover" | "pass") {
    if (online) { dispatchOnline({ type: action }); return; }
    if (!fighters || attackTurn.standardMode !== null || pending || attackDeclaration) return;
    const updated = cloneFighters(fighters);
    const actor = updated[active];
    if (action === "recover") { const before = actor.sta; actor.sta = Math.min(actor.maxSta, actor.sta + actor.rec); setLog((current) => [makeLog(round, turn, "system", `${actor.name} восстанавливается`, `Выносливость ${before} → ${actor.sta}.`), ...current]); }
    else setLog((current) => [makeLog(round, turn, "system", `${actor.name} пропускает ход`, "Действий не совершено."), ...current]);
    setFighters(updated); advanceLocal(updated);
  }

  function resetLocalState() {
    setImports([null, null]); setPrepared([null, null]); setFighters(null); setPhase("setup"); setLog([]); setAttackTurn(createAttackTurnState()); setPending(null); setAttackDeclaration(null); setExportOpen(false); setRevision(0);
    snapshotRef.current = null; committingRevisionRef.current = null; seenRequestIdsRef.current.clear(); setGuestSynced(false);
  }

  function newBattle() {
    if (phase !== "setup" && !window.confirm("Текущий бой будет сброшен. Экспортируйте журнал заранее, если он нужен.")) return;
    if (session.kind === "host") dispatchOnline({ type: "reset_room" });
    else if (session.kind === "guest") leaveOnline();
    else resetLocalState();
  }

  function resumeAfterZero() {
    if (online) { dispatchOnline({ type: "continue_battle" }); return; }
    setPhase("combat"); setLog((current) => [makeLog(round, turn, "system", "Бой продолжен вручную", "Порог завершения проигнорирован ведущим."), ...current]); advanceLocal();
  }

  function updateSettings(next: CombatSettings) {
    if (session.kind === "host") dispatchOnline({ type: "set_settings", settings: next });
    else setSettings(next);
  }

  function enterOnlineMenu() { if (phase !== "setup") return; resetLocalState(); setSession({ kind: "online-menu" }); setNetworkStatus("idle"); window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); }
  function enterLocalMode() { resetLocalState(); setSession({ kind: "local" }); setNetworkStatus("idle"); window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); }
  function createOnline() {
    resetLocalState();
    const code = createRoomCode(); setJoinCode(code); setSession({ kind: "host", code });
    setPlayers([{ side: 0, connected: true, ready: false }, { side: 1, connected: false, ready: false }]);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#join=${code}`);
  }
  function joinOnline() {
    const code = normalizeRoomCode(joinCode);
    if (code.length !== 16) return;
    resetLocalState(); setSession({ kind: "guest", code });
    setPlayers([{ side: 0, connected: false, ready: false }, { side: 1, connected: true, ready: false }]);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#join=${code}`);
  }
  function leaveOnline() { peerRef.current?.destroy(); resetLocalState(); setSession({ kind: "local" }); setNetworkStatus("idle"); setNetworkError(""); window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); }
  async function copyInvite() { if (!online) return; await navigator.clipboard.writeText(inviteUrl(session.code, window.location)); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }

  const setupReady = prepared[0] !== null && prepared[1] !== null && (!online || networkStatus === "connected");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i>DL</i></span><div><span className="eyebrow">Настольный помощник</span><h1>Duel Ledger</h1><p>Симулятор PvP для использования с The Witcher TRPG</p></div></div>
        <div className="top-actions"><StatusPill phase={phase} />{session.kind !== "guest" && <button className="button button-quiet" type="button" onClick={() => setSettingsOpen(true)}>⚙ Настройки</button>}{fighters && <button className="button button-quiet" type="button" onClick={() => setExportOpen(true)}>↧ Экспорт</button>}<button className="button button-ghost" type="button" onClick={newBattle}>{session.kind === "guest" ? "Покинуть комнату" : "Новый бой"}</button></div>
      </header>

      {phase === "setup" ? (
        <section className="setup-screen">
          <div className="intro-copy"><span className="eyebrow">Листы против кубов</span><h2>Каждый управляет<br />своим персонажем.</h2><p>Играйте на одном экране или создайте онлайн-комнату для двух устройств.</p></div>
          <div className="mode-switch" role="group" aria-label="Режим боя"><button className={session.kind === "local" ? "active" : ""} type="button" onClick={enterLocalMode}>На одном экране</button><button className={session.kind !== "local" ? "active" : ""} type="button" onClick={enterOnlineMenu}>Онлайн с другом</button></div>
          {session.kind === "online-menu" && <OnlineMenu joinCode={joinCode} onJoinCode={setJoinCode} onCreate={createOnline} onJoin={joinOnline} />}
          {online && <ConnectionBar role={session.kind} code={session.code} status={networkStatus} error={networkError} copied={copied} onCopy={() => void copyInvite()} onRetry={() => setReconnectKey((value) => value + 1)} />}
          {session.kind !== "online-menu" && <>
            <div className="import-grid">
              {online && ownSide !== 0 ? <RemoteFighterCard fighter={prepared[0]} side={0} connected={networkStatus === "connected"} /> : <ImportCard side={0} result={imports[0]} onImport={importResult} onDemo={loadDemo} />}
              {!online && <button className="swap-button" type="button" onClick={swapImports} aria-label="Поменять бойцов местами">⇄<span>Поменять</span></button>}
              {online && <span className="versus-seal" aria-hidden="true">VS</span>}
              {online && ownSide !== 1 ? <RemoteFighterCard fighter={prepared[1]} side={1} connected={networkStatus === "connected"} /> : session.kind === "guest" && !guestSynced ? <UploadWaitingCard side={1} /> : <ImportCard side={1} result={imports[1]} onImport={importResult} onDemo={loadDemo} />}
            </div>
            {(session.kind === "local" || session.kind === "host") && <button className="button button-start" disabled={!setupReady} type="button" onClick={beginCombat}>{online ? "Начать онлайн-бой" : "Начать бой"} <span aria-hidden="true">→</span></button>}
            {session.kind === "guest" && <p className="guest-wait-note">{prepared[1] ? "Персонаж готов. Владелец комнаты начнёт бой." : "Загрузите персонажа B — только его боевые показатели увидит соперник."}</p>}
            <div className="privacy-note"><span aria-hidden="true">⌂</span><div><b>{online ? "Прямое защищённое соединение" : "Локальная обработка"}</b><p>{online ? "Полный файл остаётся у владельца. Сопернику передаются имя, характеристики, навыки, оружие, броня, ресурсы и предупреждения импорта. Биография, деньги и заметки не передаются; сервер используется лишь для установления связи." : "Файлы обрабатываются только в этом браузере и никуда не отправляются."}</p></div></div>
          </>}
        </section>
      ) : fighters ? (
        <>
          {online && <ConnectionBar role={session.kind as "host" | "guest"} code={session.code} status={networkStatus} error={networkError} copied={copied} onCopy={() => void copyInvite()} onRetry={() => setReconnectKey((value) => value + 1)} />}
          <nav className="combat-strip" aria-label="Состояние боя"><span><small>Раунд</small><b>{round}</b></span><span><small>Ход</small><b>{fighters[active].name}</b></span><div className="initiative-line"><small>Инициатива</small>{([0, 1] as Side[]).sort((a, b) => initiative[b] - initiative[a]).map((side) => <span className={side === active ? "initiative-active" : ""} key={side}>{fighters[side].name} <b>{initiative[side]}</b></span>)}</div></nav>
          <section className="combat-grid">
            <FighterCard fighter={fighters[0]} side={0} active={active === 0 && phase === "combat"} owned={!online || ownSide === 0} />
            <section className="action-panel" aria-live="polite">
              {phase === "complete" ? (
                <div className="victory-card"><span className="victory-rune" aria-hidden="true">✦</span><span className="eyebrow">Поединок завершён</span><h2>{draw ? "Ничья" : <>Побеждает<br />{winnerName}</>}</h2><p>{draw ? "Оба бойца больше не могут продолжать бой." : `${defeated?.name} больше не может продолжать бой.`}</p><div className="victory-stats"><span><b>{round}</b> раундов</span><span><b>{Math.max(0, log.filter((entry) => entry.type === "roll").length - 1)}</b> атак</span></div><button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>Экспортировать результат</button>{(!online || session.kind === "host") ? <button className="text-button" type="button" onClick={resumeAfterZero}>Продолжить по решению ведущего</button> : <p className="wait-inline">Владелец комнаты решает, продолжать ли бой.</p>}</div>
              ) : attackDeclaration ? (
                canDefend ? <div className="defense-card"><span className="defense-rune" aria-hidden="true">◇</span><span className="eyebrow">{currentAttackLabel ?? "Вас атакуют"}</span><h2>Выберите защиту</h2><p>{fighters[attackDeclaration.attacker].name} объявляет атаку{attackDeclaration.extra ? ` за 3 Выносливости со штрафом −3${attackDeclaration.strikeMode === "strong" ? " (−6 вместе со штрафом сильной атаки)" : ""}` : ""}. Бросок произойдёт после вашего ответа.</p><label><span>Способ защиты</span><select value={defense} onChange={(event) => setDefense(event.target.value as DefenseMode)}><option value="dodge">Уклониться</option><option value="reposition">Изменить позицию</option><option value="block">Блокировать</option><option value="none">Не защищаться (СЛ 10)</option></select></label><button className="button button-roll" type="button" onClick={() => dispatchOnline({ type: "choose_defense", defenseMode: defense })}>Подтвердить защиту</button></div>
                  : <WaitingAction title="Соперник выбирает защиту" detail="Объявленная атака уже передана. Результат появится на обоих устройствах." />
              ) : pending ? (
                <div className={`result-card ${pending.hit ? "result-hit" : "result-miss"}`}>
                  <span className="result-symbol" aria-hidden="true">{pending.hit ? "✦" : "◇"}</span><span className="eyebrow">{currentAttackLabel ?? "Результат броска"}</span><h2>{pending.hit ? "Попадание" : "Промах"}</h2>
                  <div className="versus-result"><span><small>Атака</small><b>{pending.attackTotal}</b></span><i>против</i><span><small>Защита</small><b>{pending.defenseTotal}</b></span></div>
                  {pending.hit && <><div className="result-summary"><span><small>Зона</small><b>{LOCATION_LABELS[pending.location]}</b></span><span><small>Урон</small><b>{pending.finalDamage}</b></span><span><small>Броня</small><b>{pending.armorSp}</b></span></div><code className="formula">{pending.formula}</code>{pending.criticalLevel && <p className="critical-note">⚠ {pending.criticalLevel} критическое ранение. Конкретный эффект выберите по таблице вашей книги.</p>}</>}
                  <div className="result-buttons">{canAct ? (pending.hit ? <button className="button button-primary" type="button" onClick={applyPendingResult}>Применить результат</button> : <button className="button button-primary" type="button" onClick={finishMiss}>Подтвердить промах</button>) : <p className="wait-inline">Активный игрок подтверждает результат.</p>}</div>
                </div>
              ) : canAct ? (
                <><div className="action-heading"><span className="eyebrow">Конструктор действия</span><h2>Ваш ход: {activeFighter?.name}</h2><p>{online ? "Выберите атаку — соперник сам укажет способ защиты." : "Атака рассчитывается сейчас, урон применяется после подтверждения."}</p></div>
                  <div className="action-form">
                    <div className={`turn-sequence ${choosingExtra ? "turn-sequence-extra" : ""}`} role="status"><b>{secondFast ? "Быстрая атака 2 из 2" : choosingExtra ? "Основное действие завершено" : "Основное действие"}</b><span>{secondFast ? "Вторая атака также должна быть быстрой." : choosingExtra ? "Можно завершить ход или купить одну дополнительную атаку." : "Выберите две быстрые атаки либо одну сильную."}</span></div>
                    <label><span>Оружие</span><select value={weaponUid} onChange={(event) => setWeaponUid(event.target.value)}>{activeFighter?.weapons.map((weapon) => <option value={weapon.uid} key={weapon.uid}>{weapon.name} · {weapon.damage || "урон не указан"}</option>)}</select></label>
                    <div className="two-columns"><label><span>{choosingExtra ? "Дополнительная атака" : "Тип удара"}</span><select value={actionStrike} disabled={secondFast} onChange={(event) => setStrike(event.target.value as StrikeMode)}><option value="normal">{secondFast ? "Быстрая 2 из 2" : choosingExtra ? "Быстрая (−3, 3 Вын)" : "Быстрая (до 2 за ход)"}</option>{!secondFast && <option value="strong">{choosingExtra ? "Сильная (−6, 3 Вын, урон ×2)" : "Сильная (−3, урон ×2)"}</option>}</select></label>{!online && <label><span>Защита цели</span><select value={defense} onChange={(event) => setDefense(event.target.value as DefenseMode)}><option value="dodge">Уклониться</option><option value="reposition">Изменить позицию</option><option value="block">Блокировать</option><option value="none">Не защищаться (СЛ 10)</option></select></label>}</div>
                    <label><span>Зона попадания</span><select value={location} onChange={(event) => setLocation(event.target.value as LocationKey | "random")}><option value="random">Определить броском</option><option value="head">Голова ({AIM_MODIFIERS.head})</option><option value="torso">Туловище ({AIM_MODIFIERS.torso})</option><option value="arms">Рука ({AIM_MODIFIERS.arms})</option><option value="legs">Нога ({AIM_MODIFIERS.legs})</option></select></label>
                    <div className="modifier-row"><label><span>Модификатор</span><input type="number" value={modifier} onChange={(event) => setModifier(Number(event.target.value))} /></label><label><span>Причина</span><input value={modifierNote} onChange={(event) => setModifierNote(event.target.value)} placeholder="Свет, дистанция, эффект…" /></label></div>
                    {choosingExtra && !selectedExtraAvailable && <p className="attack-unavailable" role="status">Для дополнительной атаки нужно 3 Выносливости.</p>}
                    <button className="button button-roll" disabled={choosingExtra && !selectedExtraAvailable} type="button" onClick={rollOrDeclareAttack}><span aria-hidden="true">◆</span> {rollButtonLabel}</button>
                    {turnOptions.canEndTurn && <button className="button button-end-turn" type="button" onClick={endCurrentTurn}>Завершить ход без {choosingExtra ? "дополнительной атаки" : "второй быстрой"}</button>}
                    {attackTurn.standardMode === null && <div className="secondary-actions"><button type="button" onClick={() => recoverOrPass("recover")}>Восстановить {activeFighter?.rec} Вын</button><button type="button" onClick={() => recoverOrPass("pass")}>Пропустить ход</button></div>}
                  </div></>
              ) : <WaitingAction title={connected ? "Ход соперника" : "Связь с соперником прервана"} detail={connected ? `${fighters[active].name} выбирает действие на другом устройстве.` : "Бой приостановлен. Подключитесь снова, чтобы получить актуальное состояние."} />}
            </section>
            <FighterCard fighter={fighters[1]} side={1} active={active === 1 && phase === "combat"} owned={!online || ownSide === 1} />
          </section>
          <section className="log-panel"><header><div><span className="eyebrow">Протокол</span><h2>Журнал боя</h2></div><div className="log-filters" role="group" aria-label="Фильтр журнала">{([['all','Все'],['roll','Броски'],['damage','Урон'],['system','События']] as const).map(([key, label]) => <button className={logFilter === key ? "active" : ""} type="button" key={key} onClick={() => setLogFilter(key)}>{label}</button>)}</div></header><div className="log-list">{filteredLog.map((entry) => <article key={entry.id}><span className={`log-icon log-${entry.type}`} aria-hidden="true">{entry.type === "damage" ? "✦" : entry.type === "roll" ? "◆" : "·"}</span><div><small>Раунд {entry.round} · {formatTime(entry.createdAt)}</small><h3>{entry.title}</h3><p>{entry.detail}</p></div></article>)}</div></section>
        </>
      ) : null}

      <footer className="site-footer"><p>Duel Ledger — бесплатный неофициальный помощник. Не заменяет книгу правил.</p><p>This is unofficial content provided under the Homebrew Content Policy of R. Talsorian Games and is not approved or endorsed by RTG. The Witcher is property of CD PROJEKT RED and Andrzej Sapkowski.</p></footer>
      {settingsOpen && <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />}
      {exportOpen && fighters && <ExportPanel fighters={fighters} settings={settings} log={log} round={round} ownedSources={ownedSources} onClose={() => setExportOpen(false)} />}
    </main>
  );
}
