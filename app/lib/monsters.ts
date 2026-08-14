import type { DefenseMode, StrikeMode } from "./combat";
import type { FighterMagicRef, LocationKey, PreparedFighter, StatKey, Weapon } from "./witcher";

/** Broad encounter bands rather than reproduced bestiary difficulty values. */
export type MonsterThreat = "minor" | "standard" | "dangerous" | "boss";
export type MonsterRole = "brute" | "skirmisher" | "ambusher" | "controller" | "artillery" | "guardian";
export type DistanceBand = "engaged" | "near" | "far" | "distant";
export type DamageType = "slashing" | "piercing" | "bludgeoning" | "fire" | "frost" | "poison" | "acid" | "silver" | "magic";
export type MonsterCondition =
  | "bleeding"
  | "blinded"
  | "burning"
  | "disarmed"
  | "frightened"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious"
  | "weakened";
export type MonsterResource = "stamina" | "vigor" | "resolve";

export const MONSTER_THREAT_LABELS: Readonly<Record<MonsterThreat, string>> = {
  minor: "Низкая",
  standard: "Обычная",
  dangerous: "Высокая",
  boss: "Предельная",
};

export const DISTANCE_BANDS: Readonly<Record<DistanceBand, { min: number; max: number | null; label: string }>> = {
  engaged: { min: 0, max: 2, label: "Вплотную" },
  near: { min: 2, max: 10, label: "Близко" },
  far: { min: 10, max: 30, label: "Далеко" },
  distant: { min: 30, max: null, label: "Очень далеко" },
};

export type MonsterTrait = Readonly<{
  id: string;
  name: string;
  description: string;
  tags: readonly ("mobility" | "senses" | "defense" | "offense" | "control" | "survival")[];
}>;

export type DamageAffinity = Readonly<{
  type: DamageType;
  /** Suggested final-damage multiplier; the combat host decides when to apply it. */
  multiplier: number;
  note: string;
}>;

export type MonsterSpecialAction = Readonly<{
  id: string;
  name: string;
  kind: "attack" | "control" | "mobility" | "defense" | "recovery";
  description: string;
  range: readonly DistanceBand[];
  cost?: Readonly<{ resource: MonsterResource; amount: number }>;
  cooldown: number;
  hitModifier?: number;
  damageType?: DamageType;
  weaponId?: string;
  inflicts?: readonly MonsterCondition[];
  removes?: readonly MonsterCondition[];
  aiWeight: number;
}>;

type MonsterWeaponTemplate = Readonly<{
  id: string;
  name: string;
  category: string;
  damage: string;
  accuracy: number;
  attackSkill: string;
  damageType: DamageType;
  ranges: readonly DistanceBand[];
  bodyDamage: boolean;
  effects?: readonly string[];
}>;

export type MonsterArchetype = Readonly<{
  id: string;
  name: string;
  description: string;
  threat: MonsterThreat;
  role: MonsterRole;
  preferredRanges: readonly DistanceBand[];
  stats: Readonly<Record<StatKey, number>>;
  skills: Readonly<Record<string, number>>;
  hp: number;
  stamina: number;
  vigor: number;
  resolve: number;
  armor: Readonly<Record<LocationKey, number>>;
  naturalArmor: boolean;
  weapons: readonly MonsterWeaponTemplate[];
  magic: readonly FighterMagicRef[];
  traits: readonly MonsterTrait[];
  resistances: readonly DamageAffinity[];
  vulnerabilities: readonly DamageAffinity[];
  specialActions: readonly MonsterSpecialAction[];
}>;

export type MonsterWeaponProfile = Readonly<{
  templateWeaponId: string;
  weaponUid: string;
  damageType: DamageType;
  ranges: readonly DistanceBand[];
}>;

export type GeneratedMonster = Readonly<{
  archetypeId: string;
  threat: MonsterThreat;
  role: MonsterRole;
  description: string;
  preferredRanges: readonly DistanceBand[];
  fighter: PreparedFighter;
  weaponProfiles: readonly MonsterWeaponProfile[];
  traits: readonly MonsterTrait[];
  resistances: readonly DamageAffinity[];
  vulnerabilities: readonly DamageAffinity[];
  specialActions: readonly MonsterSpecialAction[];
}>;

export type GenerateMonsterOptions = Readonly<{
  threat?: MonsterThreat;
  name?: string;
  seed?: number | string;
  hpRatio?: number;
  staminaRatio?: number;
  vigorRatio?: number;
  resolveRatio?: number;
}>;

export type MonsterTargetState = Readonly<{
  id: string;
  fighter: PreparedFighter;
  distance: DistanceBand;
  conditions?: readonly MonsterCondition[];
  resistances?: readonly DamageAffinity[];
  vulnerabilities?: readonly DamageAffinity[];
  unavailable?: boolean;
}>;

export type MonsterTurnStage = "primary" | "second_fast" | "extra";

export type MonsterAiContext = Readonly<{
  monster: GeneratedMonster;
  targets: readonly MonsterTargetState[];
  selfConditions?: readonly MonsterCondition[];
  cooldowns?: Readonly<Record<string, number>>;
  turnStage?: MonsterTurnStage;
  extraAttackCost?: number;
  rng?: () => number;
}>;

export type MonsterDecision = Readonly<{
  kind: "attack" | "special" | "move" | "recover" | "pass" | "end_turn";
  targetId?: string;
  weaponUid?: string;
  specialActionId?: string;
  strikeMode?: StrikeMode;
  desiredDistance?: DistanceBand;
  extra: boolean;
  staminaCost: number;
  hitModifier: number;
  score: number;
  reason: string;
}>;

const stats = (INT: number, REF: number, DEX: number, BODY: number, SPD: number, EMP: number, CRA: number, WILL: number, LUCK: number): Record<StatKey, number> => ({
  INT, REF, DEX, BODY, SPD, EMP, CRA, WILL, LUCK,
});

const armor = (head: number, torso = head, arms = torso, legs = arms): Record<LocationKey, number> => ({ head, torso, arms, legs });

export const MONSTER_ARCHETYPES = [
  {
    id: "ash-hound",
    name: "Пепельная гончая",
    description: "Подвижный хищник, который давит скоростью и сбивает добычу с ног.",
    threat: "minor",
    role: "skirmisher",
    preferredRanges: ["engaged"],
    stats: stats(3, 7, 7, 5, 8, 1, 2, 5, 2),
    skills: { awareness: 10, athletics: 12, brawling: 12, dodge_escape: 12, stealth: 10, courage: 10 },
    hp: 25, stamina: 30, vigor: 0, resolve: 18, armor: armor(2), naturalArmor: true,
    weapons: [{ id: "ember-bite", name: "Раскалённые клыки", category: "unarmed", damage: "2d6+1", accuracy: 1, attackSkill: "brawling", damageType: "fire", ranges: ["engaged"], bodyDamage: true }],
    magic: [],
    traits: [
      { id: "heat-scent", name: "Чутьё на тепло", description: "Дым и сумрак не мешают выслеживать живую цель на близкой дистанции.", tags: ["senses"] },
      { id: "running-predator", name: "Бегущий хищник", description: "После сближения предпочитает быструю атаку, пока цель не успела закрепиться.", tags: ["mobility", "offense"] },
    ],
    resistances: [{ type: "fire", multiplier: 0.5, note: "Жар обжигает её слабее обычного." }],
    vulnerabilities: [{ type: "frost", multiplier: 1.5, note: "Холод гасит внутренний жар." }],
    specialActions: [{ id: "cinder-pounce", name: "Пепельный прыжок", kind: "attack", description: "Рывок с ближней дистанции; при успешном попадании может опрокинуть цель.", range: ["near"], cost: { resource: "stamina", amount: 2 }, cooldown: 2, weaponId: "ember-bite", damageType: "fire", inflicts: ["prone"], aiWeight: 58 }],
  },
  {
    id: "mire-stalker",
    name: "Топяной притаенник",
    description: "Засадный болотный зверь, удерживающий противника вязкими отростками.",
    threat: "standard",
    role: "ambusher",
    preferredRanges: ["engaged", "near"],
    stats: stats(5, 7, 6, 7, 5, 2, 3, 7, 3),
    skills: { awareness: 12, athletics: 10, brawling: 13, dodge_escape: 10, stealth: 14, endurance: 13 },
    hp: 38, stamina: 35, vigor: 0, resolve: 28, armor: armor(5, 7, 5, 5), naturalArmor: true,
    weapons: [
      { id: "reed-claws", name: "Камышовые когти", category: "unarmed", damage: "3d6", accuracy: 0, attackSkill: "brawling", damageType: "slashing", ranges: ["engaged"], bodyDamage: true },
      { id: "bog-tendril", name: "Болотный отросток", category: "exotic", damage: "2d6", accuracy: -1, attackSkill: "melee", damageType: "bludgeoning", ranges: ["engaged", "near"], bodyDamage: false },
    ],
    magic: [],
    traits: [
      { id: "still-as-reeds", name: "Неподвижная маскировка", description: "Пока чудовище не двигается, его трудно отличить от зарослей и наносов.", tags: ["survival", "offense"] },
      { id: "amphibious", name: "Земноводное", description: "Вода и топь не замедляют его перемещение.", tags: ["mobility", "survival"] },
    ],
    resistances: [{ type: "poison", multiplier: 0.5, note: "Болотные токсины почти не действуют." }, { type: "acid", multiplier: 0.75, note: "Влажная шкура частично рассеивает кислоту." }],
    vulnerabilities: [{ type: "fire", multiplier: 1.5, note: "Сухие волокна быстро воспламеняются." }],
    specialActions: [{ id: "mire-snare", name: "Петля из тины", kind: "control", description: "Отросток оплетает ноги цели и мешает ей менять дистанцию.", range: ["near", "far"], cost: { resource: "stamina", amount: 3 }, cooldown: 2, hitModifier: -1, inflicts: ["restrained"], aiWeight: 62 }],
  },
  {
    id: "grave-leech",
    name: "Могильный кровопийца",
    description: "Живучий падальщик, истощающий ослабленную добычу и восстанавливающийся за её счёт.",
    threat: "standard",
    role: "brute",
    preferredRanges: ["engaged"],
    stats: stats(4, 6, 5, 8, 5, 1, 2, 8, 2),
    skills: { awareness: 10, athletics: 9, brawling: 13, dodge_escape: 9, endurance: 14, resist_magic: 11 },
    hp: 45, stamina: 40, vigor: 0, resolve: 32, armor: armor(4, 6, 4, 4), naturalArmor: true,
    weapons: [{ id: "hooked-maw", name: "Крючковатая пасть", category: "unarmed", damage: "3d6+2", accuracy: 0, attackSkill: "brawling", damageType: "piercing", ranges: ["engaged"], bodyDamage: true }],
    magic: [],
    traits: [{ id: "blood-sense", name: "Чутьё на раны", description: "Раненая или истекающая кровью цель получает повышенный приоритет для ИИ.", tags: ["senses", "offense"] }],
    resistances: [{ type: "poison", multiplier: 0.5, note: "Испорченная плоть плохо принимает яд." }],
    vulnerabilities: [{ type: "fire", multiplier: 1.5, note: "Высушенная ткань уязвима к огню." }],
    specialActions: [{ id: "draining-latch", name: "Истощающий захват", kind: "recovery", description: "Прижимается к раненой цели; при успехе ведущий может восстановить чудовищу часть ПЗ.", range: ["engaged"], cost: { resource: "stamina", amount: 3 }, cooldown: 3, weaponId: "hooked-maw", damageType: "piercing", inflicts: ["weakened"], aiWeight: 56 }],
  },
  {
    id: "glasswing-harrier",
    name: "Стеклокрылый налётчик",
    description: "Летающая тварь, осыпающая противника режущей крошкой и не любящая тесный бой.",
    threat: "standard",
    role: "artillery",
    preferredRanges: ["far", "distant"],
    stats: stats(5, 7, 9, 4, 9, 2, 3, 6, 4),
    skills: { awareness: 13, athletics: 14, brawling: 9, dodge_escape: 14, stealth: 11, courage: 10 },
    hp: 30, stamina: 35, vigor: 0, resolve: 24, armor: armor(3, 4, 3, 3), naturalArmor: true,
    weapons: [{ id: "shard-volley", name: "Залп осколков", category: "thrown", damage: "3d6", accuracy: 1, attackSkill: "athletics", damageType: "slashing", ranges: ["near", "far", "distant"], bodyDamage: false }],
    magic: [],
    traits: [{ id: "high-flight", name: "Высокий полёт", description: "Свободно меняет высоту и стремится удерживать дальнюю дистанцию.", tags: ["mobility", "defense"] }],
    resistances: [{ type: "slashing", multiplier: 0.75, note: "Гибкие крылья уводят скользящие порезы." }],
    vulnerabilities: [{ type: "bludgeoning", multiplier: 1.5, note: "Ударная волна дробит хрупкие пластины." }],
    specialActions: [{ id: "glitter-dust", name: "Слепящая крошка", kind: "control", description: "Облако бликующих частиц мешает цели видеть до следующей проверки состояния.", range: ["near", "far"], cost: { resource: "stamina", amount: 3 }, cooldown: 3, inflicts: ["blinded"], aiWeight: 54 }],
  },
  {
    id: "rootbound-colossus",
    name: "Корневой колосс",
    description: "Медленный страж с тяжёлой природной бронёй и размашистыми ударами.",
    threat: "dangerous",
    role: "guardian",
    preferredRanges: ["engaged", "near"],
    stats: stats(4, 6, 4, 12, 3, 1, 2, 10, 2),
    skills: { awareness: 11, athletics: 8, brawling: 15, dodge_escape: 7, endurance: 17, resist_magic: 14 },
    hp: 70, stamina: 50, vigor: 0, resolve: 45, armor: armor(12, 15, 13, 13), naturalArmor: true,
    weapons: [{ id: "timber-fist", name: "Тяжёлая ветвь", category: "blunt", damage: "5d6", accuracy: -1, attackSkill: "brawling", damageType: "bludgeoning", ranges: ["engaged", "near"], bodyDamage: true }],
    magic: [],
    traits: [
      { id: "anchored", name: "Укоренённый", description: "Почти не поддаётся принудительному перемещению, пока стоит на земле.", tags: ["defense", "control"] },
      { id: "slow-turn", name: "Неповоротливый", description: "На дальней дистанции предпочитает сближаться вместо рискованной атаки.", tags: ["mobility"] },
    ],
    resistances: [{ type: "bludgeoning", multiplier: 0.75, note: "Масса гасит часть ударной силы." }, { type: "poison", multiplier: 0.5, note: "Растительная плоть почти не воспринимает обычный яд." }],
    vulnerabilities: [{ type: "fire", multiplier: 1.5, note: "Сухая сердцевина хорошо горит." }],
    specialActions: [{ id: "root-sweep", name: "Корневой размах", kind: "attack", description: "Размашистый удар по близкой цели с возможностью опрокидывания.", range: ["engaged", "near"], cost: { resource: "stamina", amount: 4 }, cooldown: 2, weaponId: "timber-fist", damageType: "bludgeoning", hitModifier: -1, inflicts: ["prone"], aiWeight: 60 }],
  },
  {
    id: "mist-chanter",
    name: "Туманная певунья",
    description: "Хищный контролёр, который рассеивает внимание голосом и атакует из дымки.",
    threat: "dangerous",
    role: "controller",
    preferredRanges: ["near", "far"],
    stats: stats(8, 7, 8, 5, 7, 8, 5, 10, 5),
    skills: { awareness: 14, athletics: 12, brawling: 10, dodge_escape: 13, spell_casting: 15, resist_magic: 15, stealth: 13 },
    hp: 42, stamina: 40, vigor: 15, resolve: 48, armor: armor(5), naturalArmor: true,
    weapons: [
      { id: "mist-talons", name: "Туманные когти", category: "unarmed", damage: "3d6", accuracy: 0, attackSkill: "brawling", damageType: "slashing", ranges: ["engaged"], bodyDamage: true },
      { id: "echo-lance", name: "Звуковой импульс", category: "exotic", damage: "3d6+2", accuracy: 1, attackSkill: "spell_casting", damageType: "magic", ranges: ["near", "far"], bodyDamage: false },
    ],
    magic: [{ id: "mist-call", name: "Зов из дымки", kind: "invocation" }],
    traits: [{ id: "fog-form", name: "Дымчатый силуэт", description: "На дальней дистанции очертания певуньи трудно удержать в поле зрения.", tags: ["defense", "mobility"] }],
    resistances: [{ type: "frost", multiplier: 0.75, note: "Холод лишь уплотняет её покров." }, { type: "magic", multiplier: 0.75, note: "Часть магической энергии рассеивается в дымке." }],
    vulnerabilities: [{ type: "silver", multiplier: 1.5, note: "Серебро нарушает целостность туманной формы." }],
    specialActions: [{ id: "hollow-chorus", name: "Пустой хор", kind: "control", description: "Навязчивый мотив подавляет волю и мешает приблизиться.", range: ["near", "far"], cost: { resource: "vigor", amount: 4 }, cooldown: 3, inflicts: ["frightened"], aiWeight: 66 }],
  },
  {
    id: "ember-wraith",
    name: "Угольный призрак",
    description: "Неустойчивый дух жара, проходящий сквозь строй и оставляющий тлеющие раны.",
    threat: "dangerous",
    role: "skirmisher",
    preferredRanges: ["engaged", "near"],
    stats: stats(7, 9, 9, 4, 9, 3, 4, 10, 4),
    skills: { awareness: 14, athletics: 15, brawling: 14, dodge_escape: 16, resist_magic: 15, stealth: 15 },
    hp: 44, stamina: 38, vigor: 12, resolve: 42, armor: armor(3), naturalArmor: true,
    weapons: [{ id: "coal-touch", name: "Угольное касание", category: "unarmed", damage: "4d6", accuracy: 1, attackSkill: "brawling", damageType: "fire", ranges: ["engaged", "near"], bodyDamage: false }],
    magic: [{ id: "phase-step", name: "Шаг сквозь пепел", kind: "invocation" }],
    traits: [{ id: "half-corporeal", name: "Полуплотный", description: "Обычное оружие теряет часть силы, пока форма призрака не нарушена.", tags: ["defense", "survival"] }],
    resistances: [{ type: "slashing", multiplier: 0.5, note: "Лезвие проходит через рыхлую форму." }, { type: "piercing", multiplier: 0.5, note: "Уколу трудно зацепить призрачное тело." }, { type: "fire", multiplier: 0.5, note: "Жар подпитывает тление." }],
    vulnerabilities: [{ type: "frost", multiplier: 1.5, note: "Холод уплотняет и раскалывает оболочку." }, { type: "silver", multiplier: 1.5, note: "Серебро удерживает дух в материальном мире." }],
    specialActions: [
      { id: "phase-step", name: "Шаг сквозь пепел", kind: "mobility", description: "Мгновенно меняет дистанцию на один диапазон и снимает удержание.", range: ["engaged", "near", "far"], cost: { resource: "vigor", amount: 3 }, cooldown: 2, removes: ["restrained"], aiWeight: 58 },
      { id: "ember-brand", name: "Тлеющая метка", kind: "attack", description: "Касание оставляет на цели устойчивое горение.", range: ["engaged", "near"], cost: { resource: "vigor", amount: 4 }, cooldown: 3, weaponId: "coal-touch", damageType: "fire", inflicts: ["burning"], aiWeight: 64 },
    ],
  },
  {
    id: "ironhide-burrower",
    name: "Железношкурый землерой",
    description: "Бронированный засадник, который меняет дистанцию под землёй и атакует снизу.",
    threat: "dangerous",
    role: "ambusher",
    preferredRanges: ["engaged"],
    stats: stats(4, 7, 6, 11, 6, 1, 2, 9, 2),
    skills: { awareness: 12, athletics: 12, brawling: 15, dodge_escape: 9, endurance: 16, stealth: 13 },
    hp: 62, stamina: 50, vigor: 0, resolve: 40, armor: armor(14, 16, 14, 12), naturalArmor: true,
    weapons: [{ id: "drill-horn", name: "Буровой рог", category: "exotic", damage: "5d6+1", accuracy: 0, attackSkill: "brawling", damageType: "piercing", ranges: ["engaged"], bodyDamage: true }],
    magic: [],
    traits: [{ id: "tremor-sense", name: "Чувство вибраций", description: "На земле замечает перемещение даже без прямой видимости.", tags: ["senses", "survival"] }],
    resistances: [{ type: "piercing", multiplier: 0.75, note: "Панцирные пластины отклоняют слабые уколы." }, { type: "slashing", multiplier: 0.75, note: "Режущим ударам трудно найти шов." }],
    vulnerabilities: [{ type: "acid", multiplier: 1.5, note: "Кислота раскрывает стыки панциря." }],
    specialActions: [{ id: "underground-charge", name: "Подземный таран", kind: "attack", description: "Сближается из-под земли и бьёт снизу, рискуя потерять точность.", range: ["near", "far"], cost: { resource: "stamina", amount: 4 }, cooldown: 3, weaponId: "drill-horn", damageType: "piercing", hitModifier: -2, inflicts: ["prone"], aiWeight: 68 }],
  },
  {
    id: "frostfang-matriarch",
    name: "Ледоклыкая матриархиня",
    description: "Крупный вожак, чередующий сокрушительные укусы и подавляющий холодный рёв.",
    threat: "boss",
    role: "brute",
    preferredRanges: ["engaged", "near"],
    stats: stats(7, 9, 7, 13, 7, 4, 3, 12, 5),
    skills: { awareness: 17, athletics: 14, brawling: 18, dodge_escape: 13, endurance: 19, courage: 18, intimidation: 17, resist_magic: 16 },
    hp: 92, stamina: 65, vigor: 10, resolve: 60, armor: armor(10, 13, 11, 11), naturalArmor: true,
    weapons: [
      { id: "rime-fangs", name: "Инейные клыки", category: "unarmed", damage: "6d6", accuracy: 1, attackSkill: "brawling", damageType: "frost", ranges: ["engaged"], bodyDamage: true },
      { id: "ice-breath", name: "Ледяной выдох", category: "exotic", damage: "4d6", accuracy: 0, attackSkill: "athletics", damageType: "frost", ranges: ["near", "far"], bodyDamage: false },
    ],
    magic: [{ id: "winter-roar", name: "Зимний рёв", kind: "invocation" }],
    traits: [
      { id: "apex-presence", name: "Давление вожака", description: "Предпочитает добивать ослабленную цель и редко отступает первой.", tags: ["offense", "control"] },
      { id: "winter-hide", name: "Зимняя шкура", description: "Сохраняет подвижность на льду и в глубоком снегу.", tags: ["mobility", "survival"] },
    ],
    resistances: [{ type: "frost", multiplier: 0.25, note: "Холод почти не причиняет вреда." }],
    vulnerabilities: [{ type: "fire", multiplier: 1.5, note: "Резкий жар разрушает ледяной покров." }],
    specialActions: [
      { id: "winter-roar", name: "Зимний рёв", kind: "control", description: "Рёв подавляет решимость и может напугать цель.", range: ["near", "far"], cost: { resource: "vigor", amount: 4 }, cooldown: 3, inflicts: ["frightened"], aiWeight: 60 },
      { id: "freezing-gale", name: "Морозный шквал", kind: "attack", description: "Широкий выдох холодом, особенно опасный для далёкой цели.", range: ["near", "far"], cost: { resource: "vigor", amount: 5 }, cooldown: 3, weaponId: "ice-breath", damageType: "frost", inflicts: ["weakened"], aiWeight: 72 },
    ],
  },
  {
    id: "lantern-mimic",
    name: "Фонарный подменыш",
    description: "Ложный путевой огонь, заманивающий добычу в радиус цепких конечностей.",
    threat: "standard",
    role: "controller",
    preferredRanges: ["near"],
    stats: stats(8, 7, 8, 5, 6, 7, 4, 8, 6),
    skills: { awareness: 13, athletics: 11, brawling: 11, dodge_escape: 13, deceit: 15, stealth: 14, resist_magic: 13 },
    hp: 34, stamina: 32, vigor: 8, resolve: 36, armor: armor(4, 5, 4, 4), naturalArmor: true,
    weapons: [{ id: "wire-limbs", name: "Проволочные конечности", category: "exotic", damage: "3d6", accuracy: 0, attackSkill: "brawling", damageType: "slashing", ranges: ["engaged", "near"], bodyDamage: true }],
    magic: [{ id: "false-beacon", name: "Ложный маяк", kind: "hex" }],
    traits: [{ id: "borrowed-light", name: "Заимствованный свет", description: "Издали выглядит как безопасный фонарь или окно дома.", tags: ["control", "survival"] }],
    resistances: [{ type: "magic", multiplier: 0.75, note: "Иллюзорная оболочка рассеивает часть магии." }],
    vulnerabilities: [{ type: "silver", multiplier: 1.5, note: "Серебро разрушает ложный образ." }, { type: "bludgeoning", multiplier: 1.25, note: "Тонкий каркас плохо держит тяжёлые удары." }],
    specialActions: [{ id: "false-beacon", name: "Ложный маяк", kind: "control", description: "Свет тянет цель ближе и мешает ей выбрать безопасную позицию.", range: ["far", "distant"], cost: { resource: "vigor", amount: 3 }, cooldown: 3, inflicts: ["frightened"], aiWeight: 63 }],
  },
] as const satisfies readonly MonsterArchetype[];

export type MonsterArchetypeId = (typeof MONSTER_ARCHETYPES)[number]["id"];

const THREAT_ORDER: readonly MonsterThreat[] = ["minor", "standard", "dangerous", "boss"];
const ROLE_LABELS: Readonly<Record<MonsterRole, string>> = {
  brute: "Громила", skirmisher: "Налётчик", ambusher: "Засадник", controller: "Контролёр", artillery: "Стрелок", guardian: "Страж",
};
const CORE_SKILLS = ["swordsmanship", "small_blades", "staff_spear", "melee", "brawling", "archery", "crossbow", "athletics", "dodge_escape"] as const;
const DISTANCE_ORDER: readonly DistanceBand[] = ["engaged", "near", "far", "distant"];
const CONDITION_TARGET_BONUS: Partial<Record<MonsterCondition, number>> = {
  bleeding: 8, blinded: 5, burning: 4, frightened: 5, poisoned: 4, prone: 7, restrained: 8, stunned: 14, weakened: 6,
};

const ARCHETYPE_BY_ID: ReadonlyMap<string, MonsterArchetype> = new Map(
  MONSTER_ARCHETYPES.map((entry) => [entry.id, entry] as const),
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(seed: number | string) {
  if (typeof seed === "number") return seed >>> 0 || 1;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function scaleDamage(expression: string, threatDelta: number) {
  const match = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return expression;
  const dice = clamp(Number(match[1]) + threatDelta, 1, 10);
  return `${dice}d${match[2]}${match[3] ?? ""}`;
}

function resourceValue(fighter: PreparedFighter, resource: MonsterResource) {
  if (resource === "vigor") return fighter.vigor;
  if (resource === "resolve") return fighter.resolve;
  return fighter.sta;
}

function ratio(current: number, maximum: number) {
  return maximum > 0 ? clamp(current / maximum, 0, 1) : 0;
}

function distanceGap(first: DistanceBand, second: DistanceBand) {
  return Math.abs(DISTANCE_ORDER.indexOf(first) - DISTANCE_ORDER.indexOf(second));
}

function nearestPreferredDistance(current: DistanceBand, preferred: readonly DistanceBand[]) {
  return [...preferred].sort((a, b) => distanceGap(current, a) - distanceGap(current, b))[0] ?? "engaged";
}

function affinityScore(type: DamageType, target: MonsterTargetState) {
  const vulnerability = target.vulnerabilities?.find((entry) => entry.type === type)?.multiplier ?? 1;
  const resistance = target.resistances?.find((entry) => entry.type === type)?.multiplier ?? 1;
  return (vulnerability - 1) * 20 - (1 - resistance) * 16;
}

export function getMonsterArchetype(id: string): MonsterArchetype | undefined {
  return ARCHETYPE_BY_ID.get(id);
}

export function listMonsterArchetypes(threat?: MonsterThreat): readonly MonsterArchetype[] {
  return threat ? MONSTER_ARCHETYPES.filter((entry) => entry.threat === threat) : MONSTER_ARCHETYPES;
}

/**
 * Builds a combatant without importing a character sheet. Threat scaling is
 * deliberately transparent: each step adjusts pools, armor, skills and damage,
 * while the archetype's tactical identity remains unchanged.
 */
export function generateMonster(archetypeId: MonsterArchetypeId | string, options: GenerateMonsterOptions = {}): GeneratedMonster {
  const archetype = getMonsterArchetype(archetypeId);
  if (!archetype) throw new RangeError(`Unknown monster archetype: ${archetypeId}`);

  const threat = options.threat ?? archetype.threat;
  const threatDelta = THREAT_ORDER.indexOf(threat) - THREAT_ORDER.indexOf(archetype.threat);
  const statDelta = Math.sign(threatDelta) * Math.ceil(Math.abs(threatDelta) / 2);
  const seed = hashSeed(options.seed ?? `${archetype.id}:${threat}`);
  const rng = seededRandom(seed);
  const vitalityVariance = 0.96 + rng() * 0.08;
  const poolScale = Math.max(0.45, 1 + threatDelta * 0.2);
  const name = options.name?.trim() || archetype.name;
  const instanceToken = seed.toString(36);

  const scaledStats = Object.fromEntries(Object.entries(archetype.stats).map(([key, value]) => [key, clamp(value + statDelta, 1, 15)])) as Record<StatKey, number>;
  const skills: Record<string, number> = Object.fromEntries(CORE_SKILLS.map((skill) => [skill, skill === "athletics" ? scaledStats.DEX : scaledStats.REF]));
  for (const [skill, value] of Object.entries(archetype.skills)) skills[skill] = clamp(value + threatDelta * 2, 0, 25);

  const maxHp = Math.max(1, Math.round(archetype.hp * poolScale * vitalityVariance));
  const maxSta = Math.max(1, Math.round(archetype.stamina * poolScale));
  const maxVigor = Math.max(0, Math.round(archetype.vigor * poolScale));
  const maxResolve = Math.max(1, Math.round(archetype.resolve * poolScale));
  const scaledArmor = Object.fromEntries(Object.entries(archetype.armor).map(([location, value]) => [location, Math.max(0, value + threatDelta * 2)])) as Record<LocationKey, number>;
  const weapons: Weapon[] = archetype.weapons.map((weapon) => ({
    uid: `monster_${archetype.id}_${weapon.id}_${instanceToken}`,
    name: weapon.name,
    category: weapon.category,
    damage: scaleDamage(weapon.damage, threatDelta),
    accuracy: weapon.accuracy + Math.max(0, threatDelta),
    reliability: 10,
    range: weapon.ranges.map((band) => DISTANCE_BANDS[band].label).join(", "),
    equipped: true,
    effects: [...(weapon.effects ?? [])],
    attackSkill: weapon.attackSkill,
    bodyDamage: weapon.bodyDamage,
  }));
  const weaponProfiles: MonsterWeaponProfile[] = archetype.weapons.map((weapon, index) => ({
    templateWeaponId: weapon.id,
    weaponUid: weapons[index].uid,
    damageType: weapon.damageType,
    ranges: [...weapon.ranges],
  }));
  const half = Math.ceil((scaledStats.BODY + scaledStats.WILL) / 2);
  const hpRatio = clamp(options.hpRatio ?? 1, 0, 1);
  const staminaRatio = clamp(options.staminaRatio ?? 1, 0, 1);
  const vigorRatio = clamp(options.vigorRatio ?? 1, 0, 1);
  const resolveRatio = clamp(options.resolveRatio ?? 1, 0, 1);

  const fighter: PreparedFighter = {
    id: `monster_${archetype.id}_${instanceToken}`,
    name,
    race: "Чудовище",
    profession: ROLE_LABELS[archetype.role],
    stats: scaledStats,
    skills,
    hp: Math.round(maxHp * hpRatio),
    maxHp,
    sta: Math.round(maxSta * staminaRatio),
    maxSta,
    vigor: Math.round(maxVigor * vigorRatio),
    maxVigor,
    resolve: Math.round(maxResolve * resolveRatio),
    maxResolve,
    stun: Math.min(10, half),
    rec: Math.max(1, half),
    run: scaledStats.SPD * 3,
    leap: Math.round((scaledStats.SPD * 3) / 5),
    initiativeBase: scaledStats.REF,
    meleeDamageBonus: 0,
    armor: Object.fromEntries((Object.keys(scaledArmor) as LocationKey[]).map((location) => {
      const sp = scaledArmor[location];
      return [location, { sp, originalSp: sp, source: `${name}: природная защита`, natural: archetype.naturalArmor ? sp : 0 }];
    })) as PreparedFighter["armor"],
    weapons,
    magic: archetype.magic.map((entry) => ({ ...entry, id: `monster_${archetype.id}_${entry.id}` })),
    warnings: [],
  };

  return {
    archetypeId: archetype.id,
    threat,
    role: archetype.role,
    description: archetype.description,
    preferredRanges: [...archetype.preferredRanges],
    fighter,
    weaponProfiles,
    traits: archetype.traits.map((entry) => ({ ...entry, tags: [...entry.tags] })),
    resistances: archetype.resistances.map((entry) => ({ ...entry })),
    vulnerabilities: archetype.vulnerabilities.map((entry) => ({ ...entry })),
    specialActions: archetype.specialActions.map((entry) => ({
      ...entry,
      range: [...entry.range],
      cost: entry.cost ? { ...entry.cost } : undefined,
      inflicts: entry.inflicts ? [...entry.inflicts] : undefined,
      removes: entry.removes ? [...entry.removes] : undefined,
    })),
  };
}

export function generateMonsterFighter(archetypeId: MonsterArchetypeId | string, options: GenerateMonsterOptions = {}): PreparedFighter {
  return generateMonster(archetypeId, options).fighter;
}

/** Scores vulnerable, nearby and already-controlled targets; in 1×1 it simply returns the available opponent. */
export function selectMonsterTarget(context: Pick<MonsterAiContext, "monster" | "targets">): MonsterTargetState | null {
  const candidates = context.targets.filter((target) => !target.unavailable && !target.conditions?.includes("unconscious"));
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const score = (target: MonsterTargetState) => {
      const hpPressure = (1 - ratio(target.fighter.hp, target.fighter.maxHp)) * 36;
      const staminaPressure = (1 - ratio(target.fighter.sta, target.fighter.maxSta)) * 10;
      const conditions = (target.conditions ?? []).reduce((sum, condition) => sum + (CONDITION_TARGET_BONUS[condition] ?? 0), 0);
      const preferred = Math.min(...context.monster.preferredRanges.map((band) => distanceGap(target.distance, band))) * -3;
      return hpPressure + staminaPressure + conditions + preferred;
    };
    return score(b) - score(a) || a.id.localeCompare(b.id);
  })[0];
}

function makeDecision(decision: Omit<MonsterDecision, "extra" | "staminaCost" | "hitModifier"> & Partial<Pick<MonsterDecision, "extra" | "staminaCost" | "hitModifier">>): MonsterDecision {
  return { extra: false, staminaCost: 0, hitModifier: 0, ...decision };
}

/**
 * Chooses one declarative action; it never rolls or mutates combat state.
 * The caller remains authoritative for costs, cooldowns, checks and effects.
 */
export function chooseMonsterAction(context: MonsterAiContext): MonsterDecision {
  const fighter = context.monster.fighter;
  const selfConditions = context.selfConditions ?? [];
  const stage = context.turnStage ?? "primary";
  const extraCost = Math.max(0, context.extraAttackCost ?? 3);
  const target = selectMonsterTarget(context);
  const jitter = () => (context.rng ? (context.rng() - 0.5) * 0.5 : 0);

  if (selfConditions.includes("unconscious") || selfConditions.includes("stunned")) {
    return makeDecision({ kind: "pass", score: 100, reason: "Состояние не позволяет действовать." });
  }
  if (stage === "extra" && fighter.sta < extraCost) {
    return makeDecision({ kind: "end_turn", score: 100, reason: "Недостаточно Выносливости для дополнительной атаки." });
  }
  if (!target) {
    return ratio(fighter.sta, fighter.maxSta) < 1
      ? makeDecision({ kind: "recover", score: 50, reason: "Доступных целей нет; выгоднее восстановить Выносливость." })
      : makeDecision({ kind: "pass", score: 0, reason: "Нет доступной цели." });
  }

  const decisions: MonsterDecision[] = [];
  const targetHp = ratio(target.fighter.hp, target.fighter.maxHp);
  const selfHp = ratio(fighter.hp, fighter.maxHp);
  const selfStamina = ratio(fighter.sta, fighter.maxSta);
  const targetDefense = Math.max(target.fighter.skills.dodge_escape ?? target.fighter.stats.REF, target.fighter.skills.athletics ?? target.fighter.stats.DEX);
  const impairedAccuracy = selfConditions.includes("blinded") ? -8 : selfConditions.includes("prone") ? -3 : 0;

  for (const profile of context.monster.weaponProfiles) {
    if (!profile.ranges.includes(target.distance)) continue;
    const weapon = fighter.weapons.find((entry) => entry.uid === profile.weaponUid);
    if (!weapon) continue;
    const attackBase = fighter.skills[weapon.attackSkill] ?? fighter.stats.REF;
    const edge = attackBase + weapon.accuracy + impairedAccuracy - targetDefense;
    const strikeMode: StrikeMode = stage === "second_fast"
      ? "normal"
      : (targetHp <= 0.35 || edge >= 5) && !selfConditions.includes("weakened") ? "strong" : "normal";
    const score = 48
      + edge * 1.4
      + affinityScore(profile.damageType, target)
      + (targetHp <= 0.25 ? 14 : 0)
      + (target.conditions?.includes("prone") || target.conditions?.includes("stunned") ? 7 : 0)
      + (strikeMode === "strong" ? 4 : 0)
      + jitter();
    decisions.push(makeDecision({
      kind: "attack",
      targetId: target.id,
      weaponUid: weapon.uid,
      strikeMode,
      extra: stage === "extra",
      staminaCost: stage === "extra" ? extraCost : 0,
      hitModifier: stage === "extra" ? -3 : 0,
      score,
      reason: `${weapon.name}: цель находится на подходящей дистанции${strikeMode === "strong" ? " и уязвима для сильного удара" : ""}.`,
    }));
  }

  if (stage === "primary") {
    for (const action of context.monster.specialActions) {
      if (!action.range.includes(target.distance) || (context.cooldowns?.[action.id] ?? 0) > 0) continue;
      if (action.cost && resourceValue(fighter, action.cost.resource) < action.cost.amount) continue;
      const alreadyAffected = action.inflicts?.every((condition) => target.conditions?.includes(condition)) ?? false;
      let score = action.aiWeight + affinityScore(action.damageType ?? "magic", target) + jitter();
      if (alreadyAffected) score -= 18;
      if (action.kind === "control" && !(target.conditions?.length)) score += 8;
      if (action.kind === "recovery") score += (1 - selfHp) * 28;
      if (action.kind === "defense") score += (1 - selfHp) * 22;
      if (action.kind === "mobility") score += distanceGap(target.distance, nearestPreferredDistance(target.distance, context.monster.preferredRanges)) * 8;
      const linkedWeapon = action.weaponId
        ? context.monster.weaponProfiles.find((profile) => profile.templateWeaponId === action.weaponId)?.weaponUid
        : undefined;
      decisions.push(makeDecision({
        kind: "special",
        targetId: target.id,
        weaponUid: linkedWeapon,
        specialActionId: action.id,
        score,
        reason: `${action.name}: условия применения и ресурс доступны.`,
      }));
    }
  }

  if (stage === "primary" && selfStamina <= 0.2 && !selfConditions.includes("burning")) {
    decisions.push(makeDecision({ kind: "recover", score: 56 + (1 - selfStamina) * 24, reason: "Запас Выносливости опасно мал." }));
  }

  if (!selfConditions.includes("restrained")) {
    const desiredDistance = nearestPreferredDistance(target.distance, context.monster.preferredRanges);
    if (desiredDistance !== target.distance || !decisions.some((decision) => decision.kind === "attack" || decision.kind === "special")) {
      decisions.push(makeDecision({
        kind: "move",
        targetId: target.id,
        desiredDistance,
        score: 44 + distanceGap(target.distance, desiredDistance) * 9 + (selfConditions.includes("prone") ? 8 : 0),
        reason: `Текущая дистанция неудобна; предпочтительная — «${DISTANCE_BANDS[desiredDistance].label}».`,
      }));
    }
  }

  if (!decisions.length) {
    return stage === "extra"
      ? makeDecision({ kind: "end_turn", score: 0, reason: "Нет допустимой дополнительной атаки." })
      : makeDecision({ kind: "pass", score: 0, reason: "Нет доступного действия на текущей дистанции." });
  }
  return [...decisions].sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind))[0];
}

/** Defensive preference for a later PvE controller; no dice are rolled here. */
export function chooseMonsterDefense(monster: GeneratedMonster, conditions: readonly MonsterCondition[] = []): DefenseMode {
  const fighter = monster.fighter;
  if (conditions.includes("unconscious") || conditions.includes("stunned")) return "none";
  if (conditions.includes("restrained") || conditions.includes("prone")) {
    return monster.traits.some((trait) => trait.tags.includes("defense")) ? "block" : "none";
  }
  if (ratio(fighter.hp, fighter.maxHp) <= 0.3 || monster.role === "skirmisher" || monster.role === "artillery") return "dodge";
  if (monster.role === "guardian" || monster.role === "brute") return "block";
  return fighter.skills.athletics > fighter.skills.dodge_escape ? "reposition" : "dodge";
}
