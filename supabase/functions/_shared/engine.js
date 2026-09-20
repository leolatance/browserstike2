// packages/engine/src/rng.ts
var Rng = class _Rng {
  state;
  constructor(seed) {
    this.state = seed >>> 0;
  }
  /** Uniform float in [0, 1). */
  next() {
    this.state = this.state + 1831565813 >>> 0;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /** Uniform integer in [min, max] (both inclusive). */
  int(min, max) {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** Uniform float in [min, max). */
  float(min, max) {
    return min + this.next() * (max - min);
  }
  /** True with probability `p` (clamped to [0, 1]). */
  chance(p) {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }
  /** Random element of a non-empty array. */
  pick(arr) {
    if (arr.length === 0) throw new Error("Rng.pick: empty array");
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** Fisher-Yates shuffle. Returns a new array; the input is untouched. */
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
  /** Derive an independent child generator (for sub-systems). */
  fork() {
    return new _Rng(Math.floor(this.next() * 4294967296));
  }
};

// packages/engine/src/events.ts
function isEvent(e, type) {
  return e.type === type;
}

// packages/engine/src/data/cards.ts
var flat = (attr, value) => ({ kind: "flat", attr, value });
var cond = (attr, value, when) => ({ kind: "conditional", attr, value, when });
var beh = (behavior) => ({ kind: "behavior", behavior });
var CARDS = [
  // ------------------------------------------------------------- planas (13)
  { id: "card_aim_crosshair", name: "Crosshair placement", rarity: 1, type: "flat", theme: "aim", tag: "rifler", effect: flat("mira", 18), text: "+{n} Mira" },
  { id: "card_aim_spray", name: "Controle de spray", rarity: 2, type: "flat", theme: "aim", tag: "rifler", effect: flat("mira", 18), text: "+{n} Mira" },
  { id: "card_aim_tap", name: "Tap firing", rarity: 4, type: "flat", theme: "aim", tag: "star", effect: flat("mira", 22), text: "+{n} Mira" },
  { id: "card_move_strafe", name: "Counter-strafe", rarity: 1, type: "flat", theme: "move", tag: "awper", effect: flat("mov", 20), text: "+{n} Movimenta\xE7\xE3o" },
  { id: "card_move_jiggle", name: "Jiggle peek", rarity: 1, type: "flat", theme: "move", tag: "entry", effect: flat("mov", 20), text: "+{n} Movimenta\xE7\xE3o" },
  { id: "card_peek_timing", name: "Timing de peek", rarity: 1, type: "flat", theme: "peek", effect: flat("peek", 18), text: "+{n} Peek" },
  { id: "card_peek_wide", name: "Wide swing", rarity: 2, type: "flat", theme: "peek", tag: "entry", effect: flat("peek", 18), text: "+{n} Peek" },
  { id: "card_tac_positioning", name: "Posicionamento", rarity: 1, type: "flat", theme: "tac", tag: "anchor", effect: flat("tatico", 18), text: "+{n} T\xE1tico" },
  { id: "card_tac_reading", name: "Leitura de jogo", rarity: 2, type: "flat", theme: "tac", tag: "igl", effect: flat("tatico", 18), text: "+{n} T\xE1tico" },
  { id: "card_util_lineups", name: "Lineups", rarity: 1, type: "flat", theme: "util", tag: "support", effect: flat("util", 18), text: "+{n} Utilit\xE1ria" },
  { id: "card_util_timing", name: "Timing de util", rarity: 2, type: "flat", theme: "util", tag: "support", effect: flat("util", 18), text: "+{n} Utilit\xE1ria" },
  { id: "card_mental_focus", name: "Foco", rarity: 1, type: "flat", theme: "mental", tag: "star", effect: flat("mental", 18), text: "+{n} Mental" },
  { id: "card_mental_calm", name: "Sangue frio", rarity: 2, type: "flat", theme: "mental", tag: "anchor", effect: flat("mental", 18), text: "+{n} Mental" },
  // ------------------------------------------------------- condicionais (13)
  { id: "card_cond_prefire", name: "Pr\xE9-mira de esquina", rarity: 3, type: "conditional", theme: "aim", effect: cond("mira", 36, { role: "defender", holdingAngle: true }), text: "+{n} Mira quando defende segurando \xE2ngulo" },
  { id: "card_cond_first_contact", name: "Primeiro contato", rarity: 3, type: "conditional", theme: "peek", tag: "entry", effect: cond("peek", 36, { role: "attacker", firstDuel: true }), text: "+{n} Peek no primeiro duelo do round atacando" },
  { id: "card_cond_flash_eyes", name: "Olhos fechados", rarity: 2, type: "conditional", theme: "util", tag: "support", effect: cond("mira", 36, { flashed: true }), text: "+{n} Mira quando flashado" },
  { id: "card_cond_clutch_nerves", name: "Nervos de a\xE7o", rarity: 5, type: "conditional", theme: "mental", effect: cond("mental", 45, { clutch: true }), text: "+{n} Mental em clutch" },
  { id: "card_cond_trade_instinct", name: "Instinto de trade", rarity: 2, type: "conditional", theme: "peek", effect: cond("peek", 36, { role: "attacker", trade: true }), text: "+{n} Peek ao tradar um aliado" },
  { id: "card_cond_long_range", name: "Olho de \xE1guia", rarity: 2, type: "conditional", theme: "aim", tag: "awper", effect: cond("mira", 27, { range: "long" }), text: "+{n} Mira em longa dist\xE2ncia" },
  { id: "card_cond_short_range", name: "C\xE3o de briga", rarity: 1, type: "conditional", theme: "aim", tag: "rifler", effect: cond("mira", 27, { range: "short" }), text: "+{n} Mira em curta dist\xE2ncia" },
  { id: "card_cond_retake_calm", name: "Retake frio", rarity: 3, type: "conditional", theme: "tac", tag: "igl", effect: cond("tatico", 36, { retake: true }), text: "+{n} T\xE1tico em retake" },
  { id: "card_cond_postplant", name: "P\xF3s-plant", rarity: 2, type: "conditional", theme: "tac", effect: cond("tatico", 36, { postplant: true }), text: "+{n} T\xE1tico defendendo a bomba plantada" },
  { id: "card_cond_pistol_hero", name: "Her\xF3i do pistol", rarity: 1, type: "conditional", theme: "aim", effect: cond("mira", 36, { pistol: true }), text: "+{n} Mira no pistol round" },
  { id: "card_cond_numbers_down", name: "Contra a mar\xE9", rarity: 3, type: "conditional", theme: "mental", effect: cond("mental", 45, { numbers: "down" }), text: "+{n} Mental em desvantagem num\xE9rica" },
  { id: "card_cond_site_anchor", name: "Dono do site", rarity: 4, type: "conditional", theme: "tac", tag: "anchor", effect: cond("tatico", 36, { role: "defender", atSite: true }), text: "+{n} T\xE1tico defendendo o site" },
  { id: "card_cond_star_pick", name: "Escolha do craque", rarity: 5, type: "conditional", theme: "aim", tag: "star", effect: cond("mira", 45, { numbers: "up" }), text: "+{n} Mira em vantagem num\xE9rica" },
  // -------------------------------------------------------- comportamentais (4)
  { id: "card_beh_scout", name: "Scout no pistol", rarity: 2, type: "behavior", theme: "econ", tag: "awper", effect: beh("scout_round2"), text: "Compra Scout no round 2 se tiver dinheiro" },
  { id: "card_beh_save", name: "Salva a arma", rarity: 1, type: "behavior", theme: "econ", effect: beh("save_1v3"), text: "Em 1v3 ou pior, recua e salva em vez de duelar" },
  { id: "card_beh_awp_discount", name: "Desconto na AWP", rarity: 3, type: "behavior", theme: "econ", effect: beh("awp_discount"), text: "AWP custa \u2212$500" },
  { id: "card_beh_kit", name: "Kit sempre", rarity: 1, type: "behavior", theme: "econ", tag: "igl", effect: beh("always_kit"), text: "Como CT, compra kit antes de tudo" }
];
var BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
function card(id) {
  const c = BY_ID[id];
  if (!c) throw new Error(`Unknown card: ${id}`);
  return c;
}
function hasCard(id) {
  return id in BY_ID;
}
var LEVEL_MULT = { 1: 1, 2: 1.25, 3: 1.5 };
function cardValue(c, level) {
  if (c.effect.kind === "behavior") return 0;
  return Math.round(c.effect.value * LEVEL_MULT[level]);
}
function cardText(c, level) {
  return c.text.replace("{n}", String(cardValue(c, level)));
}
var RARITY_NAME = { 1: "Comum", 2: "Incomum", 3: "Rara", 4: "\xC9pica", 5: "Lend\xE1ria" };
var RARITY_DROP = { 1: 60, 2: 25, 3: 10, 4: 4, 5: 1 };
var CARD_LEVEL_MAX = 3;
function slotsForLevel(level) {
  if (level >= 35) return 6;
  if (level >= 20) return 5;
  if (level >= 12) return 4;
  if (level >= 5) return 3;
  return 2;
}
var SET_SIZE = 3;
var CLASS_LABEL = {
  entry: "Entry",
  igl: "IGL",
  awper: "AWPer",
  anchor: "\xC2ncora",
  rifler: "Rifler",
  support: "Support",
  star: "Star"
};
var SET_BONUS_TEXT = {
  entry: "Primeiro duelo do round: +10 Peek; trade garantido em 3s se morrer",
  igl: "Time ganha +8 T\xE1tico nas decis\xF5es de compra e call",
  awper: "AWP custa \u2212$500; +6 Mira em longa",
  anchor: "+12% de sobreviv\xEAncia defendendo o site; +$200 por round sobrevivido",
  support: "Util do time 15% mais efetiva; flash assist garantido",
  star: "+6 no score do primeiro duelo do round (escolhe o duelo favor\xE1vel)",
  rifler: "Sem conjunto: joga de Rifler"
};

// packages/engine/src/player.ts
var ATTR_KEYS = ["mira", "mov", "peek", "tatico", "util", "mental"];
var SET_BONUS = {
  ENTRY_FIRST_PEEK: 10,
  // [v0] GDD 6.3
  IGL_TEAM_TATICO: 8,
  // [v0]
  AWPER_LONG_MIRA: 6,
  // [v0]
  ANCHOR_SITE_SURVIVAL: 0.12,
  // [v0]
  ANCHOR_SURVIVE_MONEY: 200,
  // [v0]
  SUPPORT_UTIL_MULT: 1.15,
  // [v0]
  STAR_FIRST_DUEL_SCORE: 6
  // [v0]
};
var EMPTY_RESOLVED = {
  flat: {},
  conditionals: [],
  behaviors: /* @__PURE__ */ new Set(),
  sets: [],
  activeClass: "rifler",
  siteSurvival: 0,
  surviveMoney: 0,
  teamTatico: 0,
  utilMult: 1,
  guaranteedTrade: false,
  flashAssistSure: false
};
var RESOLVED_CACHE = /* @__PURE__ */ new WeakMap();
function resolveBuild(build) {
  if (build.cards.length === 0) return EMPTY_RESOLVED;
  const cached = RESOLVED_CACHE.get(build);
  if (cached) return cached;
  const flat2 = {};
  const conditionals = [];
  const behaviors = /* @__PURE__ */ new Set();
  const tagCount = /* @__PURE__ */ new Map();
  const tagOrder = [];
  const seen = /* @__PURE__ */ new Set();
  for (const eq of build.cards) {
    if (seen.has(eq.id)) continue;
    seen.add(eq.id);
    const c = card(eq.id);
    const v = cardValue(c, eq.level);
    if (c.effect.kind === "flat") flat2[c.effect.attr] = (flat2[c.effect.attr] ?? 0) + v;
    else if (c.effect.kind === "conditional") conditionals.push({ source: c.id, attr: c.effect.attr, value: v, when: c.effect.when });
    else behaviors.add(c.effect.behavior);
    if (c.tag) {
      if (!tagCount.has(c.tag)) tagOrder.push(c.tag);
      tagCount.set(c.tag, (tagCount.get(c.tag) ?? 0) + 1);
    }
  }
  const sets = tagOrder.filter((t) => (tagCount.get(t) ?? 0) >= SET_SIZE);
  const out = { ...EMPTY_RESOLVED, flat: flat2, conditionals, behaviors, sets, activeClass: sets[0] ?? "rifler" };
  for (const s of sets) {
    switch (s) {
      case "entry":
        conditionals.push({ source: "set:entry", attr: "peek", value: SET_BONUS.ENTRY_FIRST_PEEK, when: { role: "attacker", firstDuel: true } });
        out.guaranteedTrade = true;
        break;
      case "igl":
        out.teamTatico = SET_BONUS.IGL_TEAM_TATICO;
        break;
      case "awper":
        behaviors.add("awp_discount");
        conditionals.push({ source: "set:awper", attr: "mira", value: SET_BONUS.AWPER_LONG_MIRA, when: { range: "long" } });
        break;
      case "anchor":
        out.siteSurvival = SET_BONUS.ANCHOR_SITE_SURVIVAL;
        out.surviveMoney = SET_BONUS.ANCHOR_SURVIVE_MONEY;
        break;
      case "support":
        out.utilMult = SET_BONUS.SUPPORT_UTIL_MULT;
        out.flashAssistSure = true;
        break;
      case "star":
        conditionals.push({ source: "set:star", attr: "score", value: SET_BONUS.STAR_FIRST_DUEL_SCORE, when: { firstDuel: true } });
        break;
      default:
        break;
    }
  }
  RESOLVED_CACHE.set(build, out);
  return out;
}
function setProgress(build) {
  const out = {};
  const seen = /* @__PURE__ */ new Set();
  for (const eq of build.cards) {
    if (seen.has(eq.id)) continue;
    seen.add(eq.id);
    const c = card(eq.id);
    if (c.tag) out[c.tag] = (out[c.tag] ?? 0) + 1;
  }
  return out;
}
var EMPTY_BUILD = { cards: [] };
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function clampAttr(v) {
  return clamp(v, 0, 100);
}
var NO_IGL_TATICO_MULT = 0.85;
function mentalMultiplier(mental) {
  return 0.9 + 0.2 * (clampAttr(mental) / 100);
}
function initialMental(player) {
  const form = clamp(player.form ?? 1, 0.85, 1.15);
  return clampAttr(player.attrs.mental * form);
}
function buildBonuses(build, _situation) {
  return resolveBuild(build).flat;
}
function effectiveAttrs(player, situation = {}) {
  const mental = clampAttr(situation.mental ?? player.attrs.mental);
  const bonus = buildBonuses(player.build, situation);
  const mult = mentalMultiplier(mental);
  const base = player.attrs;
  const out = {
    mira: (base.mira + (bonus.mira ?? 0)) * mult,
    mov: (base.mov + (bonus.mov ?? 0)) * mult,
    peek: (base.peek + (bonus.peek ?? 0)) * mult,
    tatico: (base.tatico + (bonus.tatico ?? 0)) * mult,
    util: (base.util + (bonus.util ?? 0)) * mult,
    mental
  };
  if (situation.noIgl) out.tatico *= NO_IGL_TATICO_MULT;
  out.mira = Math.max(0, out.mira);
  out.mov = Math.max(0, out.mov);
  out.peek = Math.max(0, out.peek);
  out.tatico = Math.max(0, out.tatico);
  out.util = Math.max(0, out.util);
  return out;
}
function averageAttr(attrs) {
  let sum = 0;
  for (const k of ATTR_KEYS) sum += attrs[k];
  return sum / ATTR_KEYS.length;
}
function makePlayer(id, nick, cls, attrs, form) {
  const p = { id, nick, attrs: { ...attrs }, class: cls, build: EMPTY_BUILD };
  if (form !== void 0) p.form = form;
  return p;
}
function uniformAttrs(v) {
  return { mira: v, mov: v, peek: v, tatico: v, util: v, mental: v };
}
function findIgl(team) {
  return team.players.find((p) => p.class === "igl");
}

// packages/engine/src/data/weapons.ts
var KILL_REWARD = {
  rifle: 300,
  awp: 100,
  smg: 600,
  shotgun: 900,
  knife: 1500,
  pistol: 300
};
var RIFLE_MOD = { short: 0, mid: 0, long: 0 };
var SMG_MOD = { short: 6, mid: -6, long: -6 };
var AWP_MOD = { short: -10, mid: 4, long: 18 };
var PISTOL_MOD = { short: -15, mid: -15, long: -15 };
var WEAPONS = [
  { id: "knife", name: "Faca", class: "knife", price: 0, killReward: KILL_REWARD.knife, rangeMod: { short: -40, mid: -60, long: -80 }, side: "both", tier: 0 },
  // Pistols
  { id: "glock", name: "Glock", class: "pistol", price: 200, killReward: KILL_REWARD.pistol, rangeMod: PISTOL_MOD, side: "T", tier: 1 },
  { id: "usp", name: "USP", class: "pistol", price: 200, killReward: KILL_REWARD.pistol, rangeMod: PISTOL_MOD, side: "CT", tier: 1 },
  { id: "p250", name: "P250", class: "pistol", price: 300, killReward: KILL_REWARD.pistol, rangeMod: { short: -12, mid: -13, long: -15 }, side: "both", tier: 2 },
  { id: "deagle", name: "Deagle", class: "pistol", price: 700, killReward: KILL_REWARD.pistol, rangeMod: { short: -10, mid: -9, long: -9 }, side: "both", tier: 3 },
  // SMGs
  { id: "mac10", name: "MAC-10", class: "smg", price: 1050, killReward: KILL_REWARD.smg, rangeMod: SMG_MOD, side: "T", tier: 4 },
  { id: "mp9", name: "MP9", class: "smg", price: 1250, killReward: KILL_REWARD.smg, rangeMod: SMG_MOD, side: "CT", tier: 4 },
  // Shotgun
  { id: "nova", name: "Nova", class: "shotgun", price: 1050, killReward: KILL_REWARD.shotgun, rangeMod: { short: 4, mid: -14, long: -30 }, side: "both", tier: 4 },
  // Rifles
  { id: "galil", name: "Galil", class: "rifle", price: 1800, killReward: KILL_REWARD.rifle, rangeMod: { short: -2, mid: -2, long: -3 }, side: "T", tier: 5 },
  { id: "famas", name: "FAMAS", class: "rifle", price: 2050, killReward: KILL_REWARD.rifle, rangeMod: { short: -2, mid: -2, long: -3 }, side: "CT", tier: 5 },
  { id: "ak47", name: "AK-47", class: "rifle", price: 2700, killReward: KILL_REWARD.rifle, rangeMod: RIFLE_MOD, side: "T", tier: 6 },
  { id: "m4s", name: "M4 Supressor", class: "rifle", price: 2900, killReward: KILL_REWARD.rifle, rangeMod: RIFLE_MOD, side: "CT", tier: 6 },
  { id: "m4", name: "M4", class: "rifle", price: 3100, killReward: KILL_REWARD.rifle, rangeMod: RIFLE_MOD, side: "CT", tier: 6 },
  // Snipers
  { id: "scout", name: "Scout", class: "awp", price: 1700, killReward: KILL_REWARD.rifle, rangeMod: { short: -8, mid: 0, long: 10 }, side: "both", tier: 5 },
  { id: "awp", name: "AWP", class: "awp", price: 4750, killReward: KILL_REWARD.awp, rangeMod: AWP_MOD, side: "both", tier: 7 }
];
var BY_ID2 = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
function weapon(id) {
  const w = BY_ID2[id];
  if (!w) throw new Error(`Unknown weapon: ${id}`);
  return w;
}
function starterPistol(side) {
  return side === "T" ? weapon("glock") : weapon("usp");
}
function riflesFor(side) {
  return WEAPONS.filter((w) => w.class === "rifle" && (w.side === side || w.side === "both")).sort((a, b) => a.price - b.price);
}
function smgFor(side) {
  return side === "T" ? weapon("mac10") : weapon("mp9");
}
var GEAR = {
  kevlar: 650,
  kevlarHelmet: 1e3,
  kit: 400,
  flash: 200,
  smoke: 300,
  /** Molotov (T) / incendiary (CT). */
  molotov: { T: 400, CT: 600 },
  he: 300
};
var NO_ARMOR_PENALTY = -5;

// packages/engine/src/economy.ts
var START_MONEY = 800;
var OT_START_MONEY = 1e4;
var MAX_MONEY = 16e3;
var WIN_REWARD = 3250;
var WIN_REWARD_OBJECTIVE = 3500;
var LOSS_BONUS = [1400, 1900, 2400, 2900, 3400];
var PLANT_BONUS = 800;
function freshInventory(side) {
  return { weapon: starterPistol(side).id, armor: false, helmet: false, kit: false, utils: [] };
}
function lossBonus(streak) {
  const i = Math.max(1, Math.min(streak, LOSS_BONUS.length)) - 1;
  return LOSS_BONUS[i];
}
function nextLossStreak(current, won) {
  return won ? Math.max(0, current - 1) : current + 1;
}
function roundIncome(p) {
  if (p.won) return p.reason === "bomb" || p.reason === "defuse" ? WIN_REWARD_OBJECTIVE : WIN_REWARD;
  if (p.side === "T" && p.reason === "time" && p.alive) return 0;
  let income = lossBonus(p.lossStreak);
  if (p.side === "T" && p.planted) income += PLANT_BONUS;
  return income;
}
function addMoney(current, delta) {
  return Math.max(0, Math.min(MAX_MONEY, current + delta));
}
function fullBuyFloor(side) {
  const cheapest = riflesFor(side)[0];
  return cheapest.price + GEAR.kevlar;
}
var FORCE_AVG_MONEY = 2e3;
var FORCE_MIN_LOSS_STREAK = 2;
var ECON = {
  /** P(wrong team buy) = (100 − tatico) / BUY_MISTAKE_DIVISOR. GDD 5.4: 200. */
  BUY_MISTAKE_DIVISOR: 200,
  // [v0]
  /** Eco purchases: full save below ECO_P250_MONEY. [v1] */
  ECO_P250_MONEY: 1500,
  ECO_DEAGLE_MONEY: 2400
};
function decideTeamBuy(input, rng) {
  if (input.pistol) return "pistol";
  const floor = fullBuyFloor(input.side);
  const everyoneCan = input.players.every((p) => hasRifleClass(p.inv) || p.money >= floor);
  const avg = input.players.reduce((s, p) => s + p.money, 0) / Math.max(1, input.players.length);
  let decision;
  if (everyoneCan) decision = "full";
  else if (avg >= FORCE_AVG_MONEY && input.lossStreak >= FORCE_MIN_LOSS_STREAK) decision = "force";
  else decision = "eco";
  const mistake = (100 - input.tatico) / ECON.BUY_MISTAKE_DIVISOR;
  if (rng.chance(mistake)) {
    if (decision === "force") decision = rng.pick(["full", "eco"]);
    else decision = "force";
  }
  return decision;
}
function hasRifleClass(inv) {
  const c = weapon(inv.weapon).class;
  return c === "rifle" || c === "awp";
}
var RIFLE_RESERVE = 1e3;
var AWP_MIN_MONEY = 5750;
var AWP_DISCOUNT = 500;
var MAX_UTILS = 4;
function buyForPlayer(input, rng) {
  const side = input.side;
  const behaviors = input.behaviors ?? /* @__PURE__ */ new Set();
  const awpDiscount = behaviors.has("awp_discount") ? AWP_DISCOUNT : 0;
  const inv = { ...input.inv, utils: [...input.inv.utils] };
  let money = input.money;
  let spent = 0;
  const pay = (price) => {
    if (money < price) return false;
    money -= price;
    spent += price;
    return true;
  };
  const buyWeapon = (w) => {
    if (!pay(w.id === "awp" ? w.price - awpDiscount : w.price)) return false;
    inv.weapon = w.id;
    return true;
  };
  const tryScout = () => {
    if (!behaviors.has("scout_round2") || !input.afterPistol || ownsRifle()) return false;
    const scout = weapon("scout");
    if (money < scout.price + GEAR.kevlar) return false;
    buyArmor(false);
    return buyWeapon(scout);
  };
  const buyArmor = (helmet) => {
    if (inv.armor && (inv.helmet || !helmet)) return true;
    if (inv.armor && !inv.helmet && helmet) {
      if (!pay(GEAR.kevlarHelmet - GEAR.kevlar)) return false;
      inv.helmet = true;
      return true;
    }
    if (helmet && pay(GEAR.kevlarHelmet)) {
      inv.armor = true;
      inv.helmet = true;
      return true;
    }
    if (pay(GEAR.kevlar)) {
      inv.armor = true;
      return true;
    }
    return false;
  };
  const buyUtil = (u, reserve = 0) => {
    if (inv.utils.length >= MAX_UTILS) return false;
    const count = inv.utils.filter((x) => x === u).length;
    if (u === "flash" && count >= 2 || u !== "flash" && count >= 1) return false;
    const price = u === "molotov" ? GEAR.molotov[side] : GEAR[u];
    if (money - price < reserve) return false;
    pay(price);
    inv.utils.push(u);
    return true;
  };
  const buyKit = (reserve = 0) => {
    if (side !== "CT" || inv.kit) return false;
    if (money - GEAR.kit < reserve) return false;
    pay(GEAR.kit);
    inv.kit = true;
    return true;
  };
  const ownsRifle = () => hasRifleClass(inv);
  const bestRifleWithin = (budget) => {
    const options = riflesFor(side).filter((w) => w.price <= budget);
    return options[options.length - 1];
  };
  switch (input.decision) {
    case "pistol": {
      const roll = rng.next();
      if (input.class === "support" || roll < 0.35) {
        buyWeapon(weapon("p250"));
        buyUtil("flash");
        buyUtil("he");
      } else if (roll < 0.85) {
        buyArmor(false);
      } else {
        buyWeapon(weapon("deagle"));
      }
      break;
    }
    case "eco": {
      if (ownsRifle()) break;
      if (money >= ECON.ECO_DEAGLE_MONEY && rng.chance(0.5)) buyWeapon(weapon("deagle"));
      else if (money >= ECON.ECO_P250_MONEY && rng.chance(0.6)) buyWeapon(weapon("p250"));
      break;
    }
    case "force": {
      if (behaviors.has("always_kit")) buyKit();
      buyArmor(false);
      tryScout();
      if (!ownsRifle()) {
        const rifle = bestRifleWithin(money);
        if (rifle) buyWeapon(rifle);
        else if (money >= smgFor(side).price) buyWeapon(smgFor(side));
        else if (money >= weapon("deagle").price) buyWeapon(weapon("deagle"));
        else if (money >= weapon("p250").price && weapon(inv.weapon).tier < 2) buyWeapon(weapon("p250"));
      }
      buyUtil("flash");
      if (input.class === "support") buyUtil("smoke");
      break;
    }
    case "full": {
      const isSupport = input.class === "support";
      if (behaviors.has("always_kit")) buyKit();
      const wantsAwp = input.class === "awper" && !input.teamHasAwp && money >= AWP_MIN_MONEY - awpDiscount && weapon(inv.weapon).class !== "awp";
      if (tryScout()) {
        buyArmor(true);
      } else if (wantsAwp) {
        buyArmor(true);
        buyWeapon(weapon("awp"));
      } else if (isSupport) {
        buyArmor(true);
        buyUtil("smoke");
        buyUtil("flash");
        buyUtil("flash");
        buyUtil("molotov");
        if (!ownsRifle()) {
          const rifle = bestRifleWithin(money - RIFLE_RESERVE) ?? bestRifleWithin(money);
          if (rifle) buyWeapon(rifle);
          else if (money >= smgFor(side).price) buyWeapon(smgFor(side));
        }
      } else {
        if (!ownsRifle()) {
          const withHelmet = bestRifleWithin(money - GEAR.kevlarHelmet - RIFLE_RESERVE);
          const withKevlar = bestRifleWithin(money - GEAR.kevlar - RIFLE_RESERVE);
          if (withHelmet && (!withKevlar || withHelmet.tier >= withKevlar.tier)) {
            buyArmor(true);
            buyWeapon(withHelmet);
          } else if (withKevlar) {
            buyArmor(false);
            buyWeapon(withKevlar);
          } else {
            buyArmor(false);
            const rifle = bestRifleWithin(money);
            if (rifle) buyWeapon(rifle);
            else if (money >= smgFor(side).price) buyWeapon(smgFor(side));
          }
        } else {
          buyArmor(true);
        }
      }
      const kitPriority = input.class === "anchor" || input.class === "igl" || isSupport;
      if (kitPriority || rng.chance(0.5)) buyKit(isSupport ? 0 : RIFLE_RESERVE / 2);
      const reserve = RIFLE_RESERVE / 2;
      buyUtil("flash", reserve);
      buyUtil("smoke", reserve);
      buyUtil("flash", reserve);
      if (input.class === "entry" || input.class === "rifler") buyUtil("molotov", reserve);
      buyUtil("he", reserve);
      break;
    }
  }
  return { inv, spent, weapon: inv.weapon };
}

// packages/engine/src/duel.ts
var DUEL = {
  /**
   * Multiplies the attribute part of the score. [v0 → v1] The GDD formula
   * (weights summing to 1.0 with divisor 40) makes +10 in every attribute win
   * ~64% of duels, which compounds to >95% of matches. Attributes must be a
   * smooth edge, weapons/situation the loud one. Tuned via balance.test.ts.
   */
  ATTR_SCALE: 0.14,
  // [v0 → v1] 1.0 → 0.14 (see note above; the +10 gate is 70–76%)
  /** Logistic divisor: P(A) = 1 / (1 + 10^((scoreD − scoreA) / DIVISOR)). */
  LOGISTIC_DIVISOR: 40,
  // [v0]
  W_MIRA: 0.45,
  // [v0]
  W_PEEK: 0.25,
  // [v0]  attacker
  W_TATICO: 0.25,
  // [v0] defender (position)
  W_MOV: 0.15,
  // [v0]
  W_UTIL: 0.15,
  // [v0]
  HOLD_ANGLE: 10,
  // [v0 → v1] 6 → 10: CT round win was 46%; fresh angles win more in CS
  FLASH_PENALTY: 15,
  // [v0] −15 · (enemy util / 100) when flashed
  SMOKE_PENALTY: -10,
  // [v0] both sides when the duel happens in smoke
  RETAKE_PRO_T: 5,
  // [v0] T defending a planted bomb
  NUMBERS: 8,
  // [v0] side with the numeric advantage
  NO_ARMOR: NO_ARMOR_PENALTY,
  // [v0 → v1] −8 → −5 (eco win rate was 10%)
  HP_PENALTY_PER_POINT: 0.08,
  // [v0] −0.08 per missing HP point
  HS_BASE: 0.25,
  // [v0] P(headshot | win) = 0.25 + 0.5 · mira/100
  HS_MIRA: 0.5,
  // [v0]
  RETREAT_BASE: 0.05,
  // [v0] P(loser survives) = 0.05 + 0.25 · mov/100
  RETREAT_MOV: 0.25,
  // [v0]
  RETREAT_MIN_HP: 25,
  // [v0] below this HP the loser cannot escape
  /**
   * [v0 → v1] GDD: 0.3 + 0.4·peek/100 (≈50% of kills traded at peek 50).
   * Halved the slope and lowered the base: real-CS trade rate is ~30% and the
   * peek slope was the 2nd biggest hidden attribute channel in balance tests.
   */
  TRADE_BASE: 0.2,
  TRADE_PEEK: 0.2,
  CLUTCH_MENTAL: 0.2
  // [v0] +0.2 · mental for the clutcher
};
function conditionMatches(when, role, d, ctx) {
  const flags = (role === "A" ? ctx.attackerFlags : ctx.defenderFlags) ?? {};
  if (when.role && when.role !== (role === "A" ? "attacker" : "defender")) return false;
  if (when.holdingAngle && !(role === "D" && ctx.defenderHoldingAngle)) return false;
  if (when.flashed && (role === "A" ? ctx.attackerFlashedBy : ctx.defenderFlashedBy) === void 0) return false;
  if (when.clutch && !d.clutch) return false;
  if (when.trade && !flags.trade) return false;
  if (when.range && ctx.range !== when.range) return false;
  if (when.retake && ctx.retakeProT !== (role === "A" ? "D" : "A")) return false;
  if (when.postplant && ctx.retakeProT !== role) return false;
  if (when.pistol && !flags.pistol) return false;
  if (when.numbers === "up" && ctx.numbersAdvantage !== role) return false;
  if (when.numbers === "down" && ctx.numbersAdvantage !== (role === "A" ? "D" : "A")) return false;
  if (when.firstDuel && !flags.firstDuel) return false;
  if (when.atSite && !flags.atSite) return false;
  return true;
}
function attrPart(d, role, ctx, triggered) {
  let a = d.attrs;
  let rawScore = 0;
  if (d.conditionals && d.conditionals.length) {
    let bonus = null;
    for (const c of d.conditionals) {
      if (!conditionMatches(c.when, role, d, ctx)) continue;
      triggered.push(c.source);
      if (c.attr === "score") rawScore += c.value;
      else {
        bonus ??= {};
        bonus[c.attr] = (bonus[c.attr] ?? 0) + c.value;
      }
    }
    if (bonus) {
      a = { ...a };
      for (const k of Object.keys(bonus)) a[k] = a[k] + (bonus[k] ?? 0);
    }
  }
  const positional = role === "A" ? DUEL.W_PEEK * a.peek : DUEL.W_TATICO * (d.clutch ? a.mental : a.tatico);
  let score = DUEL.W_MIRA * a.mira + positional + DUEL.W_MOV * a.mov + DUEL.W_UTIL * a.util;
  if (d.clutch) score += DUEL.CLUTCH_MENTAL * a.mental;
  return DUEL.ATTR_SCALE * score + rawScore;
}
function commonPart(d, ctx) {
  let s = d.weapon.rangeMod[ctx.range];
  if (!d.armor) s += DUEL.NO_ARMOR;
  s -= DUEL.HP_PENALTY_PER_POINT * (100 - d.hp);
  if (ctx.inSmoke) s += DUEL.SMOKE_PENALTY;
  return s;
}
function duelScores(a, d, ctx) {
  const triggered = { A: [], D: [] };
  let scoreA = attrPart(a, "A", ctx, triggered.A) + commonPart(a, ctx);
  let scoreD = attrPart(d, "D", ctx, triggered.D) + commonPart(d, ctx);
  if (ctx.defenderHoldingAngle) scoreD += DUEL.HOLD_ANGLE;
  if (ctx.attackerFlashedBy !== void 0) scoreA -= DUEL.FLASH_PENALTY * (ctx.attackerFlashedBy / 100);
  if (ctx.defenderFlashedBy !== void 0) scoreD -= DUEL.FLASH_PENALTY * (ctx.defenderFlashedBy / 100);
  if (ctx.retakeProT === "A") scoreA += DUEL.RETAKE_PRO_T;
  if (ctx.retakeProT === "D") scoreD += DUEL.RETAKE_PRO_T;
  if (ctx.numbersAdvantage === "A") scoreA += DUEL.NUMBERS;
  if (ctx.numbersAdvantage === "D") scoreD += DUEL.NUMBERS;
  return { scoreA, scoreD, triggered };
}
function winProbability(scoreA, scoreD) {
  return 1 / (1 + Math.pow(10, (scoreD - scoreA) / DUEL.LOGISTIC_DIVISOR));
}
function headshotChance(mira) {
  return DUEL.HS_BASE + DUEL.HS_MIRA * (mira / 100);
}
function retreatChance(mov) {
  return DUEL.RETREAT_BASE + DUEL.RETREAT_MOV * (mov / 100);
}
function tradeChance(nextAllyPeek) {
  return DUEL.TRADE_BASE + DUEL.TRADE_PEEK * (nextAllyPeek / 100);
}
function resolveDuel(a, d, ctx, rng) {
  const { scoreA, scoreD, triggered } = duelScores(a, d, ctx);
  const pWin = winProbability(scoreA, scoreD);
  const aWins = rng.chance(pWin);
  const winner = aWins ? a : d;
  const loser = aWins ? d : a;
  const headshot = rng.chance(headshotChance(winner.attrs.mira));
  const canRetreat = loser.hp > DUEL.RETREAT_MIN_HP;
  const anchorBonus = loser === d && ctx.defenderFlags?.atSite ? d.siteSurvival ?? 0 : 0;
  const loserSurvived = canRetreat && rng.chance(retreatChance(loser.attrs.mov) + anchorBonus + (ctx.retreatBonus ?? 0));
  const damage = loserSurvived ? Math.min(loser.hp - 1, rng.int(20, 70)) : loser.hp;
  return { winner: aWins ? "A" : "D", pWin, headshot, loserSurvived, damage, triggered };
}

// packages/engine/src/rating.ts
var RATING = {
  IMPACT_KPR: 2.13,
  // [v0]
  IMPACT_APR: 0.42,
  // [v0]
  IMPACT_CONST: -0.41,
  // [v0]
  KAST: 73e-4,
  // [v0]  KAST in percent (0–100)
  KPR: 0.3591,
  // [v0]
  DPR: -0.5329,
  // [v0]
  IMPACT: 0.2372,
  // [v0]
  ADR: 32e-4,
  // [v0]
  /**
   * [v1] Public HLTV 2.0 coefficients kept as-is. The per-match std across
   * players is ~0.32 by nature (multi-kill distribution matches real CS); the
   * GDD 5.8 gate was widened to 0.25–0.35 instead of compressing the scale.
   */
  CONST: 0.1587
};
function impact(kpr, apr) {
  return RATING.IMPACT_KPR * kpr + RATING.IMPACT_APR * apr + RATING.IMPACT_CONST;
}
function ratingBreakdown(input) {
  const rounds = Math.max(1, input.rounds);
  const kpr = input.kills / rounds;
  const dpr = input.deaths / rounds;
  const apr = input.assists / rounds;
  const adr = input.damage / rounds;
  const kast = input.kastRounds / rounds * 100;
  const imp = impact(kpr, apr);
  const rating = RATING.KAST * kast + RATING.KPR * kpr + RATING.DPR * dpr + RATING.IMPACT * imp + RATING.ADR * adr + RATING.CONST;
  return { kpr, dpr, apr, adr, kast, impact: imp, rating: Math.max(0, rating) };
}
function matchRating(input) {
  return ratingBreakdown(input).rating;
}
function displayRating(r) {
  return Math.round(r * 100) / 100;
}

// packages/engine/src/data/botnames.ts
var BOT_NICKS = [
  "kr0nik",
  "pl4ntado",
  "n1troh",
  "ecoFr4g",
  "xandeer",
  "b0ltz",
  "jotaP\xEA",
  "cleitin",
  "z4ph",
  "murph",
  "cabr4l",
  "toddyn",
  "guiz1n",
  "mateuz",
  "kuk4",
  "raf1nha",
  "vitorsz",
  "dud4",
  "th1agoo",
  "bielzin",
  "l4dino",
  "pedrok",
  "sn1per_br",
  "flashb4ng",
  "r3take",
  "lurkzin",
  "ancoraum",
  "igl_z\xE9",
  "p1stoleiro",
  "clutchmaster",
  "wallb4ng",
  "n1nja",
  "boostzin",
  "smokezera",
  "mollyzin",
  "ecoking",
  "saveiro",
  "forcebuy",
  "pist0lz",
  "catw4lk",
  "tunelz",
  "longzin",
  "midking",
  "bombsiteB",
  "rotat0r",
  "defus4",
  "kitless",
  "headshotz",
  "sprayzin",
  "tapzin",
  "pr3fire",
  "crosshairz",
  "ninjadefuse",
  "baitzin",
  "entryboy",
  "tradez",
  "awpzin",
  "scoutzera",
  "deaglezin",
  "glockzera"
];
var BOT_TEAM_NAMES = [
  "Gamb\xE1 Gaming",
  "Tucano Team",
  "Pastel eSports",
  "Mandioca Squad",
  "Capivara Clan",
  "Arara Azul",
  "Jacar\xE9 Esports",
  "Boto Rosa",
  "Canga\xE7o Gaming",
  "Xavante eSports",
  "Lobo-Guar\xE1",
  "On\xE7a Pintada",
  "Tamandu\xE1 Tactics",
  "Quati Squad",
  "Muriqui Gaming",
  "Guar\xE1 Vermelho"
];

// packages/engine/src/bots.ts
var BOT_SPREAD = 8;
var BOT_CLASSES = ["igl", "awper", "entry", "rifler", "anchor"];
var CLASS_FLAVOR = {
  entry: { up: ["peek", "mira"], down: ["tatico", "util"] },
  igl: { up: ["tatico", "mental"], down: ["peek", "mira"] },
  awper: { up: ["mira", "mov"], down: ["util", "peek"] },
  anchor: { up: ["tatico", "mental"], down: ["peek", "mov"] },
  rifler: { up: ["mira", "mov"], down: ["util", "mental"] },
  support: { up: ["util", "tatico"], down: ["mira", "peek"] },
  star: { up: ["mira", "mental"], down: ["util", "tatico"] }
};
var CLASS_FLAVOR_AMOUNT = 3;
function generateBotAttrs(rng, targetAvg, spread, cls, flavor = true) {
  const attrs = {};
  for (const k of ATTR_KEYS) attrs[k] = targetAvg + rng.int(-spread, spread);
  if (flavor) {
    const f = CLASS_FLAVOR[cls];
    for (const k of f.up) attrs[k] += CLASS_FLAVOR_AMOUNT;
    for (const k of f.down) attrs[k] -= CLASS_FLAVOR_AMOUNT;
  }
  for (const k of ATTR_KEYS) attrs[k] = clampAttr(Math.round(attrs[k]));
  return attrs;
}
function generateBotTeam(opts) {
  const { rng, targetAvg, idPrefix } = opts;
  const spread = opts.spread ?? BOT_SPREAD;
  const classes = opts.classes ?? BOT_CLASSES;
  const nicks = rng.shuffle(BOT_NICKS);
  const name = opts.name ?? rng.pick(BOT_TEAM_NAMES);
  const players = classes.map(
    (cls, i) => makePlayer(`${idPrefix}${i + 1}`, nicks[i], cls, generateBotAttrs(rng, targetAvg, spread, cls, opts.flavor ?? true))
  );
  return { id: idPrefix, name, players };
}
function generateBotMatchup(rng, targetAvgA, targetAvgB, spread) {
  const names = rng.shuffle(BOT_TEAM_NAMES);
  const nicks = rng.shuffle(BOT_NICKS);
  const build = (prefix, avg, name, nickOffset) => ({
    id: prefix,
    name,
    players: BOT_CLASSES.map(
      (cls, i) => makePlayer(`${prefix}${i + 1}`, nicks[nickOffset + i], cls, generateBotAttrs(rng, avg, spread ?? BOT_SPREAD, cls))
    )
  });
  return [build("a", targetAvgA, names[0], 0), build("b", targetAvgB, names[1], 5)];
}

// packages/engine/src/map.ts
function shortestPath(map, from, to) {
  if (from === to) return { path: [from], time: 0 };
  const dist = /* @__PURE__ */ new Map();
  const prev = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  dist.set(from, 0);
  const neighbors = adjacency(map);
  while (true) {
    let current = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null) return null;
    if (current === to) break;
    visited.add(current);
    for (const edge of neighbors.get(current) ?? []) {
      const nd = best + edge.time;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, current);
      }
    }
  }
  const path = [to];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur);
    if (p === void 0) return null;
    path.unshift(p);
    cur = p;
  }
  return { path, time: dist.get(to) ?? 0 };
}
var ADJ_CACHE = /* @__PURE__ */ new WeakMap();
function adjacency(map) {
  let adj = ADJ_CACHE.get(map);
  if (adj) return adj;
  adj = /* @__PURE__ */ new Map();
  for (const r of map.routes) {
    if (!adj.has(r.from)) adj.set(r.from, []);
    if (!adj.has(r.to)) adj.set(r.to, []);
    adj.get(r.from).push({ to: r.to, time: r.time, range: r.range });
    adj.get(r.to).push({ to: r.from, time: r.time, range: r.range });
  }
  ADJ_CACHE.set(map, adj);
  return adj;
}
function area(map, id) {
  const a = map.areas.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown area '${id}' on map '${map.id}'`);
  return a;
}
function areaRange(map, id) {
  return area(map, id).range;
}
function validateMap(map) {
  const ids = /* @__PURE__ */ new Set();
  for (const a of map.areas) {
    if (ids.has(a.id)) throw new Error(`Duplicate area '${a.id}'`);
    ids.add(a.id);
    if (a.polygon.length < 3) throw new Error(`Area '${a.id}' needs >= 3 points`);
    for (const [x, y] of a.polygon) {
      if (x < 0 || y < 0 || x > map.radar.w || y > map.radar.h) throw new Error(`Area '${a.id}' point outside radar`);
    }
  }
  for (const r of map.routes) {
    if (!ids.has(r.from) || !ids.has(r.to)) throw new Error(`Route ${r.from}->${r.to} references unknown area`);
    if (r.time <= 0) throw new Error(`Route ${r.from}->${r.to} must take time`);
  }
  const check = (id, what) => {
    if (!ids.has(id)) throw new Error(`${what} references unknown area '${id}'`);
  };
  check(map.spawns.CT, "CT spawn");
  check(map.spawns.T, "T spawn");
  check(map.mid.t, "mid.t");
  check(map.mid.ct, "mid.ct");
  check(map.mid.contact, "mid.contact");
  for (const site of ["A", "B"]) {
    const s = map.sites[site];
    check(s.plant, `site ${site} plant`);
    check(s.forward, `site ${site} forward`);
    s.entrances.forEach((e) => check(e, `site ${site} entrance`));
    s.holds.forEach((h) => check(h, `site ${site} hold`));
    for (const side of ["CT", "T"]) {
      if (!shortestPath(map, map.spawns[side], s.plant)) throw new Error(`${side} spawn cannot reach site ${site}`);
    }
  }
}

// packages/engine/src/round.ts
var ROUND = {
  FREEZETIME: 5,
  // [v1] buying phase; the 1:55 clock starts after it
  TIME: 115,
  // [v0] 1:55
  BOMB_TIMER: 40,
  // [v0]
  PLANT_TIME: 3,
  // [v0]
  SITE_CLEAR_TIME: 2,
  // [v0] clearing corners before the plant starts
  PLANT_DROPPED_EXTRA: 3,
  // [v0] carrier died: someone else has to pick the bomb
  DEFUSE_TIME: 10,
  // [v0]
  DEFUSE_TIME_KIT: 5,
  // [v0]
  /** Route time multiplier = SPEED_SLOW − (SPEED_SLOW − SPEED_FAST) · mov/100 */
  SPEED_SLOW: 1.1,
  // [v0]
  SPEED_FAST: 0.9,
  // [v0]
  RUSH_JITTER: 3,
  // [v0]
  SPLIT_EXEC: 40,
  // [v0] GDD: execution starts at 40–75s
  SPLIT_EXEC_JITTER: 10,
  // [v0]
  DEFAULT_DECIDE: 38,
  // [v0] when a default picks its site
  DEFAULT_DECIDE_JITTER: 8,
  // [v0]
  FAKE_EXEC: 60,
  // [v0]
  FAKE_EXEC_JITTER: 8,
  // [v0]
  FORWARD_FALLBACK: 35,
  // [v0] aggressive CTs fall back to site by this time
  MID_DUEL_CHANCE: 0.7,
  // [v0]
  FORWARD_DUEL_CHANCE: 0.8,
  // [v0]
  CONTACTS_PER_CT: 2,
  // [v0]
  /** CT reaction to a hit: REACTION_BASE + REACTION_TATICO · (1 − tatico/100) */
  REACTION_BASE: 1,
  // [v0]
  REACTION_TATICO: 4,
  // [v0]
  LATE_ROTATOR_DELAY: 4,
  // [v0] one far-site CT stays for info
  /** P(IGL reads the CT setup) = READ_BASE + READ_TATICO · tatico/100 */
  READ_BASE: 0.15,
  // [v0]
  READ_TATICO: 0.4,
  // [v0]
  NO_IGL_BAD_PICK: 0.6,
  // [v0] without IGL: chance to hit the stacked site
  DUEL_GAP_MIN: 2,
  // [v0]
  DUEL_GAP_MAX: 6,
  // [v0]
  RETREAT_REJOIN_T: 18,
  // [v0] seconds until a retreated T re-engages
  RETREAT_REJOIN_CT: 6,
  // [v0]
  RETAKE_LATEST: 20,
  // [v0] CTs stop waiting for teammates this many seconds before the bomb goes off
  /** P(save) when outnumbered = SAVE_BASE + SAVE_TATICO · tatico/100 */
  SAVE_BASE: 0.3,
  // [v0]
  SAVE_TATICO: 0.4,
  // [v0]
  WEAPON_PICKUP: 0.7,
  // [v0]
  /** The loser of a duel lands some damage before dying/retreating (feeds assists and ADR). */
  CHIP_CHANCE: 0.2,
  // [v1]
  MOLOTOV_USE: 0.5,
  // [v1] chance a Support/Rifler with a molotov throws it on the first site contact
  MOLOTOV_DMG_MIN: 20,
  // [v1]
  MOLOTOV_DMG_MAX: 40,
  // [v1]
  /** P(reposition instead of taking the burn) = MOLOTOV_MOVE_BASE + MOLOTOV_MOVE_TATICO · tatico/100 */
  MOLOTOV_MOVE_BASE: 0.3,
  // [v1]
  MOLOTOV_MOVE_TATICO: 0.5,
  // [v1]
  HE_USE: 0.5,
  // [v1]
  HE_DMG_MIN: 20,
  // [v1]
  HE_DMG_MAX: 50,
  // [v1]
  CHIP_MIN: 10,
  // [v1]
  CHIP_MAX: 60,
  // [v1]
  FLASH_ASSIST: 0.7,
  // [v0]
  FLASH_USE: 0.3,
  // [v0] chance a side pops a flash for a duel when it has one
  SMOKE_DUEL: 0.5,
  // [v0]
  CT_DEFAULT: 0.65,
  // [v0]
  CT_STACK_READ: 0.1,
  // [v0] toward the site T hit last round (scaled by tatico)
  CT_STACK_OTHER: 0.05,
  // [v0]
  CT_AGGRESSIVE: 0.2,
  // [v0]
  ECO_STACK: 0.8,
  // [v0] CT on eco stacks one site
  RUSH_WHEN_POOR: 0.8,
  // [v0]
  RUSH_WHEN_RICH: 0.3,
  // [v0]
  FAKE_CHANCE: 0.1,
  // [v0]
  SPLIT_VS_DEFAULT: 0.5
  // [v0]
};
var T_ATTACK_ORDER = ["entry", "star", "rifler", "awper", "support", "igl", "anchor"];
var CT_RETAKE_ORDER = ["entry", "star", "rifler", "awper", "support", "igl", "anchor"];
var DEFEND_ORDER = ["rifler", "entry", "star", "support", "awper", "igl", "anchor"];
function orderBy(list, order) {
  return list.slice().sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls));
}
function nextUp(list, order) {
  return list.slice().sort((a, b) => a.engagements - b.engagements || order.indexOf(a.cls) - order.indexOf(b.cls))[0];
}
function simulateRound(params) {
  const { map, rng, round } = params;
  const deadline = ROUND.FREEZETIME + ROUND.TIME;
  let duelCounter = 0;
  const events = [];
  const emit2 = (e) => events.push(e);
  const iglOf = (team) => team.players.find((p) => p.base.class === "igl");
  const noIgl = { CT: !iglOf(params.ct), T: !iglOf(params.t) };
  const mkLive2 = (rp, side) => {
    const attrs = effectiveAttrs(rp.base, { mental: rp.mental, noIgl: noIgl[side] });
    return {
      rp,
      side,
      cls: rp.base.class,
      attrs,
      build: resolveBuild(rp.base.build),
      cardTriggers: {},
      hp: 100,
      alive: true,
      area: map.spawns[side],
      speed: ROUND.SPEED_SLOW - (ROUND.SPEED_SLOW - ROUND.SPEED_FAST) * (attrs.mov / 100),
      readyAt: 0,
      retreated: false,
      moved: false,
      saving: false,
      post: "mid",
      atSite: false,
      forward: false,
      contactsLeft: ROUND.CONTACTS_PER_CT,
      flashes: 0,
      smokes: 0,
      molotovs: 0,
      hes: 0,
      damagedBy: [],
      carrier: false,
      engagements: 0,
      kills: 0,
      assists: 0,
      flashAssists: 0,
      headshots: 0,
      damage: 0,
      traded: false,
      entryKill: false,
      entryDeath: false,
      planted: false,
      defused: false,
      clutchAttempt: false,
      clutchVs: 0
    };
  };
  const cts = params.ct.players.map((p) => mkLive2(p, "CT"));
  const ts = params.t.players.map((p) => mkLive2(p, "T"));
  const bySide = { CT: cts, T: ts };
  const teamIndex = { CT: params.ct.index, T: params.t.index };
  const decisionTatico = (side) => {
    const list = bySide[side];
    const setBonus = Math.max(0, ...list.map((l) => l.build.teamTatico));
    const igl = list.find((l) => l.cls === "igl");
    if (igl) return Math.min(100, igl.attrs.tatico + setBonus);
    return Math.min(100, list.reduce((s, l) => s + l.attrs.tatico, 0) / list.length + setBonus);
  };
  const buy = { CT: "eco", T: "eco" };
  for (const side of ["CT", "T"]) {
    const team = side === "CT" ? params.ct : params.t;
    buy[side] = params.forceBuy?.[side] ?? decideTeamBuy(
      {
        side,
        players: team.players.map((p) => ({ money: p.money, inv: p.inv })),
        lossStreak: team.lossStreak,
        tatico: decisionTatico(side),
        pistol: params.pistol
      },
      rng
    );
  }
  const money = {};
  for (const l of [...cts, ...ts]) money[l.rp.id] = l.rp.money;
  emit2({
    type: "roundStart",
    round,
    t: 0,
    score: [params.score[0], params.score[1]],
    sides: { CT: teamIndex.CT, T: teamIndex.T },
    money,
    buy: { ...buy },
    pistol: params.pistol,
    freezetimeEnd: ROUND.FREEZETIME
  });
  for (const side of ["CT", "T"]) {
    const list = bySide[side].slice().sort((a, b) => (a.cls === "awper" ? -1 : 0) - (b.cls === "awper" ? -1 : 0));
    let teamHasAwp = list.some((l) => l.rp.inv.weapon === "awp");
    list.forEach((l, i) => {
      const purchase = buyForPlayer(
        { side, money: l.rp.money, inv: l.rp.inv, class: l.cls, decision: buy[side], teamHasAwp, behaviors: l.build.behaviors, afterPistol: params.afterPistol ?? false },
        rng
      );
      l.rp.money = addMoney(l.rp.money, -purchase.spent);
      l.rp.inv = purchase.inv;
      if (purchase.inv.weapon === "awp") teamHasAwp = true;
      l.flashes = purchase.inv.utils.filter((u) => u === "flash").length;
      l.smokes = purchase.inv.utils.filter((u) => u === "smoke").length;
      l.molotovs = purchase.inv.utils.filter((u) => u === "molotov").length;
      l.hes = purchase.inv.utils.filter((u) => u === "he").length;
      {
        emit2({
          type: "buy",
          round,
          t: Math.min(ROUND.FREEZETIME - 1, 1 + i),
          player: l.rp.id,
          weapon: purchase.inv.weapon,
          armor: purchase.inv.armor,
          helmet: purchase.inv.helmet,
          kit: purchase.inv.kit,
          utils: [...purchase.inv.utils],
          spent: purchase.spent
        });
      }
    });
  }
  const ctIgl = cts.find((l) => l.cls === "igl");
  const tIgl = ts.find((l) => l.cls === "igl");
  const setup = chooseCTSetup(rng, ctIgl, params.prevTCall, buy.CT);
  const { call, target } = chooseTCall(rng, tIgl, setup, buy.T, buy.CT === "eco");
  emit2({ type: "call", round, t: ROUND.FREEZETIME, side: "CT", call: setup, ...ctIgl ? { caller: ctIgl.rp.id } : {} });
  emit2({ type: "call", round, t: ROUND.FREEZETIME, side: "T", call, ...tIgl ? { caller: tIgl.rp.id } : {} });
  const site = map.sites[target];
  const otherSite = target === "A" ? "B" : "A";
  const move = (l, to, startT) => {
    const path = shortestPath(map, l.area, to);
    if (!path || path.path.length < 2) return startT;
    let t2 = startT;
    for (let i = 0; i < path.path.length - 1; i++) {
      const from = path.path[i];
      const next = path.path[i + 1];
      const leg = shortestPath(map, from, next).time;
      const duration = Math.max(1, Math.round(leg * l.speed));
      emit2({ type: "move", round, t: Math.round(t2), player: l.rp.id, from, to: next, duration });
      t2 += duration;
    }
    l.area = to;
    return Math.round(t2);
  };
  assignCTs(cts, setup, buy.CT === "eco");
  for (const c of cts) {
    const pos = c.forward ? map.sites[c.post].forward : c.post === "mid" ? map.mid.ct : ctHold(c, cts, map);
    c.readyAt = move(c, pos, ROUND.FREEZETIME);
    c.atSite = c.post === target && !c.forward;
  }
  const tOrdered = orderBy(ts, T_ATTACK_ORDER);
  const carrier = ts.find((l) => l.cls === "support") ?? ts.find((l) => l.cls === "rifler") ?? tOrdered[tOrdered.length - 1];
  carrier.carrier = true;
  const plans = /* @__PURE__ */ new Map();
  const stops = [];
  const stage = (l, via, start, execT) => {
    start += ROUND.FREEZETIME;
    execT += ROUND.FREEZETIME;
    stops.push(...pathStops(map, l, map.spawns.T, via, start));
    const viaT = move(l, via, start);
    plans.set(l, { via, viaT, execT });
  };
  if (call === "rushA" || call === "rushB") {
    for (const l of ts) stage(l, site.entrances[0], rng.int(0, ROUND.RUSH_JITTER), 0);
  } else if (call === "splitA" || call === "splitB") {
    const exec = ROUND.SPLIT_EXEC + rng.int(0, ROUND.SPLIT_EXEC_JITTER);
    tOrdered.forEach((l, i) => stage(l, site.entrances[i < 3 ? 0 : 1], rng.int(0, 3), exec + rng.int(0, 3)));
  } else if (call === "default") {
    const decide = ROUND.DEFAULT_DECIDE + rng.int(0, ROUND.DEFAULT_DECIDE_JITTER);
    const lane = preArea(map, site.entrances[0]);
    const otherLane = preArea(map, map.sites[otherSite].entrances[0]);
    const lanes = [map.mid.contact, map.mid.contact, lane, otherLane, lane];
    tOrdered.forEach((l, i) => stage(l, lanes[i], rng.int(0, 3), decide + rng.int(0, 4)));
  } else {
    const fakeSite = map.sites[otherSite];
    const exec = ROUND.FAKE_EXEC + rng.int(0, ROUND.FAKE_EXEC_JITTER);
    const fakeLane = preArea(map, fakeSite.entrances[0]);
    for (const l of ts) stage(l, fakeLane, rng.int(0, 3), exec + rng.int(0, 3));
    const seenAt = Math.min(...[...plans.values()].map((p) => p.viaT));
    const realDefenders = cts.filter((c) => c.post === target && !c.forward);
    if (realDefenders.length >= 2) {
      const pulled = orderBy(realDefenders, DEFEND_ORDER)[0];
      const react = Math.round(seenAt + reaction(decisionTatico("CT")));
      const there = move(pulled, fakeSite.plant, react);
      pulled.atSite = false;
      pulled.moved = true;
      pulled.post = otherSite;
      pulled.readyAt = there;
    }
  }
  let lastKillT = 0;
  let firstKillDone = false;
  const lastDeath = { CT: -Infinity, T: -Infinity };
  const alive = (side) => bySide[side].filter((l) => l.alive);
  const duelist2 = (l, clutch2) => ({
    attrs: l.attrs,
    weapon: weapon(l.rp.inv.weapon),
    armor: l.rp.inv.armor,
    hp: l.hp,
    clutch: clutch2,
    conditionals: l.build.conditionals,
    siteSurvival: l.build.siteSurvival
  });
  const applySaves = (list, t2) => {
    for (const l of list) {
      if (!l.alive || l.saving || !l.build.behaviors.has("save_1v3")) continue;
      if (alive(l.side).length === 1 && alive(l.side === "CT" ? "T" : "CT").length >= 3) {
        l.saving = true;
        move(l, map.spawns[l.side], t2);
      }
    }
  };
  const isClutch = (l) => alive(l.side).length === 1 && alive(l.side === "CT" ? "T" : "CT").length >= 2;
  const markClutch = (l) => {
    if (!l.clutchAttempt && isClutch(l)) {
      l.clutchAttempt = true;
      l.clutchVs = alive(l.side === "CT" ? "T" : "CT").length;
    }
  };
  const bestThrower = (list) => {
    let best;
    for (const l of list) if (l.flashes > 0 && (!best || l.attrs.util > best.attrs.util)) best = l;
    return best;
  };
  const kill = (killer, victim, t2, area2, trade, headshot, duel) => {
    const w = weapon(killer.rp.inv.weapon);
    emit2({ type: "damage", round, t: t2, attacker: killer.rp.id, victim: victim.rp.id, amount: victim.hp, weapon: w.id, area: area2, duel });
    killer.damage += victim.hp;
    emit2({ type: "kill", round, t: t2, attacker: killer.rp.id, victim: victim.rp.id, weapon: w.id, headshot, area: area2, duel, ...trade ? { trade: true } : {} });
    victim.alive = false;
    victim.hp = 0;
    lastDeath[victim.side] = Math.max(lastDeath[victim.side], t2);
    killer.kills++;
    if (headshot) killer.headshots++;
    killer.rp.money = addMoney(killer.rp.money, w.killReward);
    lastKillT = Math.max(lastKillT, t2);
    if (!firstKillDone) {
      firstKillDone = true;
      killer.entryKill = true;
      victim.entryDeath = true;
    }
    const helper = victim.damagedBy.filter((id) => id !== killer.rp.id).pop();
    if (helper) {
      const h = [...cts, ...ts].find((l) => l.rp.id === helper);
      if (h && h.side === killer.side) {
        h.assists++;
        emit2({ type: "assist", round, t: t2, player: h.rp.id, victim: victim.rp.id });
      }
    }
    if (victim.flashedBy && victim.flashedBy !== killer && victim.flashedBy.side === killer.side && (victim.flashedBy.build.flashAssistSure || rng.chance(ROUND.FLASH_ASSIST))) {
      victim.flashedBy.flashAssists++;
      emit2({ type: "flashAssist", round, t: t2, player: victim.flashedBy.rp.id, victim: victim.rp.id });
    }
    victim.flashedBy = void 0;
    const vw = weapon(victim.rp.inv.weapon);
    if (vw.tier > w.tier && rng.chance(ROUND.WEAPON_PICKUP)) {
      killer.rp.inv = { ...killer.rp.inv, weapon: vw.id };
      victim.rp.inv = { ...victim.rp.inv, weapon: "knife" };
    }
  };
  const burn = (thrower, target2, amount, t2, area2) => {
    const dmg = Math.min(target2.hp - 1, amount);
    if (dmg <= 0) return;
    emit2({ type: "damage", round, t: t2, attacker: thrower.rp.id, victim: target2.rp.id, amount: dmg, weapon: thrower.rp.inv.weapon, area: area2 });
    target2.hp -= dmg;
    target2.damagedBy.push(thrower.rp.id);
    thrower.damage += dmg;
  };
  const sidestep = (l, t2) => {
    const fallback = l.side === "CT" ? ctFallback(l, map) : site.entrances[0];
    const path = shortestPath(map, l.area, fallback);
    const hop = path?.path[1];
    if (!hop) return;
    const home = l.area;
    const there = move(l, hop, t2);
    move(l, home, there);
  };
  const useGrenades = (throwers, targets, t2, area2) => {
    const live = targets.filter((l) => l.alive);
    if (live.length === 0) return;
    const molly = throwers.find((l) => l.molotovs > 0 && (l.cls === "support" || l.cls === "rifler"));
    if (molly && rng.chance(ROUND.MOLOTOV_USE)) {
      molly.molotovs--;
      emit2({ type: "util", round, t: Math.max(0, t2 - 2), player: molly.rp.id, util: "molotov", area: area2 });
      for (const target2 of live) {
        if (rng.chance(ROUND.MOLOTOV_MOVE_BASE + ROUND.MOLOTOV_MOVE_TATICO * (target2.attrs.tatico / 100))) {
          target2.moved = true;
          sidestep(target2, Math.max(0, t2 - 2));
        } else burn(molly, target2, rng.int(ROUND.MOLOTOV_DMG_MIN, ROUND.MOLOTOV_DMG_MAX), t2 - 1, area2);
      }
    }
    const he = throwers.find((l) => l.hes > 0);
    if (he && rng.chance(ROUND.HE_USE)) {
      he.hes--;
      emit2({ type: "util", round, t: Math.max(0, t2 - 1), player: he.rp.id, util: "he", area: area2 });
      const hit = rng.shuffle(live).slice(0, rng.int(1, 2));
      for (const target2 of hit) burn(he, target2, rng.int(ROUND.HE_DMG_MIN, ROUND.HE_DMG_MAX), t2 - 1, area2);
    }
  };
  const fight2 = (a, d, t2, o) => {
    if (o.firstAtSite) {
      useGrenades(o.presentA, o.presentD, t2, o.area);
      useGrenades(o.presentD, o.presentA, t2, o.area);
    }
    const flagsA = { trade: t2 - lastDeath[a.side] <= 3, firstDuel: a.engagements === 0, pistol: params.pistol };
    const flagsD = { firstDuel: d.engagements === 0, atSite: o.defenderHoldingAngle && o.retakeProT === null, pistol: params.pistol };
    a.engagements++;
    d.engagements++;
    markClutch(a);
    markClutch(d);
    const duelId = `r${round}d${++duelCounter}`;
    const ctx = {
      attackerFlags: flagsA,
      defenderFlags: flagsD,
      range: areaRange(map, o.area),
      defenderHoldingAngle: o.defenderHoldingAngle && !d.moved,
      inSmoke: false,
      retakeProT: o.retakeProT,
      // "2v1": the side with more players alive in the round (GDD 5.5).
      numbersAdvantage: alive(a.side).length > alive(d.side).length ? "A" : alive(d.side).length > alive(a.side).length ? "D" : null
    };
    const aThrower = bestThrower(o.presentA);
    if (aThrower && rng.chance(ROUND.FLASH_USE)) {
      aThrower.flashes--;
      ctx.defenderFlashedBy = Math.min(100, aThrower.attrs.util * aThrower.build.utilMult);
      d.flashedBy = aThrower;
      emit2({ type: "util", round, t: Math.max(0, t2 - 1), player: aThrower.rp.id, util: "flash", area: o.area });
    }
    const dThrower = bestThrower(o.presentD);
    if (dThrower && rng.chance(ROUND.FLASH_USE)) {
      dThrower.flashes--;
      ctx.attackerFlashedBy = Math.min(100, dThrower.attrs.util * dThrower.build.utilMult);
      a.flashedBy = dThrower;
      emit2({ type: "util", round, t: Math.max(0, t2 - 1), player: dThrower.rp.id, util: "flash", area: o.area });
    }
    if (o.firstAtSite) {
      const smoker = o.presentA.find((l) => l.smokes > 0);
      if (smoker && rng.chance(ROUND.SMOKE_DUEL)) {
        smoker.smokes--;
        ctx.inSmoke = true;
        emit2({ type: "util", round, t: Math.max(0, t2 - 2), player: smoker.rp.id, util: "smoke", area: o.area });
      }
    }
    const clutchA = isClutch(a);
    const clutchD = isClutch(d);
    emit2({
      type: "duel",
      round,
      t: Math.round(Math.max(0, t2 - 0.8) * 10) / 10,
      id: duelId,
      attacker: a.rp.id,
      defender: d.rp.id,
      area: o.area,
      range: ctx.range,
      situation: {
        holdingAngle: ctx.defenderHoldingAngle,
        attackerFlashed: ctx.attackerFlashedBy !== void 0,
        defenderFlashed: ctx.defenderFlashedBy !== void 0,
        inSmoke: ctx.inSmoke,
        retakeProT: ctx.retakeProT,
        numbers: ctx.numbersAdvantage,
        clutch: clutchA ? "A" : clutchD ? "D" : null
      }
    });
    const res = resolveDuel(duelist2(a, clutchA), duelist2(d, clutchD), ctx, rng);
    const winner2 = res.winner === "A" ? a : d;
    const loser = res.winner === "A" ? d : a;
    if (res.triggered.A.length || res.triggered.D.length) {
      const last = events[events.length - 1];
      if (last && last.type === "duel" && last.id === duelId) {
        last.triggered = {};
        if (res.triggered.A.length) last.triggered[a.rp.id] = res.triggered.A;
        if (res.triggered.D.length) last.triggered[d.rp.id] = res.triggered.D;
      }
      for (const s of res.triggered.A) a.cardTriggers[s] = (a.cardTriggers[s] ?? 0) + 1;
      for (const s of res.triggered.D) d.cardTriggers[s] = (d.cardTriggers[s] ?? 0) + 1;
    }
    if (winner2.hp > 1 && rng.chance(ROUND.CHIP_CHANCE)) {
      const chip = Math.min(winner2.hp - 1, rng.int(ROUND.CHIP_MIN, ROUND.CHIP_MAX));
      emit2({ type: "damage", round, t: t2, attacker: loser.rp.id, victim: winner2.rp.id, amount: chip, weapon: loser.rp.inv.weapon, area: o.area, duel: duelId });
      winner2.hp -= chip;
      winner2.damagedBy.push(loser.rp.id);
      loser.damage += chip;
    }
    if (res.loserSurvived) {
      emit2({ type: "damage", round, t: t2, attacker: winner2.rp.id, victim: loser.rp.id, amount: res.damage, weapon: winner2.rp.inv.weapon, area: o.area, duel: duelId });
      winner2.damage += res.damage;
      loser.hp -= res.damage;
      loser.damagedBy.push(winner2.rp.id);
      loser.retreated = true;
      loser.moved = true;
      loser.flashedBy = void 0;
      const fallback = loser === a ? o.fallbackA : o.fallbackD;
      const back = move(loser, fallback, t2);
      loser.readyAt = Math.max(back, t2 + (loser.side === "T" ? ROUND.RETREAT_REJOIN_T : ROUND.RETREAT_REJOIN_CT));
      return t2;
    }
    kill(winner2, loser, t2, o.area, false, res.headshot, duelId);
    winner2.flashedBy = void 0;
    const mates = (loser === a ? o.presentA : o.presentD).filter((l) => l !== loser && l.alive && !l.retreated);
    const trader = orderBy(mates, loser.side === "T" ? T_ATTACK_ORDER : DEFEND_ORDER)[0];
    if (trader && (loser.build.guaranteedTrade || rng.chance(tradeChance(trader.attrs.peek)))) {
      const tt = t2 + rng.int(1, 3);
      kill(trader, winner2, tt, o.area, true, rng.chance(headshotChance(trader.attrs.mira)), duelId);
      loser.traded = true;
      return tt;
    }
    return t2;
  };
  stops.sort((x, y) => x.t - y.t);
  for (const s of stops) {
    if (!s.l.alive || s.l.retreated) continue;
    let ct;
    let chance = 0;
    if (s.area === map.mid.contact) {
      ct = cts.find((c) => c.alive && !c.retreated && c.post === "mid" && c.contactsLeft > 0 && c.readyAt <= s.t);
      chance = ROUND.MID_DUEL_CHANCE;
    } else {
      ct = cts.find((c) => c.alive && !c.retreated && c.forward && c.area === s.area && c.contactsLeft > 0 && c.readyAt <= s.t);
      chance = ROUND.FORWARD_DUEL_CHANCE;
    }
    if (!ct || !rng.chance(chance)) continue;
    ct.contactsLeft--;
    const tInit = s.l.attrs.peek + rng.int(-20, 20) > ct.attrs.peek + rng.int(-20, 20);
    const tSideAlive = ts.filter((l) => l.alive);
    const near = tSideAlive.filter((l) => l !== s.l && stops.some((o) => o.l === l && o.area === s.area && Math.abs(o.t - s.t) <= 6));
    const opts = {
      area: s.area,
      defenderHoldingAngle: !tInit,
      retakeProT: null,
      presentA: tInit ? [s.l, ...near] : [ct],
      presentD: tInit ? [ct] : [s.l, ...near],
      fallbackA: tInit ? map.spawns.T : ctFallback(ct, map),
      fallbackD: tInit ? ctFallback(ct, map) : map.spawns.T,
      firstAtSite: false
    };
    const tEnd = tInit ? fight2(s.l, ct, s.t, opts) : fight2(ct, s.l, s.t, opts);
    if (s.l.alive && s.l.retreated) {
      s.l.retreated = false;
      const plan = plans.get(s.l);
      plan.via = s.l.area;
      plan.viaT = s.l.readyAt;
    }
    if (ct.alive && ct.retreated) {
      ct.retreated = false;
      ct.readyAt = move(ct, ctHold(ct, cts, map), Math.max(tEnd, ct.readyAt));
      ct.forward = false;
      ct.atSite = ct.post === target;
    }
  }
  for (const c of cts) {
    if (c.alive && c.forward) {
      c.forward = false;
      c.readyAt = move(c, ctHold(c, cts, map), Math.max(c.readyAt, ROUND.FREEZETIME + ROUND.FORWARD_FALLBACK));
      c.atSite = c.post === target;
    }
  }
  for (const l of ts) {
    if (!l.alive) continue;
    const plan = plans.get(l);
    l.readyAt = move(l, site.plant, Math.max(plan.viaT, plan.execT));
  }
  let alerted = false;
  const alertRotations = (t2) => {
    if (alerted) return;
    alerted = true;
    const react = reaction(decisionTatico("CT"));
    let delayed = false;
    for (const c of orderBy(cts, DEFEND_ORDER).reverse()) {
      if (!c.alive || c.atSite) continue;
      let start = Math.round(t2 + react);
      if (c.post === otherSite && !delayed) {
        delayed = true;
        start += ROUND.LATE_ROTATOR_DELAY;
      }
      start = Math.max(start, c.readyAt);
      c.moved = true;
      c.atSite = true;
      c.readyAt = move(c, site.plant, start);
    }
  };
  const presentAttackers = (t2) => ts.filter((l) => l.alive && !l.saving && !l.retreated && l.readyAt <= t2);
  const presentDefenders = (t2) => cts.filter((l) => l.alive && !l.saving && !l.retreated && l.atSite && l.readyAt <= t2);
  let t = Math.min(...ts.map((l) => l.readyAt));
  let planted = false;
  let plantT = 0;
  let reason = null;
  let winner = null;
  let endT = 0;
  let firstAtSite = true;
  const finish = (w, r, at) => {
    winner = w;
    reason = r;
    endT = Math.min(Math.round(at), deadline + ROUND.BOMB_TIMER);
  };
  for (let guard = 0; guard < 400 && !winner; guard++) {
    for (const l of [...ts, ...cts]) if (l.alive && l.retreated && l.readyAt <= t) l.retreated = false;
    if (alive("T").length === 0) {
      finish("CT", "elimination", lastKillT);
      break;
    }
    if (alive("CT").length === 0) {
      finish("T", "elimination", lastKillT);
      break;
    }
    if (t >= deadline) {
      finish("CT", "time", deadline);
      break;
    }
    applySaves(ts, t);
    applySaves(cts, t);
    const pa = presentAttackers(t);
    const pd = presentDefenders(t);
    if (pa.length === 0) {
      const pending = ts.filter((l) => l.alive && !l.saving && l.readyAt > t);
      if (pending.length === 0) {
        finish("CT", "time", deadline);
        break;
      }
      const tAlive = alive("T").length;
      const ctAlive = alive("CT").length;
      const next = Math.min(...pending.map((l) => l.readyAt));
      if (tAlive < ctAlive && tAlive <= 2 && alerted) {
        const tat = decisionTatico("T");
        if (next > deadline - 15 || rng.chance(ROUND.SAVE_BASE + ROUND.SAVE_TATICO * (tat / 100))) {
          for (const l of alive("T")) {
            l.saving = true;
            move(l, map.spawns.T, t);
          }
          finish("CT", "time", deadline);
          break;
        }
      }
      t = Math.max(t + 1, next);
      continue;
    }
    if (pd.length === 0) {
      alertRotations(t);
      const carrierDead = !ts.some((l) => l.alive && l.carrier);
      const plantAt = t + ROUND.SITE_CLEAR_TIME + ROUND.PLANT_TIME + (carrierDead ? ROUND.PLANT_DROPPED_EXTRA : 0);
      if (plantAt >= deadline) {
        finish("CT", "time", deadline);
        break;
      }
      const planter = orderBy(pa, ["support", "rifler", "igl", "anchor", "awper", "star", "entry"])[0];
      emit2({ type: "plant", round, t: plantAt, player: planter.rp.id, site: target });
      planter.planted = true;
      planted = true;
      plantT = plantAt;
      t = plantAt;
      break;
    }
    alertRotations(t);
    const a = nextUp(pa, T_ATTACK_ORDER);
    const d = nextUp(pd, DEFEND_ORDER);
    const tEnd = fight2(a, d, t, {
      area: site.plant,
      defenderHoldingAngle: true,
      retakeProT: null,
      presentA: pa,
      presentD: pd,
      fallbackA: site.entrances[0],
      fallbackD: ctFallback(d, map),
      firstAtSite
    });
    firstAtSite = false;
    t = tEnd + rng.int(ROUND.DUEL_GAP_MIN, ROUND.DUEL_GAP_MAX);
  }
  if (!winner && planted) {
    const explodeAt = plantT + ROUND.BOMB_TIMER;
    for (const l of ts) {
      if (!l.alive) continue;
      l.moved = false;
      if (l.retreated) l.readyAt = Math.min(l.readyAt, plantT + 8);
    }
    const ctAlive = alive("CT");
    const tAlive = alive("T");
    const tat = decisionTatico("CT");
    if (ctAlive.length < tAlive.length && rng.chance(ROUND.SAVE_BASE + ROUND.SAVE_TATICO * (tat / 100))) {
      for (const c of ctAlive) {
        c.saving = true;
        move(c, map.spawns.CT, t);
      }
      finish("T", "bomb", explodeAt);
    }
    const retakers = cts.filter((l) => l.alive && !l.saving);
    const regroupAt = retakers.length ? Math.min(Math.max(...retakers.map((l) => l.readyAt)), explodeAt - ROUND.RETAKE_LATEST) : plantT;
    const presentCT = (at) => at < regroupAt ? [] : cts.filter((l) => l.alive && !l.saving && !l.retreated && l.readyAt <= at);
    const presentT = (at) => ts.filter((l) => l.alive && !l.saving && !l.retreated && l.readyAt <= at);
    t = Math.max(t, plantT + 2);
    let firstRetake = true;
    for (let guard = 0; guard < 400 && !winner; guard++) {
      for (const l of [...ts, ...cts]) if (l.alive && l.retreated && l.readyAt <= t) l.retreated = false;
      if (alive("CT").length === 0) {
        finish("T", "elimination", lastKillT);
        break;
      }
      if (alive("T").length === 0) {
        const defusers = cts.filter((l) => l.alive && !l.saving);
        const kit = defusers.some((l) => l.rp.inv.kit);
        const arrival = Math.max(lastKillT, Math.min(...defusers.map((l) => l.readyAt)));
        const duration = kit ? ROUND.DEFUSE_TIME_KIT : ROUND.DEFUSE_TIME;
        const done = arrival + duration;
        const defuser = defusers.find((l) => l.rp.inv.kit) ?? defusers[0];
        if (arrival < explodeAt) emit2({ type: "defuseStart", round, t: arrival, player: defuser.rp.id, hasKit: kit, duration });
        if (done <= explodeAt) {
          emit2({ type: "defuse", round, t: done, player: defuser.rp.id, site: target, kit });
          defuser.defused = true;
          finish("CT", "defuse", done);
        } else finish("T", "bomb", explodeAt);
        break;
      }
      if (t >= explodeAt) {
        finish("T", "bomb", explodeAt);
        break;
      }
      applySaves(cts, t);
      applySaves(ts, t);
      const pc = presentCT(t);
      const pt = presentT(t);
      if (pc.length === 0) {
        const pending = cts.filter((l) => l.alive && !l.saving && l.readyAt > t).map((l) => l.readyAt);
        const next = Math.max(regroupAt, pending.length ? Math.min(...pending) : 0);
        if (next <= t) {
          finish("T", "bomb", explodeAt);
          break;
        }
        t = Math.max(t + 1, next);
        continue;
      }
      if (pt.length === 0) {
        const kit = pc.some((l) => l.rp.inv.kit);
        const duration = kit ? ROUND.DEFUSE_TIME_KIT : ROUND.DEFUSE_TIME;
        const done = t + duration;
        const defuser = pc.find((l) => l.rp.inv.kit) ?? pc[0];
        emit2({ type: "defuseStart", round, t, player: defuser.rp.id, hasKit: kit, duration });
        const back = ts.filter((l) => l.alive && l.readyAt > t).map((l) => l.readyAt);
        const nextT = back.length ? Math.min(...back) : Infinity;
        if (nextT < done) {
          emit2({ type: "defuseCancel", round, t: nextT, player: defuser.rp.id });
          t = nextT;
          continue;
        }
        if (done <= explodeAt) {
          emit2({ type: "defuse", round, t: done, player: defuser.rp.id, site: target, kit });
          defuser.defused = true;
          finish("CT", "defuse", done);
        } else finish("T", "bomb", explodeAt);
        break;
      }
      const a = nextUp(pc, CT_RETAKE_ORDER);
      const d = nextUp(pt, DEFEND_ORDER);
      const tEnd = fight2(a, d, t, {
        area: site.plant,
        // Post-plant Ts are set up but not on fresh angles: GDD's +5 applies instead.
        defenderHoldingAngle: false,
        retakeProT: "D",
        presentA: pc,
        presentD: pt,
        fallbackA: ctFallback(a, map),
        fallbackD: site.entrances[0],
        firstAtSite: firstRetake
      });
      firstRetake = false;
      t = tEnd + rng.int(ROUND.DUEL_GAP_MIN, ROUND.DUEL_GAP_MAX);
    }
  }
  if (!winner) finish("CT", "time", deadline);
  const finalWinner = winner;
  const finalReason = reason;
  const survivors = [...cts, ...ts].filter((l) => l.alive).map((l) => l.rp.id);
  const stats = {};
  let clutch;
  let ace;
  for (const l of [...cts, ...ts]) {
    const won = l.side === finalWinner;
    const clutchWon = l.clutchAttempt && won && l.alive;
    if (clutchWon) clutch = { player: l.rp.id, vs: l.clutchVs };
    if (l.kills >= 5) ace = l.rp.id;
    stats[l.rp.id] = {
      kills: l.kills,
      died: !l.alive,
      assists: l.assists,
      flashAssists: l.flashAssists,
      headshots: l.headshots,
      damage: l.damage,
      kast: l.kills > 0 || l.assists > 0 || l.alive || l.traded,
      entryKill: l.entryKill,
      entryDeath: l.entryDeath,
      planted: l.planted,
      defused: l.defused,
      clutchAttempt: l.clutchAttempt,
      clutchWon,
      survived: l.alive,
      cardTriggers: l.cardTriggers
    };
  }
  const score = [params.score[0], params.score[1]];
  const winnerTeam = teamIndex[finalWinner];
  score[winnerTeam]++;
  emit2({
    type: "roundEnd",
    round,
    t: endT,
    winner: finalWinner,
    winnerTeam,
    reason: finalReason,
    score,
    survivors,
    ...clutch ? { clutch } : {},
    ...ace ? { ace } : {}
  });
  const indexed = events.filter((e) => !(e.type === "move" && e.t > endT)).map((e, i) => ({ e: e.t > endT ? { ...e, t: endT } : e, i }));
  indexed.sort((x, y) => x.e.t - y.e.t || x.i - y.i);
  const result = {
    events: indexed.map((x) => x.e),
    winner: finalWinner,
    winnerTeam,
    reason: finalReason,
    planted,
    duration: endT,
    buy,
    call,
    setup,
    survivors,
    stats
  };
  if (clutch) result.clutch = clutch;
  if (ace) result.ace = ace;
  return result;
}
function reaction(tatico) {
  return ROUND.REACTION_BASE + ROUND.REACTION_TATICO * (1 - tatico / 100);
}
function chooseCTSetup(rng, igl, prev, buy) {
  const options = ["default", "stackA", "stackB", "aggressive"];
  if (buy === "eco" && rng.chance(ROUND.ECO_STACK)) return rng.pick(["stackA", "stackB"]);
  if (!igl) return rng.pick(options);
  const prevSite = prev ? prev.endsWith("A") ? "A" : prev.endsWith("B") ? "B" : null : null;
  const tat = igl.attrs.tatico / 100;
  const wRead = prevSite ? ROUND.CT_STACK_READ * tat : 0;
  const wOther = prevSite ? ROUND.CT_STACK_OTHER : (ROUND.CT_STACK_READ + ROUND.CT_STACK_OTHER) / 2;
  const weights = [
    ["default", ROUND.CT_DEFAULT + (prevSite ? ROUND.CT_STACK_READ * (1 - tat) : 0)],
    [prevSite === "B" ? "stackB" : "stackA", prevSite ? wRead : wOther],
    [prevSite === "B" ? "stackA" : "stackB", wOther],
    ["aggressive", ROUND.CT_AGGRESSIVE]
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [s, w] of weights) {
    r -= w;
    if (r <= 0) return s;
  }
  return "default";
}
function defendersBySetup(setup, eco = false) {
  switch (setup) {
    case "stackA":
      return eco ? { A: 4, B: 0 } : { A: 3, B: 1 };
    case "stackB":
      return eco ? { A: 0, B: 4 } : { A: 1, B: 3 };
    default:
      return { A: 2, B: 2 };
  }
}
function chooseTCall(rng, igl, setup, buy, ctEco) {
  const def = defendersBySetup(setup, ctEco);
  const weaker = def.A < def.B ? "A" : def.B < def.A ? "B" : null;
  let target;
  if (ctEco && setup !== "default" && setup !== "aggressive") {
    target = rng.pick(["A", "B"]);
  } else if (igl) {
    const read = rng.chance(ROUND.READ_BASE + ROUND.READ_TATICO * (igl.attrs.tatico / 100));
    target = read && weaker ? weaker : rng.pick(["A", "B"]);
  } else if (weaker && rng.chance(ROUND.NO_IGL_BAD_PICK)) {
    target = weaker === "A" ? "B" : "A";
  } else {
    target = rng.pick(["A", "B"]);
  }
  const poor = buy === "eco" || buy === "pistol" || buy === "force";
  if (rng.chance(poor ? ROUND.RUSH_WHEN_POOR : ROUND.RUSH_WHEN_RICH)) {
    return { call: target === "A" ? "rushA" : "rushB", target };
  }
  if (igl && rng.chance(ROUND.FAKE_CHANCE)) return { call: "fake", target };
  if (rng.chance(ROUND.SPLIT_VS_DEFAULT)) return { call: target === "A" ? "splitA" : "splitB", target };
  return { call: "default", target };
}
function assignCTs(cts, setup, eco) {
  const counts = defendersBySetup(setup, eco);
  const slots = [];
  for (let i = 0; i < counts.A; i++) slots.push("A");
  slots.push("mid");
  for (let i = 0; i < counts.B; i++) slots.push("B");
  const order = ["anchor", "awper", "igl", "support", "rifler", "star", "entry"];
  const sorted = orderBy(cts, order);
  const taken = /* @__PURE__ */ new Set();
  for (const c of sorted) {
    let idx = -1;
    if (c.cls === "awper") idx = slots.findIndex((s, i) => s === "mid" && !taken.has(i));
    if (c.cls === "anchor") idx = slots.findIndex((s, i) => s !== "mid" && !taken.has(i));
    if (idx < 0) idx = slots.findIndex((_, i) => !taken.has(i));
    taken.add(idx);
    c.post = slots[idx];
    c.forward = false;
  }
  if (setup === "aggressive") {
    for (const site of ["A", "B"]) {
      const candidates = cts.filter((c) => c.post === site && c.cls !== "anchor");
      const pusher = orderBy(candidates, ["entry", "star", "rifler", "support", "igl", "awper", "anchor"])[0];
      if (pusher && candidates.length >= 1 && cts.filter((c) => c.post === site).length >= 2) pusher.forward = true;
    }
  }
}
function ctHold(c, cts, map) {
  if (c.post === "mid") return map.mid.ct;
  const site = map.sites[c.post];
  const mates = cts.filter((x) => x.post === c.post);
  const i = mates.indexOf(c);
  return site.holds[i % site.holds.length];
}
function ctFallback(c, map) {
  return map.spawns.CT === c.area ? map.mid.ct : map.spawns.CT;
}
function preArea(map, entrance) {
  const p = shortestPath(map, map.spawns.T, entrance);
  return p ? p.path[p.path.length - 2] ?? map.spawns.T : map.spawns.T;
}
function pathStops(map, l, from, to, start) {
  const p = shortestPath(map, from, to);
  if (!p) return [];
  const watch = /* @__PURE__ */ new Set([map.mid.contact, map.sites.A.forward, map.sites.B.forward]);
  const out = [];
  let t = start;
  for (let i = 0; i < p.path.length; i++) {
    const a = p.path[i];
    if (i > 0) t += Math.round(shortestPath(map, p.path[i - 1], a).time * l.speed);
    if (watch.has(a)) out.push({ l, area: a, t: Math.round(t) });
  }
  return out;
}

// packages/engine/src/match.ts
var MENTAL = {
  LOSE_ROUND: -2,
  // [v0]
  LOSE_STREAK_3: -5,
  // [v0] extra on the 3rd consecutive loss (and beyond)
  WIN_CLUTCH: 6,
  // [v0]
  SUFFER_ACE: -4,
  // [v0]
  WIN_PISTOL: 3
  // [v0]
};
function simulateMatch(config, seed) {
  const rng = new Rng(seed);
  const mr = config.mr ?? 12;
  const otMr = config.otMr ?? 3;
  const startingCT = config.startingCT ?? 0;
  const map = config.map;
  const states = [mkTeamState(config.teams[0], 0), mkTeamState(config.teams[1], 1)];
  const score = [0, 0];
  const events = [];
  const rounds = [];
  const agg = /* @__PURE__ */ new Map();
  for (const s of states) for (const p of s.players) agg.set(p.id, emptyStats(p.id, s.index));
  let target = mr + 1;
  let overtime = false;
  let prevTCall;
  let winner = null;
  for (let round = 1; winner === null && round <= 200; round++) {
    const ot = round > 2 * mr;
    const ctIndex = ctFor(round, mr, otMr, startingCT);
    const tIndex = ctIndex === 0 ? 1 : 0;
    const sides = { CT: ctIndex, T: tIndex };
    const pistol = round === 1 || round === mr + 1;
    const halfStart = pistol || ot && (round - 2 * mr - 1) % otMr === 0;
    if (halfStart) {
      for (const side of ["CT", "T"]) {
        const st = states[sides[side]];
        st.lossStreak = 0;
        for (const p of st.players) {
          p.money = ot ? OT_START_MONEY : START_MONEY;
          p.inv = freshInventory(side);
        }
      }
    }
    const ctTeam = { index: ctIndex, players: states[ctIndex].players, lossStreak: states[ctIndex].lossStreak };
    const tTeam = { index: tIndex, players: states[tIndex].players, lossStreak: states[tIndex].lossStreak };
    const result = simulateRound({
      round,
      map,
      rng,
      pistol,
      ct: ctTeam,
      t: tTeam,
      score: [score[0], score[1]],
      afterPistol: round === 2 || round === mr + 2,
      ...prevTCall ? { prevTCall } : {}
    });
    prevTCall = result.call;
    events.push(...result.events);
    score[result.winnerTeam]++;
    rounds.push({
      round,
      winner: result.winner,
      winnerTeam: result.winnerTeam,
      reason: result.reason,
      score: [score[0], score[1]],
      buy: result.buy,
      sides,
      duration: result.duration,
      planted: result.planted
    });
    const survivors = new Set(result.survivors);
    for (const side of ["CT", "T"]) {
      const st = states[sides[side]];
      const won = result.winner === side;
      st.lossStreak = nextLossStreak(st.lossStreak, won);
      st.consecutiveLosses = won ? 0 : st.consecutiveLosses + 1;
      const aceSuffered = result.ace !== void 0 && !st.players.some((p) => p.id === result.ace);
      for (const p of st.players) {
        const alive = survivors.has(p.id);
        p.money = addMoney(
          p.money,
          roundIncome({ won, side, reason: result.reason, planted: result.planted, alive, lossStreak: st.lossStreak })
        );
        if (!alive) p.inv = freshInventory(side);
        else {
          p.inv = { ...p.inv, utils: [] };
          const surviveMoney = resolveBuild(p.base.build).surviveMoney;
          if (surviveMoney) p.money = addMoney(p.money, surviveMoney);
        }
        let dm = 0;
        if (!won) dm += MENTAL.LOSE_ROUND;
        if (!won && st.consecutiveLosses >= 3) dm += MENTAL.LOSE_STREAK_3;
        if (won && pistol) dm += MENTAL.WIN_PISTOL;
        if (aceSuffered) dm += MENTAL.SUFFER_ACE;
        if (result.clutch?.player === p.id) dm += MENTAL.WIN_CLUTCH;
        p.mental = clampAttr(p.mental + dm);
      }
    }
    for (const [id, s] of Object.entries(result.stats)) {
      const a = agg.get(id);
      a.rounds++;
      a.kills += s.kills;
      a.deaths += s.died ? 1 : 0;
      a.assists += s.assists;
      a.flashAssists += s.flashAssists;
      a.headshots += s.headshots;
      a.damage += s.damage;
      if (s.kast) a.kastRounds++;
      if (s.entryKill) a.entryKills++;
      if (s.entryDeath) a.entryDeaths++;
      if (s.kills >= 2 && s.kills <= 5) a.multiKills[s.kills]++;
      if (s.clutchAttempt) a.clutchAttempts++;
      if (s.clutchWon) a.clutchesWon++;
      if (s.planted) a.plants++;
      if (s.defused) a.defuses++;
      for (const [id2, n] of Object.entries(s.cardTriggers)) a.cardTriggers[id2] = (a.cardTriggers[id2] ?? 0) + n;
    }
    if (score[0] === target) winner = 0;
    else if (score[1] === target) winner = 1;
    else if (score[0] === target - 1 && score[1] === target - 1) {
      target += otMr;
      overtime = true;
    }
  }
  const stats = [];
  for (const s of states) {
    for (const p of s.players) {
      const a = agg.get(p.id);
      const b = ratingBreakdown(a);
      a.rating = b.rating;
      a.adr = b.adr;
      a.kast = b.kast;
      stats.push(a);
    }
  }
  const teams = [logTeam(config.teams[0]), logTeam(config.teams[1])];
  return {
    version: 1,
    seed,
    mapId: map.id,
    teams,
    startingSides: { CT: startingCT, T: startingCT === 0 ? 1 : 0 },
    mr,
    otMr,
    events,
    rounds,
    score,
    winner: winner ?? (score[0] > score[1] ? 0 : 1),
    overtime,
    stats
  };
}
function ctFor(round, mr, otMr, startingCT) {
  const other = startingCT === 0 ? 1 : 0;
  if (round <= mr) return startingCT;
  if (round <= 2 * mr) return other;
  const otHalf = Math.floor((round - 2 * mr - 1) / otMr);
  return otHalf % 2 === 0 ? other : startingCT;
}
function mkTeamState(team, index) {
  return {
    index,
    team,
    players: team.players.map((p) => ({
      id: p.id,
      team: index,
      base: p,
      money: START_MONEY,
      inv: freshInventory(index === 0 ? "CT" : "T"),
      mental: initialMental(p)
    })),
    lossStreak: 0,
    consecutiveLosses: 0
  };
}
function logTeam(team) {
  return { id: team.id, name: team.name, players: team.players.map((p) => ({ id: p.id, nick: p.nick, class: p.class })) };
}
function emptyStats(id, team) {
  return {
    id,
    team,
    kills: 0,
    deaths: 0,
    assists: 0,
    flashAssists: 0,
    headshots: 0,
    damage: 0,
    kastRounds: 0,
    rounds: 0,
    entryKills: 0,
    entryDeaths: 0,
    multiKills: { 2: 0, 3: 0, 4: 0, 5: 0 },
    clutchesWon: 0,
    clutchAttempts: 0,
    plants: 0,
    defuses: 0,
    rating: 0,
    adr: 0,
    kast: 0,
    cardTriggers: {}
  };
}

// packages/engine/src/data/maps/map01.ts
var MAP01 = {
  id: "baixada",
  name: "Baixada",
  radar: { w: 1024, h: 1024 },
  spawns: { T: "t_spawn", CT: "ct_spawn" },
  mid: { t: "t_mid", ct: "ct_mid", contact: "mid" },
  sites: {
    A: { plant: "a_site", entrances: ["a_ramp", "a_short"], holds: ["a_site", "a_short"], forward: "long" },
    B: { plant: "b_site", entrances: ["b_tuns", "b_doors"], holds: ["b_site", "b_doors"], forward: "b_tuns" }
  },
  areas: [
    // T side
    { id: "t_spawn", name: "Spawn T", polygon: [[40, 780], [300, 780], [300, 990], [40, 990]], range: "long" },
    { id: "long_doors", name: "Port\xF5es do Longo", polygon: [[40, 620], [200, 620], [200, 780], [40, 780]], range: "short" },
    { id: "long", name: "Longo", polygon: [[40, 220], [200, 220], [200, 620], [40, 620]], range: "long" },
    { id: "a_ramp", name: "Rampa A", polygon: [[200, 160], [310, 160], [310, 300], [200, 300]], range: "mid" },
    { id: "t_mid", name: "Rampa do Meio", polygon: [[300, 700], [410, 700], [410, 860], [300, 860]], range: "mid" },
    { id: "outside_tuns", name: "Boca do T\xFAnel", polygon: [[480, 780], [750, 780], [750, 990], [480, 990]], range: "short" },
    { id: "b_tuns", name: "T\xFAneis", polygon: [[750, 620], [860, 620], [860, 990], [750, 990]], range: "short" },
    // Middle
    { id: "mid", name: "Meio", polygon: [[380, 380], [560, 380], [560, 700], [380, 700]], range: "long" },
    { id: "a_short", name: "Passarela", polygon: [[440, 160], [560, 160], [560, 380], [440, 380]], range: "mid" },
    { id: "ct_mid", name: "Meio CT", polygon: [[560, 380], [740, 380], [740, 560], [560, 560]], range: "mid" },
    // Sites & CT side
    { id: "a_site", name: "Site A", polygon: [[200, 30], [560, 30], [560, 160], [200, 160]], range: "mid" },
    { id: "ct_spawn", name: "Spawn CT", polygon: [[740, 30], [990, 30], [990, 380], [740, 380]], range: "mid" },
    { id: "b_doors", name: "Portas B", polygon: [[740, 380], [860, 380], [860, 620], [740, 620]], range: "short" },
    { id: "b_site", name: "Site B", polygon: [[860, 380], [990, 380], [990, 620], [860, 620]], range: "mid" }
  ],
  routes: [
    // T spawn fan-out
    { from: "t_spawn", to: "long_doors", time: 8, range: "short" },
    { from: "t_spawn", to: "t_mid", time: 6, range: "mid" },
    { from: "t_spawn", to: "outside_tuns", time: 7, range: "short" },
    // Long lane to A
    { from: "long_doors", to: "long", time: 6, range: "long" },
    { from: "long", to: "a_ramp", time: 6, range: "long" },
    { from: "a_ramp", to: "a_site", time: 4, range: "mid" },
    // Mid and catwalk
    { from: "t_mid", to: "mid", time: 5, range: "long" },
    { from: "mid", to: "a_short", time: 7, range: "mid" },
    { from: "a_short", to: "a_site", time: 5, range: "mid" },
    { from: "a_short", to: "ct_mid", time: 4, range: "short" },
    { from: "mid", to: "ct_mid", time: 6, range: "long" },
    // CT side connectors
    { from: "ct_mid", to: "ct_spawn", time: 5, range: "mid" },
    { from: "ct_mid", to: "b_doors", time: 5, range: "short" },
    { from: "ct_spawn", to: "a_site", time: 7, range: "mid" },
    { from: "ct_spawn", to: "b_doors", time: 6, range: "mid" },
    { from: "b_doors", to: "b_site", time: 4, range: "short" },
    // Tunnels to B
    { from: "outside_tuns", to: "b_tuns", time: 5, range: "short" },
    { from: "b_tuns", to: "b_site", time: 5, range: "short" }
  ]
};

// packages/engine/src/drill.ts
var DRILL = {
  RESPAWN_SECONDS: 3,
  // [v1]
  /** DM: chance a free player hunts the nearest enemy instead of wandering. */
  HUNT: 0.75,
  // [v1]
  /** DM: extra retreat chance so fights disengage (keeps kills at ~1/3 of duels). */
  DM_RETREAT_BONUS: 0.35,
  // [v1]
  DM_COOLDOWN: 2,
  // [v1] seconds after a duel before the next engagement
  DUEL_GAP_MIN: 2,
  // [v1]
  DUEL_GAP_MAX: 5,
  // [v1]
  CHIP_CHANCE: 0.2
  // [v1]
};
var RETAKE_CALLS = ["padrao", "flanco", "agressivo"];
var SCENARIO_TITLE = {
  aim1v1: "Aim 1v1",
  peek: "Peek no \xE2ngulo",
  rush: "Rush 3v2",
  retake2v2: "Retake B 2v2",
  retake3v2: "Retake A 3v2",
  execute: "Execute A 3v2"
};
function mkLive(p, side, team, area2, attacker) {
  const attrs = effectiveAttrs(p, { mental: p.attrs.mental });
  return {
    id: p.id,
    base: { ...p, build: p.build },
    side,
    team,
    attrs,
    build: resolveBuild(p.build),
    speed: 1.1 - 0.2 * (attrs.mov / 100),
    hp: 100,
    alive: true,
    area: area2,
    busyUntil: 0,
    settledAt: 0,
    respawnAt: -1,
    engagements: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    headshots: 0,
    assists: 0,
    cardTriggers: {},
    attacker
  };
}
function emit(a, e) {
  a.events.push(e);
}
function walk(a, l, to, startT) {
  const path = shortestPath(a.map, l.area, to);
  if (!path || path.path.length < 2) return startT;
  let t = startT;
  for (let i = 0; i < path.path.length - 1; i++) {
    const from = path.path[i];
    const next = path.path[i + 1];
    const leg = shortestPath(a.map, from, next).time;
    const duration = Math.max(1, Math.round(leg * l.speed));
    emit(a, { type: "move", round: 1, t: Math.round(t), player: l.id, from, to: next, duration });
    t += duration;
  }
  l.area = to;
  l.settledAt = Math.round(t);
  return Math.round(t);
}
function duelist(l, weaponId, clutch) {
  return { attrs: l.attrs, weapon: weapon(weaponId), armor: true, hp: l.hp, clutch, conditionals: l.build.conditionals, siteSurvival: l.build.siteSurvival };
}
function fight(a, at, df, t, o) {
  const flagsA = { firstDuel: at.engagements === 0, pistol: false };
  const flagsD = { firstDuel: df.engagements === 0, atSite: o.defenderHoldingAngle, pistol: false };
  at.engagements++;
  df.engagements++;
  const clutchA = o.aliveA === 1 && o.aliveD >= 2;
  const clutchD = o.aliveD === 1 && o.aliveA >= 2;
  const ctx = {
    range: areaRange(a.map, o.area),
    defenderHoldingAngle: o.defenderHoldingAngle,
    inSmoke: false,
    retakeProT: o.retakeProT,
    numbersAdvantage: o.aliveA > o.aliveD ? "A" : o.aliveD > o.aliveA ? "D" : null,
    attackerFlags: flagsA,
    defenderFlags: flagsD,
    retreatBonus: a.retreatBonus
  };
  const id = `r1d${++a.duelCounter}`;
  emit(a, {
    type: "duel",
    round: 1,
    t: Math.round(Math.max(0, t - 0.8) * 10) / 10,
    id,
    attacker: at.id,
    defender: df.id,
    area: o.area,
    range: ctx.range,
    situation: {
      holdingAngle: ctx.defenderHoldingAngle,
      attackerFlashed: false,
      defenderFlashed: false,
      inSmoke: false,
      retakeProT: ctx.retakeProT,
      numbers: ctx.numbersAdvantage,
      clutch: clutchA ? "A" : clutchD ? "D" : null
    }
  });
  const res = resolveDuel(duelist(at, a.weaponOf(at), clutchA), duelist(df, a.weaponOf(df), clutchD), ctx, a.rng);
  const winner = res.winner === "A" ? at : df;
  const loser = res.winner === "A" ? df : at;
  const last = a.events[a.events.length - 1];
  if (last && last.type === "duel" && (res.triggered.A.length || res.triggered.D.length)) {
    last.triggered = {};
    if (res.triggered.A.length) last.triggered[at.id] = res.triggered.A;
    if (res.triggered.D.length) last.triggered[df.id] = res.triggered.D;
  }
  for (const s of res.triggered.A) at.cardTriggers[s] = (at.cardTriggers[s] ?? 0) + 1;
  for (const s of res.triggered.D) df.cardTriggers[s] = (df.cardTriggers[s] ?? 0) + 1;
  if (winner.hp > 1 && a.rng.chance(DRILL.CHIP_CHANCE)) {
    const chip = Math.min(winner.hp - 1, a.rng.int(10, 60));
    emit(a, { type: "damage", round: 1, t, attacker: loser.id, victim: winner.id, amount: chip, weapon: a.weaponOf(loser), area: o.area, duel: id });
    winner.hp -= chip;
    loser.damage += chip;
  }
  const w = a.weaponOf(winner);
  if (res.loserSurvived) {
    emit(a, { type: "damage", round: 1, t, attacker: winner.id, victim: loser.id, amount: res.damage, weapon: w, area: o.area, duel: id });
    winner.damage += res.damage;
    loser.hp -= res.damage;
    const fallback = loser === at ? o.fallbackA : o.fallbackD;
    loser.busyUntil = walk(a, loser, fallback, t) + 1;
    return { winner, killed: null };
  }
  emit(a, { type: "damage", round: 1, t, attacker: winner.id, victim: loser.id, amount: loser.hp, weapon: w, area: o.area, duel: id });
  winner.damage += loser.hp;
  const headshot = res.headshot;
  emit(a, { type: "kill", round: 1, t, attacker: winner.id, victim: loser.id, weapon: w, headshot, area: o.area, duel: id });
  loser.alive = false;
  loser.hp = 0;
  loser.deaths++;
  winner.kills++;
  if (headshot) winner.headshots++;
  a.lastKillT = t;
  return { winner, killed: loser };
}
function finishLog(a, drill, seed, teams, endT, winnerTeam, reason) {
  const survivors = a.players.filter((l) => l.alive).map((l) => l.id);
  emit(a, { type: "roundEnd", round: 1, t: endT, winner: winnerTeam === 0 ? "CT" : "T", winnerTeam, reason, score: winnerTeam === 0 ? [1, 0] : [0, 1], survivors });
  const indexed = a.events.filter((e) => !(e.type === "move" && e.t > endT)).map((e, i) => ({ e: e.t > endT ? { ...e, t: endT } : e, i }));
  indexed.sort((x, y) => x.e.t - y.e.t || x.i - y.i);
  const stats = a.players.map((l) => {
    const b = ratingBreakdown({ kills: l.kills, deaths: l.deaths, assists: 0, damage: l.damage, kastRounds: l.kills > 0 || l.alive ? 1 : 0, rounds: 1 });
    return {
      id: l.id,
      team: l.team,
      kills: l.kills,
      deaths: l.deaths,
      assists: 0,
      flashAssists: 0,
      headshots: l.headshots,
      damage: l.damage,
      kastRounds: l.kills > 0 || l.alive ? 1 : 0,
      rounds: 1,
      entryKills: 0,
      entryDeaths: 0,
      multiKills: { 2: 0, 3: 0, 4: 0, 5: 0 },
      clutchesWon: 0,
      clutchAttempts: 0,
      plants: 0,
      defuses: 0,
      rating: b.rating,
      adr: b.adr,
      kast: b.kast,
      cardTriggers: l.cardTriggers
    };
  });
  return {
    version: 1,
    seed,
    mapId: a.map.id,
    teams: [logTeam2(teams[0]), logTeam2(teams[1])],
    startingSides: { CT: 0, T: 1 },
    mr: 1,
    otMr: 0,
    drill,
    events: indexed.map((x) => x.e),
    rounds: [{ round: 1, winner: winnerTeam === 0 ? "CT" : "T", winnerTeam, reason, score: winnerTeam === 0 ? [1, 0] : [0, 1], buy: { CT: "full", T: "full" }, sides: { CT: 0, T: 1 }, duration: endT, planted: false }],
    score: winnerTeam === 0 ? [1, 0] : [0, 1],
    winner: winnerTeam,
    overtime: false,
    stats
  };
}
function logTeam2(team) {
  return { id: team.id, name: team.name, players: team.players.map((p) => ({ id: p.id, nick: p.nick, class: p.class })) };
}
function roundStart(a, players) {
  const money = {};
  for (const l of players) money[l.id] = 0;
  emit(a, { type: "roundStart", round: 1, t: 0, score: [0, 0], sides: { CT: 0, T: 1 }, money, buy: { CT: "full", T: "full" }, pistol: false, freezetimeEnd: 0 });
  for (const l of players) emit(a, { type: "buy", round: 1, t: 0, player: l.id, weapon: a.weaponOf(l), armor: true, helmet: true, kit: false, utils: [], spent: 0 });
}
function simulateDeathmatch(config, seed, durationSec) {
  const rng = new Rng(seed);
  const map = config.map;
  const a = { map, rng, events: [], players: [], duelCounter: 0, lastKillT: 0, retreatBonus: DRILL.DM_RETREAT_BONUS, weaponOf: () => "ak47" };
  a.weaponOf = (l) => l.side === "CT" ? "m4" : "ak47";
  const areas = map.areas.map((x) => x.id);
  const spawnFor = (side) => {
    const enemies = a.players.filter((l) => l.alive && l.side !== side).map((l) => l.area);
    const free = areas.filter((id) => !enemies.includes(id));
    return rng.pick(free.length ? free : areas);
  };
  config.teams.forEach((team, ti) => {
    for (const p of team.players) {
      const side = ti === 0 ? "CT" : "T";
      a.players.push(mkLive(p, side, ti, map.spawns[side], true));
    }
  });
  roundStart(a, a.players);
  for (const l of a.players) {
    l.area = spawnFor(l.side);
    emit(a, { type: "respawn", round: 1, t: 0, player: l.id, area: l.area });
    l.busyUntil = rng.int(0, 2);
  }
  const neighbours = (id) => {
    const out = /* @__PURE__ */ new Set();
    for (const r of map.routes) {
      if (r.from === id) out.add(r.to);
      if (r.to === id) out.add(r.from);
    }
    return [...out];
  };
  const nearestEnemyArea = (l) => {
    let best = null;
    for (const e of a.players) {
      if (!e.alive || e.side === l.side) continue;
      const p = shortestPath(map, l.area, e.area);
      if (p && (!best || p.time < best.time)) best = { area: e.area, time: p.time };
    }
    return best?.area ?? null;
  };
  for (let t = 0; t < durationSec; t++) {
    for (const l of a.players) {
      if (!l.alive && l.respawnAt >= 0 && l.respawnAt <= t) {
        l.alive = true;
        l.hp = 100;
        l.area = spawnFor(l.side);
        l.settledAt = t;
        l.busyUntil = t + 1;
        l.respawnAt = -1;
        emit(a, { type: "respawn", round: 1, t, player: l.id, area: l.area });
      }
    }
    for (const l of a.players) {
      if (!l.alive || l.busyUntil > t) continue;
      const near = neighbours(l.area);
      const here = a.players.filter((e) => e.alive && e.side !== l.side && e.busyUntil <= t + 2 && (e.area === l.area || near.includes(e.area))).sort((x, y) => Number(y.area === l.area) - Number(x.area === l.area));
      if (here.length) {
        const df = here[0];
        if (df.area !== l.area) {
          emit(a, { type: "move", round: 1, t, player: l.id, from: l.area, to: df.area, duration: 1 });
          l.area = df.area;
          l.settledAt = t;
        }
        const aliveMine = a.players.filter((x) => x.alive && x.side === l.side).length;
        const aliveTheirs = a.players.filter((x) => x.alive && x.side !== l.side).length;
        const { killed } = fight(a, l, df, t + 1, {
          area: l.area,
          defenderHoldingAngle: t - df.settledAt >= 2,
          retakeProT: null,
          fallbackA: rng.pick(neighbours(l.area)),
          fallbackD: rng.pick(neighbours(l.area)),
          aliveA: aliveMine,
          aliveD: aliveTheirs
        });
        if (killed) killed.respawnAt = t + DRILL.RESPAWN_SECONDS;
        const gap = rng.int(DRILL.DUEL_GAP_MIN, DRILL.DUEL_GAP_MAX);
        if (l.alive) l.busyUntil = Math.max(l.busyUntil, t + DRILL.DM_COOLDOWN + gap - DRILL.DUEL_GAP_MIN);
        if (df.alive) df.busyUntil = Math.max(df.busyUntil, t + DRILL.DM_COOLDOWN);
        continue;
      }
      let target = rng.chance(DRILL.HUNT) ? nearestEnemyArea(l) : null;
      if (!target || target === l.area) target = rng.pick(neighbours(l.area));
      const path = shortestPath(map, l.area, target);
      const next = path && path.path.length > 1 ? path.path[1] : target;
      l.busyUntil = walk(a, l, next, t);
    }
  }
  const kills0 = a.players.filter((l) => l.team === 0).reduce((s, l) => s + l.kills, 0);
  const kills1 = a.players.filter((l) => l.team === 1).reduce((s, l) => s + l.kills, 0);
  return finishLog(a, "dm", seed, config.teams, durationSec, kills0 >= kills1 ? 0 : 1, "time");
}
var SCENARIO_SECONDS = { aim1v1: 20, peek: 20, rush: 25, retake2v2: 30, retake3v2: 30, execute: 30 };
var COUNTER = { padrao: "padrao", flanco: "flanco", agressivo: "agressivo" };
function simulateScenario(kind, config, seed, call) {
  const rng = new Rng(seed);
  const map = config.map;
  const a = { map, rng, events: [], players: [], duelCounter: 0, lastKillT: 0, retreatBonus: 0, weaponOf: (l) => l.side === "CT" ? "m4" : "ak47" };
  const me = { ...config.me, id: config.me.id };
  const mates = (n, classes) => generateBotTeam({ rng, targetAvg: config.botAvg, idPrefix: "x", classes }).players.slice(0, n).map((p, i) => ({ ...p, id: `a${i + 2}` }));
  const foes = (n, classes) => generateBotTeam({ rng, targetAvg: config.botAvg, idPrefix: "b", classes }).players.slice(0, n);
  const durationSec = SCENARIO_SECONDS[kind];
  const site = kind === "retake2v2" ? map.sites.B : map.sites.A;
  let attackers = [];
  let defenders = [];
  let respawn = false;
  let retakeProT = null;
  let fightArea = site.plant;
  let attackerStart = map.spawns.CT;
  let defenderStart = map.spawns.T;
  let holdAngle = true;
  let correctCall;
  let setupAreas;
  let attackerDelay = 0;
  switch (kind) {
    case "aim1v1": {
      fightArea = map.mid.contact;
      attackerStart = map.mid.contact;
      defenderStart = map.mid.contact;
      attackers = [mkLive(me, "CT", 0, attackerStart, true)];
      defenders = foes(1, ["rifler"]).map((p) => mkLive(p, "T", 1, defenderStart, false));
      respawn = true;
      holdAngle = false;
      break;
    }
    case "peek": {
      fightArea = site.entrances[0];
      attackerStart = site.entrances[0];
      defenderStart = site.entrances[0];
      attackers = [mkLive(me, "CT", 0, attackerStart, true)];
      defenders = foes(1, ["anchor"]).map((p) => mkLive(p, "T", 1, defenderStart, false));
      respawn = true;
      holdAngle = true;
      break;
    }
    case "rush":
    case "execute": {
      attackerStart = kind === "rush" ? shortestPath(map, map.spawns.T, site.entrances[0])?.path.at(-2) ?? map.spawns.T : site.entrances[1];
      defenderStart = site.plant;
      attackers = [mkLive(me, "CT", 0, attackerStart, true), ...mates(2, ["entry", "rifler"]).map((p) => mkLive(p, "CT", 0, attackerStart, true))];
      defenders = foes(2, ["anchor", "rifler"]).map((p) => mkLive(p, "T", 1, defenderStart, false));
      attackerDelay = kind === "execute" ? 6 : 0;
      break;
    }
    case "retake2v2":
    case "retake3v2": {
      const n = kind === "retake2v2" ? 1 : 2;
      attackerStart = map.spawns.CT;
      defenderStart = site.plant;
      attackers = [mkLive(me, "CT", 0, attackerStart, true), ...mates(n, ["rifler", "entry"]).map((p) => mkLive(p, "CT", 0, attackerStart, true))];
      defenders = foes(2, ["rifler", "anchor"]).map((p) => mkLive(p, "T", 1, defenderStart, false));
      retakeProT = "D";
      const setup = rng.pick(RETAKE_CALLS);
      correctCall = COUNTER[setup];
      const spots = {
        padrao: [site.plant, site.entrances[0]],
        flanco: [site.plant, site.plant],
        agressivo: [site.entrances[0], site.entrances[1]]
      };
      defenders.forEach((d, i) => {
        d.area = spots[setup][i];
      });
      setupAreas = defenders.map((d) => ({ player: d.id, area: d.area }));
      const used = call ?? "padrao";
      if (used === correctCall) holdAngle = false;
      if (used === "agressivo") attackerDelay = -3;
      if (used === "flanco") attackerDelay = 4;
      break;
    }
  }
  a.players = [...attackers, ...defenders];
  const teams = [
    { id: "a", name: "Treino", players: attackers.map((l) => l.base) },
    { id: "b", name: "Bots", players: defenders.map((l) => l.base) }
  ];
  roundStart(a, a.players);
  for (const l of a.players) emit(a, { type: "respawn", round: 1, t: 0, player: l.id, area: l.area });
  for (const d of defenders) d.busyUntil = walk(a, d, fightArea, 0);
  attackers.forEach((l, i) => {
    l.busyUntil = walk(a, l, fightArea, Math.max(0, 1 + i * 2 + attackerDelay));
  });
  if (kind === "execute") {
    const arrive = Math.min(...attackers.map((l) => l.busyUntil));
    emit(a, { type: "util", round: 1, t: Math.max(0, arrive - 3), player: me.id, util: "smoke", area: fightArea });
    emit(a, { type: "util", round: 1, t: Math.max(0, arrive - 1), player: me.id, util: "flash", area: fightArea });
    for (const d of defenders) d.settledAt = arrive;
  }
  let myDuels = 0;
  let myWins = 0;
  let winner = null;
  let endT = durationSec;
  const meId = me.id;
  for (let t = 0; t < durationSec && winner === null; t++) {
    for (const l of a.players) {
      if (!l.alive && respawn && l.respawnAt >= 0 && l.respawnAt <= t) {
        l.alive = true;
        l.hp = 100;
        l.area = l.attacker ? attackerStart : defenderStart;
        emit(a, { type: "respawn", round: 1, t, player: l.id, area: l.area });
        l.busyUntil = walk(a, l, fightArea, t + 1);
      }
    }
    const pa = attackers.filter((l) => l.alive && l.busyUntil <= t && l.area === fightArea);
    const pd = defenders.filter((l) => l.alive && l.busyUntil <= t && l.area === fightArea);
    if (!respawn) {
      if (attackers.every((l) => !l.alive)) {
        winner = 1;
        endT = a.lastKillT;
        break;
      }
      if (defenders.every((l) => !l.alive)) {
        winner = 0;
        endT = a.lastKillT;
        break;
      }
    }
    if (!pa.length || !pd.length) continue;
    const at = pa.slice().sort((x, y) => x.engagements - y.engagements)[0];
    const df = pd.slice().sort((x, y) => x.engagements - y.engagements)[0];
    const { winner: w, killed } = fight(a, at, df, t, {
      area: fightArea,
      defenderHoldingAngle: holdAngle && t - df.settledAt >= 2,
      retakeProT,
      fallbackA: attackerStart,
      fallbackD: defenderStart,
      aliveA: attackers.filter((l) => l.alive).length,
      aliveD: defenders.filter((l) => l.alive).length
    });
    if (at.id === meId || df.id === meId) {
      myDuels++;
      if (w.id === meId) myWins++;
    }
    if (killed) {
      if (respawn) killed.respawnAt = t + DRILL.RESPAWN_SECONDS;
    }
    const gap = rng.int(DRILL.DUEL_GAP_MIN, DRILL.DUEL_GAP_MAX);
    for (const l of [at, df]) if (l.alive) l.busyUntil = Math.max(l.busyUntil, t + gap);
    for (const l of [at, df]) if (l.alive && l.area !== fightArea) l.busyUntil = walk(a, l, fightArea, l.busyUntil);
  }
  const mine = a.players.find((l) => l.id === meId);
  let won;
  if (respawn) {
    const foe = defenders[0];
    won = mine.kills > mine.deaths || mine.kills === mine.deaths && mine.damage > foe.damage;
    winner = won ? 0 : 1;
  } else if (winner === null) {
    won = false;
    winner = 1;
  } else won = winner === 0;
  const log = finishLog(a, kind, seed, teams, endT, winner, respawn || endT === durationSec ? "time" : "elimination");
  const result = { kind, title: SCENARIO_TITLE[kind], won, duels: myDuels, duelsWon: myWins, timeSec: endT, log };
  if (correctCall) {
    result.call = call ?? "padrao";
    result.correctCall = correctCall;
    result.setupAreas = setupAreas;
  }
  return result;
}

// packages/engine/src/mmr.ts
var MMR = {
  START: 1e3,
  // [v1]
  K: 25,
  // [v0] GDD 8.3
  /** f = clamp((rating − 1) × DAMP, −CLAMP, +CLAMP) */
  DAMP: 0.8,
  // [v0]
  CLAMP: 0.4,
  // [v0]
  /** Passive characters count rating with this weight and never move MMR. */
  PASSIVE_RATING_WEIGHT: 0.5
  // [v0] GDD 4.4
};
function expectedScore(mmr, opponentMmr) {
  return 1 / (1 + Math.pow(10, (opponentMmr - mmr) / 400));
}
function mmrDelta(won, expected, rating) {
  const f = Math.max(-MMR.CLAMP, Math.min(MMR.CLAMP, (rating - 1) * MMR.DAMP));
  const d = won ? MMR.K * (1 - expected) * (1 + f) : -MMR.K * expected * (1 - f);
  return Math.round(d);
}
function softReset(mmr) {
  return Math.round((mmr + MMR.START) / 2);
}
var RANKS = [
  { tier: 1, name: "Novato", min: 0 },
  { tier: 2, name: "Pe\xE3o", min: 800 },
  { tier: 3, name: "Veterano", min: 900 },
  { tier: 4, name: "Guarda", min: 1e3 },
  { tier: 5, name: "Tit\xE3", min: 1100 },
  { tier: 6, name: "Sentinela", min: 1200 },
  { tier: 7, name: "Vanguarda", min: 1300 },
  { tier: 8, name: "Comandante", min: 1450 },
  { tier: 9, name: "Elite", min: 1600 },
  { tier: 10, name: "Imortal", min: 1800 }
];
function rankOf(mmr) {
  let out = RANKS[0];
  for (const r of RANKS) if (mmr >= r.min) out = r;
  return out;
}

// packages/engine/src/progression.ts
var XP = {
  BASE: 60,
  // [v0] GDD 8.1
  WIN: 1,
  // [v0]
  LOSS: 0.6,
  // [v0]
  MODE_SOLO: 1,
  // [v0]
  MODE_ONLINE: 1.6,
  // [v0]
  MINIGAME_MAX: 1.3,
  // [v0] multiplier at average 100
  /** XP to go from level L to L+1 = LEVEL_BASE + LEVEL_STEP · L. [v0] */
  LEVEL_BASE: 100,
  LEVEL_STEP: 35,
  MAX_LEVEL: 50,
  // [v0] GDD 3.1
  /** Training / DM sessions give a small fixed XP (GDD 4: "baixo"). [v0] */
  TRAINING: 15
};
function clampNum(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function attrCap(level) {
  return Math.min(100, 40 + level * 1.2);
}
function xpForLevel(level) {
  return XP.LEVEL_BASE + XP.LEVEL_STEP * level;
}
function performanceMult(rating) {
  return 0.6 + 0.8 * clampNum(rating, 0.5, 1.5) - 0.4;
}
function minigameMult(average) {
  if (average === null) return 1;
  return 1 + (XP.MINIGAME_MAX - 1) * clampNum(average / 100, 0, 1);
}
function matchXp(input) {
  const result = input.won ? XP.WIN : XP.LOSS;
  const performance = performanceMult(input.rating);
  const minigame = minigameMult(input.minigameAvg);
  const mode = input.mode === "online" ? XP.MODE_ONLINE : XP.MODE_SOLO;
  return { xp: Math.round(XP.BASE * result * performance * minigame * mode), base: XP.BASE, result, performance, minigame, mode };
}
function applyXp(state, gain) {
  let { level, xp } = state;
  xp += Math.max(0, Math.round(gain));
  const reached = [];
  while (level < XP.MAX_LEVEL && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    reached.push(level);
  }
  if (level >= XP.MAX_LEVEL) xp = 0;
  return { level, xp, reached };
}

// packages/engine/src/index.ts
var ENGINE_VERSION = "0.0.1";
export {
  ATTR_KEYS,
  AWP_DISCOUNT,
  AWP_MIN_MONEY,
  BOT_CLASSES,
  BOT_NICKS,
  BOT_SPREAD,
  BOT_TEAM_NAMES,
  CARDS,
  CARD_LEVEL_MAX,
  CLASS_LABEL,
  DRILL,
  DUEL,
  ECON,
  EMPTY_BUILD,
  ENGINE_VERSION,
  FORCE_AVG_MONEY,
  FORCE_MIN_LOSS_STREAK,
  GEAR,
  KILL_REWARD,
  LEVEL_MULT,
  LOSS_BONUS,
  MAP01,
  MAX_MONEY,
  MENTAL,
  MMR,
  NO_ARMOR_PENALTY,
  NO_IGL_TATICO_MULT,
  OT_START_MONEY,
  PLANT_BONUS,
  RANKS,
  RARITY_DROP,
  RARITY_NAME,
  RATING,
  RETAKE_CALLS,
  RIFLE_RESERVE,
  ROUND,
  Rng,
  SCENARIO_TITLE,
  SET_BONUS,
  SET_BONUS_TEXT,
  SET_SIZE,
  START_MONEY,
  WEAPONS,
  WIN_REWARD,
  WIN_REWARD_OBJECTIVE,
  XP,
  addMoney,
  applyXp,
  area,
  areaRange,
  attrCap,
  averageAttr,
  buildBonuses,
  buyForPlayer,
  card,
  cardText,
  cardValue,
  clamp,
  clampAttr,
  clampNum,
  conditionMatches,
  ctFor,
  decideTeamBuy,
  displayRating,
  duelScores,
  effectiveAttrs,
  expectedScore,
  findIgl,
  freshInventory,
  fullBuyFloor,
  generateBotAttrs,
  generateBotMatchup,
  generateBotTeam,
  hasCard,
  hasRifleClass,
  headshotChance,
  impact,
  initialMental,
  isEvent,
  lossBonus,
  makePlayer,
  matchRating,
  matchXp,
  mentalMultiplier,
  minigameMult,
  mmrDelta,
  nextLossStreak,
  performanceMult,
  rankOf,
  ratingBreakdown,
  resolveBuild,
  resolveDuel,
  retreatChance,
  riflesFor,
  roundIncome,
  setProgress,
  shortestPath,
  simulateDeathmatch,
  simulateMatch,
  simulateRound,
  simulateScenario,
  slotsForLevel,
  smgFor,
  softReset,
  starterPistol,
  tradeChance,
  uniformAttrs,
  validateMap,
  weapon,
  winProbability,
  xpForLevel
};
