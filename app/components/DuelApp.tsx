"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import {
  AIM_MODIFIERS, CombatSettings, DefenseMode, LogEntry, PendingAttack, StrikeMode,
  createRng, d10, makeLog, resolveAttack,
} from "../lib/combat";
import {
  Fighter, LOCATION_LABELS, LocationKey, PROFESSION_LABELS, RACE_LABELS, RawCharacter,
  STAT_KEYS, buildFighter, characterLabel, demoCharacter, parseWitcherFile,
  patchRawCharacter, skillLabel,
} from "../lib/witcher";

type Side = 0 | 1;
type Phase = "setup" | "combat" | "complete";
type ImportResult = { character: RawCharacter; warnings: string[]; importedFields: number };

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

function FighterCard({ fighter, side, active }: { fighter: Fighter; side: Side; active: boolean }) {
  const lowHp = fighter.hp > 0 && fighter.hp <= Math.floor(fighter.maxHp / 5);
  const state = fighter.hp <= 0 ? "Побеждён" : fighter.sta <= 0 ? "Без сознания" : lowHp ? "Тяжело ранен" : active ? "Ходит" : "Готов";
  const relevantSkills = ["swordsmanship", "small_blades", "staff_spear", "melee", "brawling", "archery", "crossbow", "athletics", "dodge_escape"];
  return (
    <article className={`fighter-card side-${side} ${active ? "fighter-active" : ""}`}>
      <header className="fighter-head">
        <span className="monogram">{initials(fighter.name)}</span>
        <div className="fighter-title"><span className="eyebrow">Боец {side === 0 ? "A" : "B"}</span><h2>{fighter.name}</h2><p>{RACE_LABELS[fighter.race] ?? fighter.race} · {PROFESSION_LABELS[fighter.profession] ?? fighter.profession}</p></div>
        <span className={`fighter-state ${fighter.hp <= 0 ? "state-danger" : ""}`}>{state}</span>
      </header>
      <div className="resource-stack"><Meter label="Здоровье" value={fighter.hp} max={fighter.maxHp} danger={lowHp || fighter.hp <= 0} /><Meter label="Выносливость" value={fighter.sta} max={fighter.maxSta} /></div>
      <div className="derived-grid"><span><b>{fighter.stun}</b> Оглушение</span><span><b>{fighter.rec}</b> Восстановление</span><span><b>{fighter.run}</b> Бег</span><span><b>{fighter.leap}</b> Прыжок</span></div>
      <section className="armor-block">
        <div className="section-title"><h3>Защита</h3><span>ПБ</span></div>
        {Object.entries(fighter.armor).map(([key, zone]) => <div className="armor-row" key={key}><span>{LOCATION_LABELS[key as LocationKey]}</span><strong>{zone.sp}</strong><small>{zone.sp < zone.originalSp ? `−${zone.originalSp - zone.sp}` : zone.source}</small></div>)}
      </section>
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

function ExportPanel({ fighters, settings, log, round, onClose }: { fighters: [Fighter, Fighter]; settings: CombatSettings; log: LogEntry[]; round: number; onClose: () => void }) {
  function exportBattle() {
    download(`${slug(fighters[0].name)}-vs-${slug(fighters[1].name)}.duel.json`, JSON.stringify({ kind: "duel-ledger", version: 1, exportedAt: new Date().toISOString(), settings, round, fighters: fighters.map((fighter) => ({ source: fighter.raw, final: { hp: fighter.hp, sta: fighter.sta, armor: fighter.armor } })), log }, null, 2));
  }
  function exportMarkdown() {
    const lines = [`# ${fighters[0].name} против ${fighters[1].name}`, "", `Раундов: ${round}`, `Seed: ${settings.seed}`, "", `Итог: ${fighters[0].name} — ${fighters[0].hp}/${fighters[0].maxHp} ПЗ; ${fighters[1].name} — ${fighters[1].hp}/${fighters[1].maxHp} ПЗ`, "", "## Журнал", "", ...log.map((entry) => `- **Раунд ${entry.round}.** ${entry.title} — ${entry.detail}`)];
    download(`${slug(fighters[0].name)}-vs-${slug(fighters[1].name)}.md`, lines.join("\n"), "text/markdown");
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel export-panel" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header><div><span className="eyebrow">Результат</span><h2 id="export-title">Экспорт боя</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
        <button className="export-option" type="button" onClick={exportBattle}><b>Скачать бой .json</b><small>Исходные листы, настройки, seed, журнал и финальное состояние</small><span>↧</span></button>
        <button className="export-option" type="button" onClick={exportMarkdown}><b>Скачать отчёт .md</b><small>Читаемый протокол для заметок кампании</small><span>↧</span></button>
        <button className="export-option" type="button" onClick={() => download("witcher-characters-after-duel.json", JSON.stringify(fighters.map(patchRawCharacter), null, 2))}><b>Скачать обновлённых персонажей</b><small>Импортируемый массив с новыми текущими ПЗ и Выносливостью; зональная абляция остаётся в журнале</small><span>↧</span></button>
      </aside>
    </div>
  );
}

export default function DuelApp() {
  const [imports, setImports] = useState<[ImportResult | null, ImportResult | null]>([null, null]);
  const [fighters, setFighters] = useState<[Fighter, Fighter] | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [settings, setSettings] = useState<CombatSettings>(SETTINGS_DEFAULT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [active, setActive] = useState<Side>(0);
  const [initiative, setInitiative] = useState<[number, number]>([0, 0]);
  const [round, setRound] = useState(1);
  const [turn, setTurn] = useState(1);
  const [weaponUid, setWeaponUid] = useState("");
  const [defense, setDefense] = useState<DefenseMode>("dodge");
  const [strike, setStrike] = useState<StrikeMode>("normal");
  const [location, setLocation] = useState<LocationKey | "random">("random");
  const [modifier, setModifier] = useState(0);
  const [modifierNote, setModifierNote] = useState("");
  const [pending, setPending] = useState<PendingAttack | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | LogEntry["type"]>("all");
  const rngRef = useRef<() => number>(createRng(settings.seed));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try { setSettings({ ...SETTINGS_DEFAULT, ...JSON.parse(saved) }); } catch { /* ignore invalid preference */ }
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);

  const activeFighter = fighters?.[active] ?? null;
  const selectedWeapon = activeFighter?.weapons.find((weapon) => weapon.uid === weaponUid) ?? activeFighter?.weapons[0] ?? null;
  const filteredLog = logFilter === "all" ? log : log.filter((entry) => entry.type === logFilter);
  const defeated = fighters?.find((fighter) => fighter.hp <= 0 || fighter.sta <= 0) ?? null;
  const winnerName = defeated && fighters ? fighters.find((fighter) => fighter.id !== defeated.id)?.name : null;

  function importResult(side: Side, result: ImportResult) { setImports((current) => side === 0 ? [result, current[1]] : [current[0], result]); }
  function loadDemo(side: Side) { importResult(side, parseWitcherFile(demoCharacter(side === 0 ? "a" : "b"))[0]); }
  function swapImports() { setImports(([first, second]) => [second, first]); }

  function beginCombat() {
    if (!imports[0] || !imports[1]) return;
    const built: [Fighter, Fighter] = [buildFighter(imports[0].character, imports[0].warnings), buildFighter(imports[1].character, imports[1].warnings)];
    rngRef.current = createRng(settings.seed);
    const rolls = [d10(rngRef.current, settings.explodingDice), d10(rngRef.current, settings.explodingDice)] as const;
    const values: [number, number] = [built[0].initiativeBase + rolls[0].total, built[1].initiativeBase + rolls[1].total];
    const firstSide: Side = values[0] === values[1] ? (built[0].initiativeBase >= built[1].initiativeBase ? 0 : 1) : values[0] > values[1] ? 0 : 1;
    setFighters(built); setInitiative(values); setActive(firstSide); setWeaponUid(built[firstSide].weapons[0].uid); setPhase("combat"); setRound(1); setTurn(1); setPending(null);
    setLog([makeLog(1, 0, "system", "Бой начался", `${built[0].name} против ${built[1].name}. Seed ${settings.seed}.`), makeLog(1, 0, "roll", "Инициатива", `${built[0].name}: ${values[0]} (${rolls[0].text}); ${built[1].name}: ${values[1]} (${rolls[1].text}).`)]);
  }

  function rollAttack() {
    if (!fighters || !selectedWeapon || pending) return;
    if (!selectedWeapon.damage.trim()) {
      setLog((current) => [makeLog(round, turn, "system", "Бросок не выполнен", `${selectedWeapon.name}: в исходном листе не указана формула урона.`), ...current]);
      return;
    }
    const result = resolveAttack({ fighters, attacker: active, weapon: selectedWeapon, defenseMode: defense, strikeMode: strike, locationChoice: location, modifier, settings, rng: rngRef.current });
    setPending(result);
    const totalModifier = result.attackModifier + result.aimedModifier;
    setLog((current) => [makeLog(round, turn, "roll", `${fighters[result.attacker].name} атакует ${fighters[result.defender].name}`, `${result.attackRoll.text} + база ${result.attackBase}${totalModifier ? ` ${totalModifier >= 0 ? "+" : "−"} ${Math.abs(totalModifier)}` : ""} = ${result.attackTotal}; защита ${result.defenseTotal}.${modifierNote ? ` ${modifierNote}` : ""}`), ...current]);
  }

  function advanceTurn(nextFighters = fighters) {
    if (!nextFighters) return;
    const next: Side = active === 0 ? 1 : 0;
    const orderedFirst: Side = initiative[0] >= initiative[1] ? 0 : 1;
    setActive(next); setTurn((value) => value + 1); setPending(null); setWeaponUid(nextFighters[next].weapons[0].uid); setModifier(0); setModifierNote(""); setLocation("random"); setStrike("normal");
    if (next === orderedFirst) setRound((value) => value + 1);
  }

  function applyPending() {
    if (!fighters || !pending) return;
    const updated = fighters.map((fighter) => ({ ...fighter, armor: Object.fromEntries(Object.entries(fighter.armor).map(([key, zone]) => [key, { ...zone }])) as Fighter["armor"] })) as [Fighter, Fighter];
    const target = updated[pending.defender];
    target.hp = Math.max(settings.stopAtZero ? 0 : -999, target.hp - pending.finalDamage);
    if (settings.armorAblation && pending.normalDamage > 0) target.armor[pending.location].sp = Math.max(target.armor[pending.location].natural, target.armor[pending.location].sp - 1);
    setFighters(updated);
    const critical = pending.criticalLevel ? ` ${pending.criticalLevel} критическое ранение: +${pending.criticalBonus} урона; конкретную рану выберите по книге.` : "";
    setLog((current) => [makeLog(round, turn, "damage", `${target.name} получает ${pending.finalDamage} урона`, `${LOCATION_LABELS[pending.location]} · ${pending.formula}.${critical}`), ...current]);
    if ((settings.stopAtZero && target.hp <= 0) || target.sta <= 0) { setPhase("complete"); setPending(null); return; }
    advanceTurn(updated);
  }

  function missAndAdvance() {
    if (!pending) return;
    setLog((current) => [makeLog(round, turn, "system", "Атака не попала", `Атака ${pending.attackTotal} против защиты ${pending.defenseTotal}.`), ...current]);
    advanceTurn();
  }

  function recoverOrPass(action: "recover" | "pass") {
    if (!fighters) return;
    const updated = fighters.map((fighter) => ({ ...fighter })) as [Fighter, Fighter];
    const actor = updated[active];
    if (action === "recover") { const before = actor.sta; actor.sta = Math.min(actor.maxSta, actor.sta + actor.rec); setLog((current) => [makeLog(round, turn, "system", `${actor.name} восстанавливается`, `Выносливость ${before} → ${actor.sta}.`), ...current]); }
    else setLog((current) => [makeLog(round, turn, "system", `${actor.name} пропускает ход`, "Действий не совершено."), ...current]);
    setFighters(updated); advanceTurn(updated);
  }

  function newBattle() {
    if (phase !== "setup" && !window.confirm("Текущий бой будет сброшен. Экспортируйте журнал заранее, если он нужен.")) return;
    setImports([null, null]); setFighters(null); setPhase("setup"); setLog([]); setPending(null); setExportOpen(false);
  }

  function resumeAfterZero() {
    setPhase("combat"); setLog((current) => [makeLog(round, turn, "system", "Бой продолжен вручную", "Порог завершения проигнорирован ведущим."), ...current]); advanceTurn();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i>DL</i></span><div><span className="eyebrow">Настольный помощник</span><h1>Duel Ledger</h1><p>Симулятор PvP для использования с The Witcher TRPG</p></div></div>
        <div className="top-actions"><StatusPill phase={phase} /><button className="button button-quiet" type="button" onClick={() => setSettingsOpen(true)}>⚙ Настройки</button>{fighters && <button className="button button-quiet" type="button" onClick={() => setExportOpen(true)}>↧ Экспорт</button>}<button className="button button-ghost" type="button" onClick={newBattle}>Новый бой</button></div>
      </header>

      {phase === "setup" ? (
        <section className="setup-screen">
          <div className="intro-copy"><span className="eyebrow">Листы против кубов</span><h2>Загрузите двух персонажей.<br />Остальное запишет журнал.</h2><p>Файлы обрабатываются только в вашем браузере. Никаких аккаунтов, облака или отправки листов на сервер.</p></div>
          <div className="import-grid"><ImportCard side={0} result={imports[0]} onImport={importResult} onDemo={loadDemo} /><button className="swap-button" type="button" onClick={swapImports} aria-label="Поменять бойцов местами">⇄<span>Поменять</span></button><ImportCard side={1} result={imports[1]} onImport={importResult} onDemo={loadDemo} /></div>
          <button className="button button-start" disabled={!imports[0] || !imports[1]} type="button" onClick={beginCombat}>Начать бой <span aria-hidden="true">→</span></button>
          <div className="privacy-note"><span aria-hidden="true">⌂</span><div><b>Локальная обработка</b><p>В импорт могут входить поля, которые пока не участвуют в бою. Исходный объект сохраняется в экспортируемом журнале без отправки наружу.</p></div></div>
        </section>
      ) : fighters ? (
        <>
          <nav className="combat-strip" aria-label="Состояние боя"><span><small>Раунд</small><b>{round}</b></span><span><small>Ход</small><b>{fighters[active].name}</b></span><div className="initiative-line"><small>Инициатива</small>{([0, 1] as Side[]).sort((a, b) => initiative[b] - initiative[a]).map((side) => <span className={side === active ? "initiative-active" : ""} key={side}>{fighters[side].name} <b>{initiative[side]}</b></span>)}</div></nav>
          <section className="combat-grid">
            <FighterCard fighter={fighters[0]} side={0} active={active === 0 && phase === "combat"} />
            <section className="action-panel" aria-live="polite">
              {phase === "complete" ? (
                <div className="victory-card"><span className="victory-rune" aria-hidden="true">✦</span><span className="eyebrow">Поединок завершён</span><h2>Побеждает<br />{winnerName}</h2><p>{defeated?.name} больше не может продолжать бой.</p><div className="victory-stats"><span><b>{round}</b> раундов</span><span><b>{Math.max(0, log.filter((entry) => entry.type === "roll").length - 1)}</b> атак</span></div><button className="button button-primary" type="button" onClick={() => setExportOpen(true)}>Экспортировать результат</button><button className="text-button" type="button" onClick={resumeAfterZero}>Продолжить по решению ведущего</button></div>
              ) : (
                <><div className="action-heading"><span className="eyebrow">Конструктор действия</span><h2>Ход: {activeFighter?.name}</h2><p>Атака рассчитывается сейчас, урон применяется после подтверждения.</p></div>
                  {!pending ? <div className="action-form">
                    <label><span>Оружие</span><select value={weaponUid} onChange={(event) => setWeaponUid(event.target.value)}>{activeFighter?.weapons.map((weapon) => <option value={weapon.uid} key={weapon.uid}>{weapon.name} · {weapon.damage}</option>)}</select></label>
                    <div className="two-columns"><label><span>Тип удара</span><select value={strike} onChange={(event) => setStrike(event.target.value as StrikeMode)}><option value="normal">Обычный</option><option value="strong">Сильный (−3, урон ×2)</option></select></label><label><span>Защита цели</span><select value={defense} onChange={(event) => setDefense(event.target.value as DefenseMode)}><option value="dodge">Уклониться</option><option value="reposition">Изменить позицию</option><option value="block">Блокировать</option><option value="none">Не защищаться (СЛ 10)</option></select></label></div>
                    <label><span>Зона попадания</span><select value={location} onChange={(event) => setLocation(event.target.value as LocationKey | "random")}><option value="random">Определить броском</option><option value="head">Голова ({AIM_MODIFIERS.head})</option><option value="torso">Туловище ({AIM_MODIFIERS.torso})</option><option value="arms">Рука ({AIM_MODIFIERS.arms})</option><option value="legs">Нога ({AIM_MODIFIERS.legs})</option></select></label>
                    <div className="modifier-row"><label><span>Модификатор</span><input type="number" value={modifier} onChange={(event) => setModifier(Number(event.target.value))} /></label><label><span>Причина</span><input value={modifierNote} onChange={(event) => setModifierNote(event.target.value)} placeholder="Свет, дистанция, эффект…" /></label></div>
                    <button className="button button-roll" type="button" onClick={rollAttack}><span aria-hidden="true">◆</span> Бросить атаку</button><div className="secondary-actions"><button type="button" onClick={() => recoverOrPass("recover")}>Восстановить {activeFighter?.rec} Вын</button><button type="button" onClick={() => recoverOrPass("pass")}>Пропустить ход</button></div>
                  </div> : <div className={`result-card ${pending.hit ? "result-hit" : "result-miss"}`}>
                    <span className="result-symbol" aria-hidden="true">{pending.hit ? "✦" : "◇"}</span><span className="eyebrow">Результат броска</span><h2>{pending.hit ? "Попадание" : "Промах"}</h2>
                    <div className="versus-result"><span><small>Атака</small><b>{pending.attackTotal}</b></span><i>против</i><span><small>Защита</small><b>{pending.defenseTotal}</b></span></div>
                    {pending.hit && <><div className="result-summary"><span><small>Зона</small><b>{LOCATION_LABELS[pending.location]}</b></span><span><small>Урон</small><b>{pending.finalDamage}</b></span><span><small>Броня</small><b>{pending.armorSp}</b></span></div><code className="formula">{pending.formula}</code>{pending.criticalLevel && <p className="critical-note">⚠ {pending.criticalLevel} критическое ранение. Конкретный эффект выберите по таблице вашей книги.</p>}</>}
                    <div className="result-buttons">{pending.hit ? <button className="button button-primary" type="button" onClick={applyPending}>Применить результат</button> : <button className="button button-primary" type="button" onClick={missAndAdvance}>Завершить ход</button>}<button className="button button-quiet" type="button" onClick={() => setPending(null)}>Отменить бросок</button></div>
                  </div>}
                </>
              )}
            </section>
            <FighterCard fighter={fighters[1]} side={1} active={active === 1 && phase === "combat"} />
          </section>
          <section className="log-panel"><header><div><span className="eyebrow">Протокол</span><h2>Журнал боя</h2></div><div className="log-filters" role="group" aria-label="Фильтр журнала">{([['all','Все'],['roll','Броски'],['damage','Урон'],['system','События']] as const).map(([key, label]) => <button className={logFilter === key ? "active" : ""} type="button" key={key} onClick={() => setLogFilter(key)}>{label}</button>)}</div></header><div className="log-list">{filteredLog.map((entry) => <article key={entry.id}><span className={`log-icon log-${entry.type}`} aria-hidden="true">{entry.type === "damage" ? "✦" : entry.type === "roll" ? "◆" : "·"}</span><div><small>Раунд {entry.round} · {formatTime(entry.createdAt)}</small><h3>{entry.title}</h3><p>{entry.detail}</p></div></article>)}</div></section>
        </>
      ) : null}

      <footer className="site-footer"><p>Duel Ledger — бесплатный неофициальный помощник. Не заменяет книгу правил.</p><p>This is unofficial content provided under the Homebrew Content Policy of R. Talsorian Games and is not approved or endorsed by RTG. The Witcher is property of CD PROJEKT RED and Andrzej Sapkowski.</p></footer>
      {settingsOpen && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />}
      {exportOpen && fighters && <ExportPanel fighters={fighters} settings={settings} log={log} round={round} onClose={() => setExportOpen(false)} />}
    </main>
  );
}
