export const STAT_KEYS = ["INT", "REF", "DEX", "BODY", "SPD", "EMP", "CRA", "WILL", "LUCK"] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type LocationKey = "head" | "torso" | "arms" | "legs";
export type MagicKind = "sign" | "spell" | "invocation" | "ritual" | "hex";

export type RawCharacter = Record<string, unknown> & {
  name?: string;
  schema?: number;
  info?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  skills?: Record<string, unknown>;
  vitals?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
};

export type Weapon = {
  uid: string;
  name: string;
  category: string;
  damage: string;
  accuracy: number;
  reliability: number;
  range: string;
  equipped: boolean;
  effects: string[];
  attackSkill: string;
  bodyDamage: boolean;
};

export type ArmorZone = {
  sp: number;
  originalSp: number;
  source: string;
  natural: number;
};

export type FighterMagicRef = {
  id: string;
  name: string;
  kind: MagicKind;
};

export type Fighter = {
  id: string;
  sourceId: string;
  name: string;
  race: string;
  profession: string;
  stats: Record<StatKey, number>;
  skills: Record<string, number>;
  hp: number;
  maxHp: number;
  sta: number;
  maxSta: number;
  vigor: number;
  maxVigor: number;
  resolve: number;
  maxResolve: number;
  stun: number;
  rec: number;
  run: number;
  leap: number;
  initiativeBase: number;
  meleeDamageBonus: number;
  armor: Record<LocationKey, ArmorZone>;
  weapons: Weapon[];
  magic: FighterMagicRef[];
  warnings: string[];
  raw: RawCharacter;
};

export type PreparedFighter = Omit<Fighter, "raw" | "sourceId">;

type JsonObject = Record<string, unknown>;

const SKILL_STATS: Record<string, StatKey> = {
  awareness: "INT", business: "INT", deduction: "INT", education: "INT", common_speech: "INT",
  elder_speech: "INT", dwarven: "INT", monster_lore: "INT", social_etiquette: "INT", streetwise: "INT",
  tactics: "INT", teaching: "INT", wilderness_survival: "INT", brawling: "REF", dodge_escape: "REF",
  melee: "REF", riding: "REF", sailing: "REF", small_blades: "REF", staff_spear: "REF",
  swordsmanship: "REF", archery: "DEX", athletics: "DEX", crossbow: "DEX", sleight_of_hand: "DEX",
  stealth: "DEX", physique: "BODY", endurance: "BODY", charisma: "EMP", deceit: "EMP",
  fine_arts: "EMP", gambling: "EMP", grooming_style: "EMP", human_perception: "EMP", leadership: "EMP",
  persuasion: "EMP", performance: "EMP", seduction: "EMP", alchemy: "CRA", crafting: "CRA",
  disguise: "CRA", first_aid: "CRA", forgery: "CRA", pick_lock: "CRA", trap_crafting: "CRA",
  courage: "WILL", hex_weaving: "WILL", intimidation: "WILL", spell_casting: "WILL",
  resist_magic: "WILL", resist_coercion: "WILL", ritual_crafting: "WILL",
};

const SKILL_LABELS: Record<string, string> = {
  swordsmanship: "Владение мечом", small_blades: "Лёгкие клинки", staff_spear: "Древковое оружие",
  melee: "Ближний бой", brawling: "Драка", archery: "Стрельба из лука", crossbow: "Арбалет",
  athletics: "Атлетика", dodge_escape: "Уклонение", spell_casting: "Сотворение заклинаний",
};

const CATEGORY_SKILL: Record<string, string> = {
  sword: "swordsmanship", small_blade: "small_blades", polearm: "staff_spear", staff: "staff_spear",
  bow: "archery", crossbow: "crossbow", thrown: "athletics", axe: "melee", blunt: "melee", exotic: "melee",
};

const RACE_STATS: Record<string, Partial<Record<StatKey, number>>> = {
  witcher: { EMP: -4, REF: 1, DEX: 1 },
};

const RACE_SKILLS: Record<string, Record<string, number>> = {
  human: { deduction: 1 },
  elf: { fine_arts: 1, archery: 2 },
  dwarf: { physique: 1, business: 1 },
  witcher: { awareness: 1 },
};

const REGION_SKILLS: Record<string, string> = {
  redania: "education", kaedwen: "endurance", temeria: "charisma", aedirn: "crafting",
  lyria_rivia: "resist_coercion", kovir_poviss: "business", skellige: "courage", cidaris: "sailing",
  verden: "wilderness_survival", cintra: "human_perception", nilfgaard_heart: "deceit", vicovaro: "education",
  angren: "wilderness_survival", nazair: "brawling", metinna: "riding", maecht_turga: "endurance",
  geso: "stealth", ebbing: "deduction", mecht: "charisma", gemmera: "intimidation", etolia: "courage",
  dol_blathanna: "social_etiquette", mahakam: "crafting",
};

const FAMILY_STATS: Record<string, Partial<Record<StatKey, number>>> = {
  north_peasant: { LUCK: 1 }, nilf_peasant: { LUCK: 1 }, elder_low_birth: { LUCK: 1 },
};

const FAMILY_SKILLS: Record<string, string> = {
  north_mage_ward: "education", nilf_priesthood: "courage", elder_scholars: "education",
};

const PROFESSION_VIGOR: Record<string, number> = { witcher: 2, priest: 2, mage: 5 };

export const RACE_LABELS: Record<string, string> = {
  human: "Человек", elf: "Эльф", dwarf: "Краснолюд", witcher: "Ведьмак", halfling: "Низушек",
};

export const PROFESSION_LABELS: Record<string, string> = {
  witcher: "Ведьмак", man_at_arms: "Воин", mage: "Маг", priest: "Жрец", doctor: "Медик",
  craftsman: "Ремесленник", criminal: "Преступник", bard: "Бард", merchant: "Торговец", noble: "Дворянин",
};

export const LOCATION_LABELS: Record<LocationKey, string> = {
  head: "Голова", torso: "Туловище", arms: "Руки", legs: "Ноги",
};

export function skillLabel(id: string) {
  return SKILL_LABELS[id] ?? id;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function countFields(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countFields(item), 0);
  if (isObject(value)) return Object.values(value).reduce<number>((sum, item) => sum + countFields(item), 0);
  return 1;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addBonuses(target: Record<string, number>, source?: Record<string, number>) {
  for (const [key, value] of Object.entries(source ?? {})) target[key] = (target[key] ?? 0) + value;
}

function normalizeCharacter(raw: unknown): { character: RawCharacter; warnings: string[]; importedFields: number } {
  if (!isObject(raw) || !isObject(raw.info) || !isObject(raw.stats)) throw new Error("Файл не похож на экспорт Witcher Sheet: нет полей info и stats.");
  if (raw._kind === "witcher-campaign" || isObject(raw.manifest)) throw new Error("Это файл кампании или пака, а не персонажа.");

  const sourceSchema = Number.isInteger(raw.schema) ? Number(raw.schema) : 1;
  const warnings: string[] = [];
  if (sourceSchema > 3) warnings.push(`Версия схемы ${sourceSchema} новее поддерживаемой (3).`);
  const info = { race: "human", profession: "witcher", region: "", ...asObject(raw.info) };
  const lifepath = { familyStatusId: "", ...asObject(raw.lifepath) };
  const rawStats = raw.stats as JsonObject;
  const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, asNumber(rawStats[key], key === "LUCK" ? 5 : 6)])) as Record<StatKey, number>;
  for (const key of STAT_KEYS) {
    const value = rawStats[key];
    const numeric = (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
    if (!numeric) warnings.push(`Характеристика ${key} отсутствует или не является числом — применено значение по умолчанию.`);
  }

  if (sourceSchema < 3) {
    const storedBonuses: Partial<Record<StatKey, number>> = { ...(RACE_STATS[asString(info.race)] ?? {}) };
    for (const [key, value] of Object.entries(FAMILY_STATS[asString(lifepath.familyStatusId)] ?? {})) {
      const typedKey = key as StatKey;
      storedBonuses[typedKey] = (storedBonuses[typedKey] ?? 0) + (value ?? 0);
    }
    for (const [key, value] of Object.entries(storedBonuses)) stats[key as StatKey] -= value ?? 0;
    warnings.push("Старый формат листа преобразован к схеме 3.");
  }

  const inventory = asObject(raw.inventory);
  const vitals = asObject(raw.vitals);
  const ruleset = asArray(raw.ruleset);
  if (ruleset.some((entry) => isObject(entry) && entry.id !== "core_rulebook")) warnings.push("Дополнительные паки не встроены в экспорт: часть бонусов может потребовать ручной проверки.");
  const catalogItems = [...asArray(inventory.weapons), ...asArray(inventory.armor), ...asArray(inventory.gear)].filter(isObject);
  if (catalogItems.some((item) => typeof item.catalogId === "string")) warnings.push("Каталожные свойства предметов сверяются по снимку в файле; скрытые бонусы книги могут потребовать ручной проверки.");
  if (asArray(raw.activeMutagens).length || asArray(raw.activeElixirs).length) warnings.push("Активные мутагены или эликсиры требуют ручной проверки: их каталожные бонусы не входят в файл.");
  if (asArray(raw.wounds).some((wound) => isObject(wound) && typeof wound.woundId === "string")) warnings.push("Каталожные ранения требуют ручной проверки: их таблицы не входят в экспорт.");

  const normalized: RawCharacter = {
    ...raw,
    schema: sourceSchema > 3 ? sourceSchema : 3,
    name: asString(raw.name, "Без имени"),
    info,
    stats,
    skills: { ...asObject(raw.skills) },
    vitals: { ...vitals, resolve: Object.hasOwn(vitals, "resolve") ? vitals.resolve : Math.ceil((stats.WILL + stats.INT) / 2) * 5 },
    lifepath,
    ruleset: ruleset.length ? ruleset : [{ id: "core_rulebook", version: "*" }],
    activeMutagens: asArray(raw.activeMutagens).filter((value): value is string => typeof value === "string"),
    activeElixirs: asArray(raw.activeElixirs).filter((value): value is string => typeof value === "string"),
    addictions: Array.isArray(raw.addictions) ? raw.addictions : raw.addiction ? [raw.addiction] : [],
    share: { identity: true, skills: true, combat: true, ...asObject(raw.share) },
    reagents: { ...asObject(raw.reagents) },
    inventory: {
      ...inventory,
      weapons: asArray(inventory.weapons).filter(isObject),
      ammo: asArray(inventory.ammo).filter(isObject),
      armor: asArray(inventory.armor).filter(isObject),
      gear: asArray(inventory.gear).filter(isObject),
    },
  };
  return { character: normalized, warnings, importedFields: countFields(raw) };
}

export function parseWitcherFile(parsed: unknown) {
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  if (!entries.length) throw new Error("Файл пуст.");
  return entries.map(normalizeCharacter);
}

function effectiveStats(character: RawCharacter) {
  const result = Object.fromEntries(STAT_KEYS.map((key) => [key, asNumber(character.stats?.[key], 0)])) as Record<StatKey, number>;
  const info = asObject(character.info);
  const lifepath = asObject(character.lifepath);
  for (const [key, value] of Object.entries(RACE_STATS[asString(info.race)] ?? {})) result[key as StatKey] += value ?? 0;
  for (const [key, value] of Object.entries(FAMILY_STATS[asString(lifepath.familyStatusId)] ?? {})) result[key as StatKey] += value ?? 0;
  return result;
}

function skillBonuses(character: RawCharacter) {
  const bonuses: Record<string, number> = {};
  const info = asObject(character.info);
  const lifepath = asObject(character.lifepath);
  addBonuses(bonuses, RACE_SKILLS[asString(info.race)]);
  const regionSkill = REGION_SKILLS[asString(info.region)];
  if (regionSkill) bonuses[regionSkill] = (bonuses[regionSkill] ?? 0) + 1;
  const familySkill = FAMILY_SKILLS[asString(lifepath.familyStatusId)];
  if (familySkill) bonuses[familySkill] = (bonuses[familySkill] ?? 0) + 1;
  return bonuses;
}

function coverage(location: string): LocationKey[] {
  if (location === "full") return ["head", "torso", "arms", "legs"];
  if (location === "torso") return ["torso", "arms"];
  return (["head", "arms", "legs"] as string[]).includes(location) ? [location as LocationKey] : [];
}

function layeredSp(values: number[]) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted.slice(1).reduce((current, value) => {
    const high = Math.max(current, value);
    const low = Math.min(current, value);
    const diff = high - low;
    const bonus = diff <= 4 ? 5 : diff <= 8 ? 4 : diff <= 14 ? 3 : diff <= 20 ? 2 : 0;
    return high + bonus;
  }, sorted[0]);
}

function unconditionalEmbeddedBonuses(character: RawCharacter) {
  const result: JsonObject[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown, suppressed = false) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, suppressed);
      return;
    }
    const object = value as JsonObject;
    if (!suppressed && typeof object.key === "string" && Object.hasOwn(object, "amount") && !asString(object.condition).trim()) result.push(object);
    for (const [key, item] of Object.entries(object)) visit(item, suppressed || (object.stage === "healed" && key === "bonuses"));
  }

  const inventory = asObject(character.inventory);
  visit(asArray(inventory.weapons));
  visit(asArray(inventory.gear));
  visit(asArray(inventory.armor).filter((piece) => isObject(piece) && piece.equipped));
  visit(asArray(character.wounds));
  visit(character.abilities);
  visit(character.lifepath);
  visit(character.mutations);
  return result;
}

function buildArmor(character: RawCharacter): Record<LocationKey, ArmorZone> {
  const pieces = asArray(asObject(character.inventory).armor).filter(isObject).filter((piece) => piece.equipped);
  const natural = asString(asObject(character.info).race) === "dwarf" ? 2 : 0;
  return Object.fromEntries((["head", "torso", "arms", "legs"] as LocationKey[]).map((zone) => {
    const covering = pieces.filter((piece) => coverage(asString(piece.location)).includes(zone));
    const evaluated = covering.map((piece) => {
      const enhancements = asArray(piece.enhancements).filter(isObject);
      const sp = Math.max(0, asNumber(piece.sp) + enhancements.reduce((sum, item) => sum + asNumber(item.spBonus), 0) - asNumber(piece.spDamage));
      return { piece, sp };
    });
    const values = evaluated.map(({ sp }) => sp);
    const sp = layeredSp(values) + natural;
    const source = evaluated.sort((a, b) => b.sp - a.sp)[0]?.piece;
    return [zone, { sp, originalSp: sp, source: asString(source?.name, natural ? "Природная броня" : "Нет"), natural }];
  })) as Record<LocationKey, ArmorZone>;
}

function buildKnownMagic(character: RawCharacter): FighterMagicRef[] {
  const known = asObject(asObject(character.magic).known);
  const groups: Array<[string, MagicKind]> = [
    ["signs", "sign"], ["spells", "spell"], ["invocations", "invocation"], ["rituals", "ritual"], ["hexes", "hex"],
  ];
  const result: FighterMagicRef[] = [];
  for (const [key, kind] of groups) {
    for (const [index, entry] of asArray(known[key]).entries()) {
      const object = asObject(entry);
      const id = typeof entry === "string" ? entry : asString(object.id, asString(object.catalogId, `${kind}_${index}`));
      const name = typeof entry === "string" ? entry : asString(object.name, id);
      if (id || name) result.push({ id: id || `${kind}_${index}`, name: name || id, kind });
    }
  }
  return result;
}

export function buildFighter(character: RawCharacter, inheritedWarnings: string[] = []): Fighter {
  const stats = effectiveStats(character);
  const info = asObject(character.info);
  const rawSkills = asObject(character.skills);
  const bonuses = skillBonuses(character);
  const embedded = unconditionalEmbeddedBonuses(character);
  for (const bonus of embedded) {
    const key = asString(bonus.key);
    const isStat = bonus.target === "stat" || STAT_KEYS.includes(key as StatKey);
    const isSkill = bonus.target === "skill" || Object.hasOwn(SKILL_STATS, key);
    if (isStat) stats[key as StatKey] += asNumber(bonus.amount);
    if (isSkill) bonuses[key] = (bonuses[key] ?? 0) + asNumber(bonus.amount);
  }
  const skills: Record<string, number> = {};
  for (const [id, stat] of Object.entries(SKILL_STATS)) skills[id] = stats[stat] + asNumber(rawSkills[id]) + (bonuses[id] ?? 0);

  const half = Math.ceil((stats.BODY + stats.WILL) / 2);
  const maxHp = half * 5;
  const maxSta = half * 5;
  const vitals = asObject(character.vitals);
  const warnings = [...inheritedWarnings];
  const hp = Object.hasOwn(vitals, "hp") ? asNumber(vitals.hp) : maxHp;
  const sta = Object.hasOwn(vitals, "sta") ? asNumber(vitals.sta) : maxSta;
  const profession = asString(info.profession, "witcher");
  const defaultVigor = PROFESSION_VIGOR[profession] ?? 0;
  const maxVigor = Object.hasOwn(vitals, "vigorMax") ? asNumber(vitals.vigorMax) : defaultVigor;
  const vigor = Object.hasOwn(vitals, "vigor") ? asNumber(vitals.vigor) : maxVigor;
  const maxResolve = Math.ceil((stats.WILL + stats.INT) / 2) * 5;
  const resolve = Object.hasOwn(vitals, "resolve") ? asNumber(vitals.resolve) : maxResolve;
  if (!Object.hasOwn(vitals, "hp")) warnings.push("Текущие ПЗ отсутствовали — использован максимум.");
  if (!Object.hasOwn(vitals, "sta")) warnings.push("Текущая Выносливость отсутствовала — использован максимум.");

  const rawWeapons = asArray(asObject(character.inventory).weapons).filter(isObject);
  const weapons: Weapon[] = rawWeapons.map((weapon, index) => {
    const category = asString(weapon.category, "sword");
    if (!asString(weapon.damage).trim()) warnings.push(`${asString(weapon.name, `Оружие ${index + 1}`)}: не указана формула урона.`);
    return {
      uid: asString(weapon.uid, `weapon_${index}`), name: asString(weapon.name, `Оружие ${index + 1}`), category,
      damage: asString(weapon.damage), accuracy: asNumber(weapon.accuracy), reliability: asNumber(weapon.reliability),
      range: asString(weapon.range), equipped: weapon.equipped !== false, effects: asArray(weapon.effects).filter((item): item is string => typeof item === "string"),
      attackSkill: CATEGORY_SKILL[category] ?? "melee", bodyDamage: !["bow", "crossbow", "thrown", "ammo"].includes(category),
    };
  });
  const punchModifier = stats.BODY <= 2 ? -4 : stats.BODY <= 4 ? -2 : stats.BODY <= 6 ? 0 : stats.BODY <= 8 ? 2 : stats.BODY <= 10 ? 4 : stats.BODY <= 12 ? 6 : 8;
  const punchDamage = `1d6${punchModifier > 0 ? "+" : ""}${punchModifier || ""}`;
  weapons.push({ uid: makeId("unarmed"), name: "Удар кулаком", category: "unarmed", damage: punchDamage, accuracy: 0, reliability: 0, range: "", equipped: true, effects: [], attackSkill: "brawling", bodyDamage: false });

  return {
    id: makeId("fighter"), sourceId: asString(character.id), name: asString(character.name, "Без имени"),
    race: asString(info.race, "human"), profession, stats, skills,
    hp, maxHp, sta, maxSta, vigor, maxVigor, resolve, maxResolve, stun: Math.min(10, half), rec: half, run: stats.SPD * 3,
    leap: Math.round((stats.SPD * 3) / 5), initiativeBase: stats.REF,
    meleeDamageBonus: embedded.reduce((sum, bonus) => {
      const key = asString(bonus.key).toLocaleLowerCase("ru");
      return sum + (/урон.*ближн|melee.*damage/.test(key) ? asNumber(bonus.amount) : 0);
    }, 0),
    armor: buildArmor(character),
    weapons, magic: buildKnownMagic(character), warnings, raw: character,
  };
}

export function prepareFighter(fighter: Fighter): PreparedFighter {
  const { raw: _raw, sourceId: _sourceId, ...prepared } = fighter;
  return structuredClone(prepared);
}

export function demoCharacter(side: "a" | "b"): RawCharacter {
  const isA = side === "a";
  return {
    schema: 3, id: `demo_${side}`, name: isA ? "Иара из Венгерберга" : "Даган Серый",
    info: { race: isA ? "human" : "dwarf", profession: isA ? "mage" : "criminal", region: isA ? "temeria" : "mahakam" },
    stats: isA
      ? { INT: 6, REF: 8, DEX: 7, BODY: 7, SPD: 6, EMP: 5, CRA: 5, WILL: 7, LUCK: 5 }
      : { INT: 6, REF: 7, DEX: 6, BODY: 9, SPD: 5, EMP: 5, CRA: 6, WILL: 8, LUCK: 5 },
    skills: isA ? { swordsmanship: 6, dodge_escape: 5, athletics: 4, spell_casting: 6, resist_magic: 5, ritual_crafting: 4 } : { melee: 6, dodge_escape: 4, athletics: 4 },
    vitals: { hp: isA ? 35 : 45, sta: isA ? 35 : 45, vigor: isA ? 5 : 0, vigorMax: isA ? 5 : 0, resolve: isA ? 35 : 35 },
    magic: isA ? { known: { spells: [{ id: "demo_arcane", name: "Чародейская стрела" }], rituals: [{ id: "demo_circle", name: "Удерживаемый круг" }] } } : { known: { spells: [], invocations: [], rituals: [], signs: [], hexes: [] } },
    inventory: {
      weapons: [{ uid: `demo_w_${side}`, name: isA ? "Стальной меч" : "Боевой топор", category: isA ? "sword" : "axe", damage: isA ? "4d6" : "5d6", accuracy: 0, reliability: 10, equipped: true, effects: [] }],
      armor: [{ uid: `demo_a_${side}`, name: isA ? "Кожаный доспех" : "Кольчуга", location: "torso", weightClass: isA ? "light" : "medium", sp: isA ? 8 : 12, spDamage: 0, ev: 0, enhancements: [], equipped: true }],
      ammo: [], gear: [],
    },
  };
}

export function characterLabel(character: RawCharacter) {
  const info = asObject(character.info);
  return `${RACE_LABELS[asString(info.race)] ?? asString(info.race, "Неизвестная раса")} · ${PROFESSION_LABELS[asString(info.profession)] ?? asString(info.profession, "Неизвестная профессия")}`;
}

export function patchRawCharacter(rawCharacter: RawCharacter, fighter: PreparedFighter): RawCharacter {
  const raw = structuredClone(rawCharacter);
  raw.vitals = { ...asObject(raw.vitals), hp: fighter.hp, sta: fighter.sta, vigor: fighter.vigor, vigorMax: fighter.maxVigor, resolve: fighter.resolve };
  return raw;
}
