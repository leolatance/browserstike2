/**
 * Cards (GDD 6). Pure data: ids match the art prompts (card_<theme>_<name>).
 * Level I/II/III scales the number ×1 / ×1.3 / ×1.75 [v1] (GDD said +4 → +5 → +6;
 * level III was widened so six maxed cards reach the 65–75% gate).
 * [v1] Numbers are ~5× the GDD examples: with k = 0.14 in the duel formula one
 * attribute point is worth ~0.06 score, and a single player must move a 5v5.
 */
import type { Range } from './weapons';
import type { AttrKey, PlayerClass } from '../player';

export type CardId = string;
/** 1 comum · 2 incomum · 3 rara · 4 épica · 5 lendária */
export type CardRarity = 1 | 2 | 3 | 4 | 5;
export type CardType = 'flat' | 'conditional' | 'behavior';
export type CardLevel = 1 | 2 | 3;
export type CardTheme = 'aim' | 'move' | 'peek' | 'tac' | 'util' | 'mental' | 'econ';

export type Behavior = 'scout_round2' | 'save_1v3' | 'awp_discount' | 'always_kit';

/** All fields are AND-ed. `role` is the duelist's role in the duel. */
export interface CardCondition {
  role?: 'attacker' | 'defender';
  holdingAngle?: true;
  flashed?: true;
  clutch?: true;
  trade?: true;
  range?: Range;
  /** CT attacking a planted bomb. */
  retake?: true;
  /** T defending a planted bomb. */
  postplant?: true;
  pistol?: true;
  numbers?: 'up' | 'down';
  /** The duelist's first duel of the round. */
  firstDuel?: true;
  /** Defender standing on the site before the plant. */
  atSite?: true;
}

export type CardEffect =
  | { kind: 'flat'; attr: AttrKey; value: number }
  | { kind: 'conditional'; attr: AttrKey; value: number; when: CardCondition }
  | { kind: 'behavior'; behavior: Behavior };

export interface Card {
  id: CardId;
  name: string;
  rarity: CardRarity;
  type: CardType;
  theme: CardTheme;
  /** Class set tag (GDD 6.3); independent from `type`. */
  tag?: PlayerClass;
  effect: CardEffect;
  /** UI text, pt-BR. `{n}` is replaced by the level-scaled number. */
  text: string;
}

const flat = (attr: AttrKey, value: number): CardEffect => ({ kind: 'flat', attr, value });
const cond = (attr: AttrKey, value: number, when: CardCondition): CardEffect => ({ kind: 'conditional', attr, value, when });
const beh = (behavior: Behavior): CardEffect => ({ kind: 'behavior', behavior });

// Tags: 3 per class (a set needs 3 distinct cards, duplicates level up instead of stacking).
export const CARDS: readonly Card[] = [
  // ------------------------------------------------------------- planas (13)
  { id: 'card_aim_crosshair', name: 'Crosshair placement', rarity: 1, type: 'flat', theme: 'aim', tag: 'rifler', effect: flat('mira', 20), text: '+{n} Mira' },
  { id: 'card_aim_spray', name: 'Controle de spray', rarity: 2, type: 'flat', theme: 'aim', tag: 'rifler', effect: flat('mira', 20), text: '+{n} Mira' },
  { id: 'card_aim_tap', name: 'Tap firing', rarity: 4, type: 'flat', theme: 'aim', tag: 'star', effect: flat('mira', 22), text: '+{n} Mira' },
  { id: 'card_move_strafe', name: 'Counter-strafe', rarity: 1, type: 'flat', theme: 'move', tag: 'awper', effect: flat('mov', 12), text: '+{n} Movimentação' },
  { id: 'card_move_jiggle', name: 'Jiggle peek', rarity: 1, type: 'flat', theme: 'move', tag: 'entry', effect: flat('mov', 12), text: '+{n} Movimentação' },
  { id: 'card_peek_timing', name: 'Timing de peek', rarity: 1, type: 'flat', theme: 'peek', effect: flat('peek', 20), text: '+{n} Peek' },
  { id: 'card_peek_wide', name: 'Wide swing', rarity: 2, type: 'flat', theme: 'peek', tag: 'entry', effect: flat('peek', 20), text: '+{n} Peek' },
  { id: 'card_tac_positioning', name: 'Posicionamento', rarity: 1, type: 'flat', theme: 'tac', tag: 'anchor', effect: flat('tatico', 20), text: '+{n} Tático' },
  { id: 'card_tac_reading', name: 'Leitura de jogo', rarity: 2, type: 'flat', theme: 'tac', tag: 'igl', effect: flat('tatico', 20), text: '+{n} Tático' },
  { id: 'card_util_lineups', name: 'Lineups', rarity: 1, type: 'flat', theme: 'util', tag: 'support', effect: flat('util', 20), text: '+{n} Utilitária' },
  { id: 'card_util_timing', name: 'Timing de util', rarity: 2, type: 'flat', theme: 'util', tag: 'support', effect: flat('util', 20), text: '+{n} Utilitária' },
  { id: 'card_mental_focus', name: 'Foco', rarity: 1, type: 'flat', theme: 'mental', tag: 'star', effect: flat('mental', 22), text: '+{n} Mental' },
  { id: 'card_mental_calm', name: 'Sangue frio', rarity: 2, type: 'flat', theme: 'mental', tag: 'anchor', effect: flat('mental', 22), text: '+{n} Mental' },

  // ------------------------------------------------------- condicionais (13)
  { id: 'card_cond_prefire', name: 'Pré-mira de esquina', rarity: 3, type: 'conditional', theme: 'aim', effect: cond('mira', 38, { role: 'defender', holdingAngle: true }), text: '+{n} Mira quando defende segurando ângulo' },
  { id: 'card_cond_first_contact', name: 'Primeiro contato', rarity: 3, type: 'conditional', theme: 'peek', tag: 'entry', effect: cond('peek', 38, { role: 'attacker', firstDuel: true }), text: '+{n} Peek no primeiro duelo do round atacando' },
  { id: 'card_cond_flash_eyes', name: 'Olhos fechados', rarity: 2, type: 'conditional', theme: 'util', tag: 'support', effect: cond('mira', 38, { flashed: true }), text: '+{n} Mira quando flashado' },
  { id: 'card_cond_clutch_nerves', name: 'Nervos de aço', rarity: 5, type: 'conditional', theme: 'mental', effect: cond('mental', 50, { clutch: true }), text: '+{n} Mental em clutch' },
  { id: 'card_cond_trade_instinct', name: 'Instinto de trade', rarity: 2, type: 'conditional', theme: 'peek', effect: cond('peek', 38, { role: 'attacker', trade: true }), text: '+{n} Peek ao tradar um aliado' },
  { id: 'card_cond_long_range', name: 'Olho de águia', rarity: 2, type: 'conditional', theme: 'aim', tag: 'awper', effect: cond('mira', 25, { range: 'long' }), text: '+{n} Mira em longa distância' },
  { id: 'card_cond_short_range', name: 'Cão de briga', rarity: 1, type: 'conditional', theme: 'aim', tag: 'rifler', effect: cond('mira', 25, { range: 'short' }), text: '+{n} Mira em curta distância' },
  { id: 'card_cond_retake_calm', name: 'Retake frio', rarity: 3, type: 'conditional', theme: 'tac', tag: 'igl', effect: cond('tatico', 38, { retake: true }), text: '+{n} Tático em retake' },
  { id: 'card_cond_postplant', name: 'Pós-plant', rarity: 2, type: 'conditional', theme: 'tac', effect: cond('tatico', 38, { postplant: true }), text: '+{n} Tático defendendo a bomba plantada' },
  { id: 'card_cond_pistol_hero', name: 'Herói do pistol', rarity: 1, type: 'conditional', theme: 'aim', effect: cond('mira', 38, { pistol: true }), text: '+{n} Mira no pistol round' },
  { id: 'card_cond_numbers_down', name: 'Contra a maré', rarity: 3, type: 'conditional', theme: 'mental', effect: cond('mental', 50, { numbers: 'down' }), text: '+{n} Mental em desvantagem numérica' },
  { id: 'card_cond_site_anchor', name: 'Dono do site', rarity: 4, type: 'conditional', theme: 'tac', tag: 'anchor', effect: cond('tatico', 38, { role: 'defender', atSite: true }), text: '+{n} Tático defendendo o site' },
  { id: 'card_cond_star_pick', name: 'Escolha do craque', rarity: 5, type: 'conditional', theme: 'aim', tag: 'star', effect: cond('mira', 45, { numbers: 'up' }), text: '+{n} Mira em vantagem numérica' },

  // -------------------------------------------------------- comportamentais (4)
  { id: 'card_beh_scout', name: 'Scout no pistol', rarity: 2, type: 'behavior', theme: 'econ', tag: 'awper', effect: beh('scout_round2'), text: 'Compra Scout no round 2 se tiver dinheiro' },
  { id: 'card_beh_save', name: 'Salva a arma', rarity: 1, type: 'behavior', theme: 'econ', effect: beh('save_1v3'), text: 'Em 1v3 ou pior, recua e salva em vez de duelar' },
  { id: 'card_beh_awp_discount', name: 'Desconto na AWP', rarity: 3, type: 'behavior', theme: 'econ', effect: beh('awp_discount'), text: 'AWP custa −$500' },
  { id: 'card_beh_kit', name: 'Kit sempre', rarity: 1, type: 'behavior', theme: 'econ', tag: 'igl', effect: beh('always_kit'), text: 'Como CT, compra kit antes de tudo' },
];

const BY_ID: Record<CardId, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function card(id: CardId): Card {
  const c = BY_ID[id];
  if (!c) throw new Error(`Unknown card: ${id}`);
  return c;
}

export function hasCard(id: string): boolean {
  return id in BY_ID;
}

export const LEVEL_MULT: Record<CardLevel, number> = { 1: 1, 2: 1.3, 3: 1.75 }; // [v1]

/** Level scaling (see LEVEL_MULT). Behaviours don't scale. */
export function cardValue(c: Card, level: CardLevel): number {
  if (c.effect.kind === 'behavior') return 0;
  return Math.round(c.effect.value * LEVEL_MULT[level]);
}

export function cardText(c: Card, level: CardLevel): string {
  return c.text.replace('{n}', String(cardValue(c, level)));
}

export const RARITY_NAME: Record<CardRarity, string> = { 1: 'Comum', 2: 'Incomum', 3: 'Rara', 4: 'Épica', 5: 'Lendária' };

/** Drop weights per tier (GDD 6.2). [v0] */
export const RARITY_DROP: Record<CardRarity, number> = { 1: 60, 2: 25, 3: 10, 4: 4, 5: 1 };

export const CARD_LEVEL_MAX: CardLevel = 3;

/** GDD 6.3 slots by level. [v0] */
export function slotsForLevel(level: number): number {
  if (level >= 35) return 6;
  if (level >= 20) return 5;
  if (level >= 12) return 4;
  if (level >= 5) return 3;
  return 2;
}

export const SET_SIZE = 3;

export const CLASS_LABEL: Record<PlayerClass, string> = {
  entry: 'Entry',
  igl: 'IGL',
  awper: 'AWPer',
  anchor: 'Âncora',
  rifler: 'Rifler',
  support: 'Support',
  star: 'Star',
};

/** Set bonus text (GDD 6.3), for the UI. */
export const SET_BONUS_TEXT: Record<PlayerClass, string> = {
  entry: 'Primeiro duelo do round: +10 Peek; trade garantido em 3s se morrer',
  igl: 'Time ganha +8 Tático nas decisões de compra e call',
  awper: 'AWP custa −$500; +6 Mira em longa',
  anchor: '+12% de sobrevivência defendendo o site; +$200 por round sobrevivido',
  support: 'Util do time 15% mais efetiva; flash assist garantido',
  star: '+6 no score do primeiro duelo do round (escolhe o duelo favorável)',
  rifler: 'Sem conjunto: joga de Rifler',
};
