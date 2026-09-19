/**
 * One round (GDD 5.3): buy → call → early contacts → execute → plant →
 * rotation/retake → end. Produces events (including enough `move`s for a
 * radar replay) and per-player round stats. Money changes made here are only
 * purchases and kill rewards; round income is settled by match.ts.
 */
import type { AreaId, BuyType, CTSetup, MatchEvent, PlayerId, RoundEndReason, Side, SiteId, TCall } from './events';
import { addMoney, buyForPlayer, decideTeamBuy, type Inventory } from './economy';
import { weapon, type Weapon } from './data/weapons';
import { headshotChance, resolveDuel, tradeChance, type DuelContext, type Duelist } from './duel';
import { areaRange, shortestPath, type MapDef, type MapSite } from './map';
import { effectiveAttrs, type Attrs, type Player, type PlayerClass } from './player';
import type { Rng } from './rng';

export const ROUND = {
  TIME: 115, // [v0] 1:55
  BOMB_TIMER: 40, // [v0]
  PLANT_TIME: 3, // [v0]
  SITE_CLEAR_TIME: 2, // [v0] clearing corners before the plant starts
  PLANT_DROPPED_EXTRA: 3, // [v0] carrier died: someone else has to pick the bomb
  DEFUSE_TIME: 10, // [v0]
  DEFUSE_TIME_KIT: 5, // [v0]
  /** Route time multiplier = SPEED_SLOW − (SPEED_SLOW − SPEED_FAST) · mov/100 */
  SPEED_SLOW: 1.1, // [v0]
  SPEED_FAST: 0.9, // [v0]

  RUSH_JITTER: 3, // [v0]
  SPLIT_EXEC: 40, // [v0] GDD: execution starts at 40–75s
  SPLIT_EXEC_JITTER: 10, // [v0]
  DEFAULT_DECIDE: 38, // [v0] when a default picks its site
  DEFAULT_DECIDE_JITTER: 8, // [v0]
  FAKE_EXEC: 60, // [v0]
  FAKE_EXEC_JITTER: 8, // [v0]
  FORWARD_FALLBACK: 35, // [v0] aggressive CTs fall back to site by this time

  MID_DUEL_CHANCE: 0.7, // [v0]
  FORWARD_DUEL_CHANCE: 0.8, // [v0]
  CONTACTS_PER_CT: 2, // [v0]

  /** CT reaction to a hit: REACTION_BASE + REACTION_TATICO · (1 − tatico/100) */
  REACTION_BASE: 1, // [v0]
  REACTION_TATICO: 4, // [v0]
  LATE_ROTATOR_DELAY: 4, // [v0] one far-site CT stays for info
  /** P(IGL reads the CT setup) = READ_BASE + READ_TATICO · tatico/100 */
  READ_BASE: 0.15, // [v0]
  READ_TATICO: 0.4, // [v0]
  NO_IGL_BAD_PICK: 0.6, // [v0] without IGL: chance to hit the stacked site

  DUEL_GAP_MIN: 2, // [v0]
  DUEL_GAP_MAX: 6, // [v0]
  RETREAT_REJOIN_T: 18, // [v0] seconds until a retreated T re-engages
  RETREAT_REJOIN_CT: 6, // [v0]
  RETAKE_LATEST: 20, // [v0] CTs stop waiting for teammates this many seconds before the bomb goes off
  /** P(save) when outnumbered = SAVE_BASE + SAVE_TATICO · tatico/100 */
  SAVE_BASE: 0.3, // [v0]
  SAVE_TATICO: 0.4, // [v0]
  WEAPON_PICKUP: 0.7, // [v0]
  FLASH_ASSIST: 0.7, // [v0]
  FLASH_USE: 0.3, // [v0] chance a side pops a flash for a duel when it has one
  SMOKE_DUEL: 0.5, // [v0]

  CT_DEFAULT: 0.65, // [v0]
  CT_STACK_READ: 0.1, // [v0] toward the site T hit last round (scaled by tatico)
  CT_STACK_OTHER: 0.05, // [v0]
  CT_AGGRESSIVE: 0.2, // [v0]
  ECO_STACK: 0.8, // [v0] CT on eco stacks one site

  RUSH_WHEN_POOR: 0.8, // [v0]
  RUSH_WHEN_RICH: 0.3, // [v0]
  FAKE_CHANCE: 0.1, // [v0]
  SPLIT_VS_DEFAULT: 0.5, // [v0]
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Mutable per-player match state, owned by match.ts and updated here. */
export interface RoundPlayer {
  id: PlayerId;
  team: 0 | 1;
  base: Player;
  money: number;
  inv: Inventory;
  /** Current in-match Mental (GDD 5.6). */
  mental: number;
}

export interface RoundTeam {
  index: 0 | 1;
  players: RoundPlayer[];
  lossStreak: number;
}

export interface RoundParams {
  round: number;
  map: MapDef;
  rng: Rng;
  pistol: boolean;
  ct: RoundTeam;
  t: RoundTeam;
  /** Score before the round: [team 0, team 1]. */
  score: [number, number];
  /** T call of the previous round (CT IGL reads tendencies). */
  prevTCall?: TCall;
  /** Force buy types (balance tests). */
  forceBuy?: Partial<Record<Side, BuyType>>;
}

export interface PlayerRoundStats {
  kills: number;
  died: boolean;
  assists: number;
  flashAssists: number;
  headshots: number;
  damage: number;
  /** Kill, Assist, Survived or Traded. */
  kast: boolean;
  entryKill: boolean;
  entryDeath: boolean;
  planted: boolean;
  defused: boolean;
  clutchAttempt: boolean;
  clutchWon: boolean;
  survived: boolean;
}

export interface RoundResult {
  events: MatchEvent[];
  winner: Side;
  winnerTeam: 0 | 1;
  reason: RoundEndReason;
  planted: boolean;
  duration: number;
  buy: Record<Side, BuyType>;
  call: TCall;
  setup: CTSetup;
  survivors: PlayerId[];
  clutch?: { player: PlayerId; vs: number };
  ace?: PlayerId;
  stats: Record<PlayerId, PlayerRoundStats>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Live {
  rp: RoundPlayer;
  side: Side;
  cls: PlayerClass;
  attrs: Attrs;
  hp: number;
  alive: boolean;
  area: AreaId;
  speed: number;
  /** Attacker: when available at the contested site. Defender: when set up. */
  readyAt: number;
  /** Temporarily out of the fight (retreated). */
  retreated: boolean;
  /** Lost the fresh angle (moved / rotated / retreated). */
  moved: boolean;
  saving: boolean;
  /** CT: assigned site ('mid' for the mid player). */
  post: SiteId | 'mid';
  /** CT: currently counted among the defenders of the contested site. */
  atSite: boolean;
  forward: boolean;
  contactsLeft: number;
  /** T: path from current position to the target site (for radar + timing). */
  flashes: number;
  smokes: number;
  damagedBy: PlayerId[];
  flashedBy?: Live;
  carrier: boolean;
  /** Duels fought this round (spreads engagements across the team). */
  engagements: number;
  // stats
  kills: number;
  assists: number;
  flashAssists: number;
  headshots: number;
  damage: number;
  traded: boolean;
  entryKill: boolean;
  entryDeath: boolean;
  planted: boolean;
  defused: boolean;
  clutchAttempt: boolean;
  clutchVs: number;
}

const T_ATTACK_ORDER: PlayerClass[] = ['entry', 'star', 'rifler', 'awper', 'support', 'igl', 'anchor'];
const CT_RETAKE_ORDER: PlayerClass[] = ['entry', 'star', 'rifler', 'awper', 'support', 'igl', 'anchor'];
/** Who gets peeked first when defending (anchor is deepest, last). */
const DEFEND_ORDER: PlayerClass[] = ['rifler', 'entry', 'star', 'support', 'awper', 'igl', 'anchor'];

function orderBy(list: Live[], order: PlayerClass[]): Live[] {
  return list.slice().sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls));
}

/** Next player to take a duel: fewest engagements this round, then class order. */
function nextUp(list: Live[], order: PlayerClass[]): Live {
  return list.slice().sort((a, b) => a.engagements - b.engagements || order.indexOf(a.cls) - order.indexOf(b.cls))[0] as Live;
}

export function simulateRound(params: RoundParams): RoundResult {
  const { map, rng, round } = params;
  const events: MatchEvent[] = [];
  const emit = (e: MatchEvent) => events.push(e);

  const iglOf = (team: RoundTeam) => team.players.find((p) => p.base.class === 'igl');
  const noIgl: Record<Side, boolean> = { CT: !iglOf(params.ct), T: !iglOf(params.t) };

  const mkLive = (rp: RoundPlayer, side: Side): Live => {
    const attrs = effectiveAttrs(rp.base, { mental: rp.mental, noIgl: noIgl[side] });
    return {
      rp,
      side,
      cls: rp.base.class,
      attrs,
      hp: 100,
      alive: true,
      area: map.spawns[side],
      speed: ROUND.SPEED_SLOW - (ROUND.SPEED_SLOW - ROUND.SPEED_FAST) * (attrs.mov / 100),
      readyAt: 0,
      retreated: false,
      moved: false,
      saving: false,
      post: 'mid',
      atSite: false,
      forward: false,
      contactsLeft: ROUND.CONTACTS_PER_CT,
      flashes: 0,
      smokes: 0,
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
      clutchVs: 0,
    };
  };

  const cts = params.ct.players.map((p) => mkLive(p, 'CT'));
  const ts = params.t.players.map((p) => mkLive(p, 'T'));
  const bySide: Record<Side, Live[]> = { CT: cts, T: ts };
  const teamIndex: Record<Side, 0 | 1> = { CT: params.ct.index, T: params.t.index };

  const decisionTatico = (side: Side): number => {
    const list = bySide[side];
    const igl = list.find((l) => l.cls === 'igl');
    if (igl) return igl.attrs.tatico;
    return list.reduce((s, l) => s + l.attrs.tatico, 0) / list.length;
  };

  // ------------------------------------------------------------------ 1. Buy
  const buy: Record<Side, BuyType> = { CT: 'eco', T: 'eco' };
  for (const side of ['CT', 'T'] as Side[]) {
    const team = side === 'CT' ? params.ct : params.t;
    buy[side] =
      params.forceBuy?.[side] ??
      decideTeamBuy(
        {
          side,
          players: team.players.map((p) => ({ money: p.money, inv: p.inv })),
          lossStreak: team.lossStreak,
          tatico: decisionTatico(side),
          pistol: params.pistol,
        },
        rng,
      );
  }

  const money: Record<PlayerId, number> = {};
  for (const l of [...cts, ...ts]) money[l.rp.id] = l.rp.money;
  emit({
    type: 'roundStart',
    round,
    t: 0,
    score: [params.score[0], params.score[1]],
    sides: { CT: teamIndex.CT, T: teamIndex.T },
    money,
    buy: { ...buy },
    pistol: params.pistol,
  });

  for (const side of ['CT', 'T'] as Side[]) {
    const list = bySide[side].slice().sort((a, b) => (a.cls === 'awper' ? -1 : 0) - (b.cls === 'awper' ? -1 : 0));
    let teamHasAwp = list.some((l) => l.rp.inv.weapon === 'awp');
    list.forEach((l, i) => {
      const purchase = buyForPlayer(
        { side, money: l.rp.money, inv: l.rp.inv, class: l.cls, decision: buy[side], teamHasAwp },
        rng,
      );
      l.rp.money = addMoney(l.rp.money, -purchase.spent);
      l.rp.inv = purchase.inv;
      if (purchase.inv.weapon === 'awp') teamHasAwp = true;
      l.flashes = purchase.inv.utils.filter((u) => u === 'flash').length;
      l.smokes = purchase.inv.utils.filter((u) => u === 'smoke').length;
      if (purchase.spent > 0) {
        emit({
          type: 'buy',
          round,
          t: 1 + i,
          player: l.rp.id,
          weapon: purchase.inv.weapon,
          armor: purchase.inv.armor,
          helmet: purchase.inv.helmet,
          kit: purchase.inv.kit,
          utils: [...purchase.inv.utils],
          spent: purchase.spent,
        });
      }
    });
  }

  // ---------------------------------------------------------------- 2. Calls
  const ctIgl = cts.find((l) => l.cls === 'igl');
  const tIgl = ts.find((l) => l.cls === 'igl');
  const setup = chooseCTSetup(rng, ctIgl, params.prevTCall, buy.CT);
  const { call, target } = chooseTCall(rng, tIgl, setup, buy.T, buy.CT === 'eco');
  emit({ type: 'call', round, t: 0, side: 'CT', call: setup, ...(ctIgl ? { caller: ctIgl.rp.id } : {}) });
  emit({ type: 'call', round, t: 0, side: 'T', call, ...(tIgl ? { caller: tIgl.rp.id } : {}) });

  const site: MapSite = map.sites[target];
  const otherSite: SiteId = target === 'A' ? 'B' : 'A';

  // ------------------------------------------------------- helpers: movement
  const move = (l: Live, to: AreaId, startT: number): number => {
    const path = shortestPath(map, l.area, to);
    if (!path || path.path.length < 2) return startT;
    let t = startT;
    for (let i = 0; i < path.path.length - 1; i++) {
      const from = path.path[i] as AreaId;
      const next = path.path[i + 1] as AreaId;
      const leg = shortestPath(map, from, next)!.time;
      const duration = Math.max(1, Math.round(leg * l.speed));
      emit({ type: 'move', round, t: Math.round(t), player: l.rp.id, from, to: next, duration });
      t += duration;
    }
    l.area = to;
    return Math.round(t);
  };

  // ------------------------------------------------- 3. CT setup & positions
  assignCTs(cts, setup, buy.CT === 'eco');
  for (const c of cts) {
    const pos = c.forward ? map.sites[c.post as SiteId].forward : c.post === 'mid' ? map.mid.ct : ctHold(c, cts, map);
    c.readyAt = move(c, pos, 0);
    c.atSite = c.post === target && !c.forward;
  }

  // ------------------------------------------------ 4. T call → paths/timing
  // Phase 1: everyone walks to a staging area (`via`). Phase 2 (after early
  // contacts are resolved) walks from there into the site at `execT`.
  const tOrdered = orderBy(ts, T_ATTACK_ORDER);
  const carrier = ts.find((l) => l.cls === 'support') ?? ts.find((l) => l.cls === 'rifler') ?? (tOrdered[tOrdered.length - 1] as Live);
  carrier.carrier = true;

  interface Plan {
    via: AreaId;
    viaT: number;
    execT: number;
  }
  const plans = new Map<Live, Plan>();
  /** Pre-fight stops: [player, area, arrival] used for early contacts. */
  const stops: { l: Live; area: AreaId; t: number }[] = [];
  const stage = (l: Live, via: AreaId, start: number, execT: number) => {
    stops.push(...pathStops(map, l, map.spawns.T, via, start));
    const viaT = move(l, via, start);
    plans.set(l, { via, viaT, execT });
  };

  if (call === 'rushA' || call === 'rushB') {
    for (const l of ts) stage(l, site.entrances[0], rng.int(0, ROUND.RUSH_JITTER), 0);
  } else if (call === 'splitA' || call === 'splitB') {
    const exec = ROUND.SPLIT_EXEC + rng.int(0, ROUND.SPLIT_EXEC_JITTER);
    tOrdered.forEach((l, i) => stage(l, site.entrances[i < 3 ? 0 : 1], rng.int(0, 3), exec + rng.int(0, 3)));
  } else if (call === 'default') {
    const decide = ROUND.DEFAULT_DECIDE + rng.int(0, ROUND.DEFAULT_DECIDE_JITTER);
    const lane = preArea(map, site.entrances[0]);
    const otherLane = preArea(map, map.sites[otherSite].entrances[0]);
    const lanes: AreaId[] = [map.mid.contact, map.mid.contact, lane, otherLane, lane];
    tOrdered.forEach((l, i) => stage(l, lanes[i] as AreaId, rng.int(0, 3), decide + rng.int(0, 4)));
  } else {
    // fake: show at the other site's lane, then hit the real target late.
    const fakeSite = map.sites[otherSite];
    const exec = ROUND.FAKE_EXEC + rng.int(0, ROUND.FAKE_EXEC_JITTER);
    const fakeLane = preArea(map, fakeSite.entrances[0]);
    for (const l of ts) stage(l, fakeLane, rng.int(0, 3), exec + rng.int(0, 3));
    const seenAt = Math.min(...[...plans.values()].map((p) => p.viaT));
    // One CT from the real site gets pulled toward the fake and must come back.
    const realDefenders = cts.filter((c) => c.post === target && !c.forward);
    if (realDefenders.length >= 2) {
      const pulled = orderBy(realDefenders, DEFEND_ORDER)[0] as Live;
      const react = Math.round(seenAt + reaction(decisionTatico('CT')));
      const there = move(pulled, fakeSite.plant, react);
      pulled.atSite = false;
      pulled.moved = true;
      pulled.post = otherSite;
      pulled.readyAt = there;
    }
  }

  // --------------------------------------------------- shared duel machinery
  let lastKillT = 0;
  let firstKillDone = false;
  const alive = (side: Side) => bySide[side].filter((l) => l.alive);

  const duelist = (l: Live, clutch: boolean): Duelist => ({
    attrs: l.attrs,
    weapon: weapon(l.rp.inv.weapon),
    armor: l.rp.inv.armor,
    hp: l.hp,
    clutch,
  });

  const isClutch = (l: Live): boolean => alive(l.side).length === 1 && alive(l.side === 'CT' ? 'T' : 'CT').length >= 2;
  const markClutch = (l: Live) => {
    if (!l.clutchAttempt && isClutch(l)) {
      l.clutchAttempt = true;
      l.clutchVs = alive(l.side === 'CT' ? 'T' : 'CT').length;
    }
  };

  const bestThrower = (list: Live[]): Live | undefined => {
    let best: Live | undefined;
    for (const l of list) if (l.flashes > 0 && (!best || l.attrs.util > best.attrs.util)) best = l;
    return best;
  };

  const kill = (killer: Live, victim: Live, t: number, area: AreaId, trade: boolean, headshot: boolean) => {
    const w: Weapon = weapon(killer.rp.inv.weapon);
    emit({ type: 'damage', round, t, attacker: killer.rp.id, victim: victim.rp.id, amount: victim.hp, weapon: w.id, area });
    killer.damage += victim.hp;
    emit({ type: 'kill', round, t, attacker: killer.rp.id, victim: victim.rp.id, weapon: w.id, headshot, area, ...(trade ? { trade: true } : {}) });
    victim.alive = false;
    victim.hp = 0;
    killer.kills++;
    if (headshot) killer.headshots++;
    killer.rp.money = addMoney(killer.rp.money, w.killReward);
    lastKillT = Math.max(lastKillT, t);
    if (!firstKillDone) {
      firstKillDone = true;
      killer.entryKill = true;
      victim.entryDeath = true;
    }
    // Assist: last teammate (not the killer) who damaged the victim this round.
    const helper = victim.damagedBy.filter((id) => id !== killer.rp.id).pop();
    if (helper) {
      const h = [...cts, ...ts].find((l) => l.rp.id === helper);
      if (h && h.side === killer.side) {
        h.assists++;
        emit({ type: 'assist', round, t, player: h.rp.id, victim: victim.rp.id });
      }
    }
    if (victim.flashedBy && victim.flashedBy !== killer && victim.flashedBy.side === killer.side && rng.chance(ROUND.FLASH_ASSIST)) {
      victim.flashedBy.flashAssists++;
      emit({ type: 'flashAssist', round, t, player: victim.flashedBy.rp.id, victim: victim.rp.id });
    }
    victim.flashedBy = undefined;
    // Weapon pickup.
    const vw = weapon(victim.rp.inv.weapon);
    if (vw.tier > w.tier && rng.chance(ROUND.WEAPON_PICKUP)) {
      killer.rp.inv = { ...killer.rp.inv, weapon: vw.id };
      victim.rp.inv = { ...victim.rp.inv, weapon: 'knife' };
    }
  };

  interface FightOpts {
    area: AreaId;
    defenderHoldingAngle: boolean;
    retakeProT: 'A' | 'D' | null;
    presentA: Live[];
    presentD: Live[];
    /** Where a retreating attacker/defender goes. */
    fallbackA: AreaId;
    fallbackD: AreaId;
    firstAtSite: boolean;
  }

  /** Resolve one duel (with util and trade) and mutate state. Returns the end time. */
  const fight = (a: Live, d: Live, t: number, o: FightOpts): number => {
    a.engagements++;
    d.engagements++;
    markClutch(a);
    markClutch(d);
    const ctx: DuelContext = {
      range: areaRange(map, o.area),
      defenderHoldingAngle: o.defenderHoldingAngle && !d.moved,
      inSmoke: false,
      retakeProT: o.retakeProT,
      // "2v1": the side with more players alive in the round (GDD 5.5).
      numbersAdvantage: alive(a.side).length > alive(d.side).length ? 'A' : alive(d.side).length > alive(a.side).length ? 'D' : null,
    };
    // Utility: each side may pop a flash on the opponent.
    const aThrower = bestThrower(o.presentA);
    if (aThrower && rng.chance(ROUND.FLASH_USE)) {
      aThrower.flashes--;
      ctx.defenderFlashedBy = aThrower.attrs.util;
      d.flashedBy = aThrower;
    }
    const dThrower = bestThrower(o.presentD);
    if (dThrower && rng.chance(ROUND.FLASH_USE)) {
      dThrower.flashes--;
      ctx.attackerFlashedBy = dThrower.attrs.util;
      a.flashedBy = dThrower;
    }
    if (o.firstAtSite) {
      const smoker = o.presentA.find((l) => l.smokes > 0);
      if (smoker && rng.chance(ROUND.SMOKE_DUEL)) {
        smoker.smokes--;
        ctx.inSmoke = true;
      }
    }

    const res = resolveDuel(duelist(a, isClutch(a)), duelist(d, isClutch(d)), ctx, rng);
    const winner = res.winner === 'A' ? a : d;
    const loser = res.winner === 'A' ? d : a;

    if (res.loserSurvived) {
      emit({ type: 'damage', round, t, attacker: winner.rp.id, victim: loser.rp.id, amount: res.damage, weapon: winner.rp.inv.weapon, area: o.area });
      winner.damage += res.damage;
      loser.hp -= res.damage;
      loser.damagedBy.push(winner.rp.id);
      loser.retreated = true;
      loser.moved = true;
      loser.flashedBy = undefined;
      const fallback = loser === a ? o.fallbackA : o.fallbackD;
      const back = move(loser, fallback, t);
      loser.readyAt = Math.max(back, t + (loser.side === 'T' ? ROUND.RETREAT_REJOIN_T : ROUND.RETREAT_REJOIN_CT));
      return t;
    }

    kill(winner, loser, t, o.area, false, res.headshot);
    winner.flashedBy = undefined;
    // Trade: the next present teammate of the loser re-peeks the winner.
    const mates = (loser === a ? o.presentA : o.presentD).filter((l) => l !== loser && l.alive && !l.retreated);
    const trader = orderBy(mates, loser.side === 'T' ? T_ATTACK_ORDER : DEFEND_ORDER)[0];
    if (trader && rng.chance(tradeChance(trader.attrs.peek))) {
      const tt = t + rng.int(1, 3);
      kill(trader, winner, tt, o.area, true, rng.chance(headshotChance(trader.attrs.mira)));
      loser.traded = true;
      return tt;
    }
    return t;
  };

  // ------------------------------------------------------ 5. Early contacts
  stops.sort((x, y) => x.t - y.t);
  for (const s of stops) {
    if (!s.l.alive || s.l.retreated) continue;
    let ct: Live | undefined;
    let chance = 0;
    if (s.area === map.mid.contact) {
      ct = cts.find((c) => c.alive && !c.retreated && c.post === 'mid' && c.contactsLeft > 0 && c.readyAt <= s.t);
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
    const opts: FightOpts = {
      area: s.area,
      defenderHoldingAngle: !tInit,
      retakeProT: null,
      presentA: tInit ? [s.l, ...near] : [ct],
      presentD: tInit ? [ct] : [s.l, ...near],
      fallbackA: tInit ? map.spawns.T : ctFallback(ct, map),
      fallbackD: tInit ? ctFallback(ct, map) : map.spawns.T,
      firstAtSite: false,
    };
    const tEnd = tInit ? fight(s.l, ct, s.t, opts) : fight(ct, s.l, s.t, opts);
    if (s.l.alive && s.l.retreated) {
      // Fell back to spawn; re-enters the site later (phase 2 handles the walk).
      s.l.retreated = false;
      const plan = plans.get(s.l) as Plan;
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
  // Forward CTs fall back to their site by FORWARD_FALLBACK.
  for (const c of cts) {
    if (c.alive && c.forward) {
      c.forward = false;
      c.readyAt = move(c, ctHold(c, cts, map), Math.max(c.readyAt, ROUND.FORWARD_FALLBACK));
      c.atSite = c.post === target;
    }
  }
  // Phase 2: survivors walk from their staging area into the site.
  for (const l of ts) {
    if (!l.alive) continue;
    const plan = plans.get(l) as Plan;
    l.readyAt = move(l, site.plant, Math.max(plan.viaT, plan.execT));
  }

  // ----------------------------------------------------------- 6. Execution
  let alerted = false;
  const alertRotations = (t: number) => {
    if (alerted) return;
    alerted = true;
    const react = reaction(decisionTatico('CT'));
    let delayed = false;
    for (const c of orderBy(cts, DEFEND_ORDER).reverse()) {
      if (!c.alive || c.atSite) continue;
      let start = Math.round(t + react);
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

  const presentAttackers = (t: number) => ts.filter((l) => l.alive && !l.saving && !l.retreated && l.readyAt <= t);
  const presentDefenders = (t: number) => cts.filter((l) => l.alive && !l.saving && !l.retreated && l.atSite && l.readyAt <= t);

  let t = Math.min(...ts.map((l) => l.readyAt));
  let planted = false;
  let plantT = 0;
  let reason: RoundEndReason | null = null;
  let winner: Side | null = null;
  let endT = 0;
  let firstAtSite = true;

  const finish = (w: Side, r: RoundEndReason, at: number) => {
    winner = w;
    reason = r;
    endT = Math.min(Math.round(at), ROUND.TIME + ROUND.BOMB_TIMER);
  };

  for (let guard = 0; guard < 400 && !winner; guard++) {
    // Retreated players rejoin when their timer is up.
    for (const l of [...ts, ...cts]) if (l.alive && l.retreated && l.readyAt <= t) l.retreated = false;

    if (alive('T').length === 0) {
      finish('CT', 'elimination', lastKillT);
      break;
    }
    if (alive('CT').length === 0) {
      finish('T', 'elimination', lastKillT);
      break;
    }
    if (t >= ROUND.TIME) {
      finish('CT', 'time', ROUND.TIME);
      break;
    }

    const pa = presentAttackers(t);
    const pd = presentDefenders(t);

    if (pa.length === 0) {
      const pending = ts.filter((l) => l.alive && !l.saving && l.readyAt > t);
      if (pending.length === 0) {
        finish('CT', 'time', ROUND.TIME);
        break;
      }
      // Outnumbered after a failed hit? Save.
      const tAlive = alive('T').length;
      const ctAlive = alive('CT').length;
      const next = Math.min(...pending.map((l) => l.readyAt));
      if (tAlive < ctAlive && tAlive <= 2 && alerted) {
        const tat = decisionTatico('T');
        if (next > ROUND.TIME - 15 || rng.chance(ROUND.SAVE_BASE + ROUND.SAVE_TATICO * (tat / 100))) {
          for (const l of alive('T')) {
            l.saving = true;
            move(l, map.spawns.T, t);
          }
          finish('CT', 'time', ROUND.TIME);
          break;
        }
      }
      t = Math.max(t + 1, next);
      continue;
    }

    if (pd.length === 0) {
      alertRotations(t);
      // Site is clear: Ts plant. CTs still on the way set up for the retake
      // instead of running in one by one.
      const carrierDead = !ts.some((l) => l.alive && l.carrier);
      const plantAt = t + ROUND.SITE_CLEAR_TIME + ROUND.PLANT_TIME + (carrierDead ? ROUND.PLANT_DROPPED_EXTRA : 0);
      if (plantAt >= ROUND.TIME) {
        finish('CT', 'time', ROUND.TIME);
        break;
      }
      const planter = orderBy(pa, ['support', 'rifler', 'igl', 'anchor', 'awper', 'star', 'entry'])[0] as Live;
      emit({ type: 'plant', round, t: plantAt, player: planter.rp.id, site: target });
      planter.planted = true;
      planted = true;
      plantT = plantAt;
      t = plantAt;
      break;
    }

    alertRotations(t);
    const a = nextUp(pa, T_ATTACK_ORDER);
    const d = nextUp(pd, DEFEND_ORDER);
    const tEnd = fight(a, d, t, {
      area: site.plant,
      defenderHoldingAngle: true,
      retakeProT: null,
      presentA: pa,
      presentD: pd,
      fallbackA: site.entrances[0],
      fallbackD: ctFallback(d, map),
      firstAtSite,
    });
    firstAtSite = false;
    t = tEnd + rng.int(ROUND.DUEL_GAP_MIN, ROUND.DUEL_GAP_MAX);
  }

  // ---------------------------------------------------------- 7. Post-plant
  if (!winner && planted) {
    const explodeAt = plantT + ROUND.BOMB_TIMER;
    // Ts set up post-plant positions.
    for (const l of ts) {
      if (!l.alive) continue;
      l.moved = false;
      if (l.retreated) l.readyAt = Math.min(l.readyAt, plantT + 8);
    }
    // CTs decide to retake or save.
    const ctAlive = alive('CT');
    const tAlive = alive('T');
    const tat = decisionTatico('CT');
    if (ctAlive.length < tAlive.length && rng.chance(ROUND.SAVE_BASE + ROUND.SAVE_TATICO * (tat / 100))) {
      for (const c of ctAlive) {
        c.saving = true;
        move(c, map.spawns.CT, t);
      }
      finish('T', 'bomb', explodeAt);
    }

    // Retakers regroup: the push starts when everyone has arrived, or when
    // waiting any longer would leave no time to defuse.
    const retakers = cts.filter((l) => l.alive && !l.saving);
    const regroupAt = retakers.length ? Math.min(Math.max(...retakers.map((l) => l.readyAt)), explodeAt - ROUND.RETAKE_LATEST) : plantT;
    const presentCT = (at: number) => (at < regroupAt ? [] : cts.filter((l) => l.alive && !l.saving && !l.retreated && l.readyAt <= at));
    const presentT = (at: number) => ts.filter((l) => l.alive && !l.retreated && l.readyAt <= at);

    t = Math.max(t, plantT + 2);
    for (let guard = 0; guard < 400 && !winner; guard++) {
      for (const l of [...ts, ...cts]) if (l.alive && l.retreated && l.readyAt <= t) l.retreated = false;

      if (alive('CT').length === 0) {
        finish('T', 'elimination', lastKillT);
        break;
      }
      if (alive('T').length === 0) {
        const defusers = cts.filter((l) => l.alive && !l.saving);
        const kit = defusers.some((l) => l.rp.inv.kit);
        const arrival = Math.max(lastKillT, Math.min(...defusers.map((l) => l.readyAt)));
        const done = arrival + (kit ? ROUND.DEFUSE_TIME_KIT : ROUND.DEFUSE_TIME);
        if (done <= explodeAt) {
          const defuser = defusers.find((l) => l.rp.inv.kit) ?? (defusers[0] as Live);
          emit({ type: 'defuse', round, t: done, player: defuser.rp.id, site: target, kit });
          defuser.defused = true;
          finish('CT', 'defuse', done);
        } else finish('T', 'bomb', explodeAt);
        break;
      }
      if (t >= explodeAt) {
        finish('T', 'bomb', explodeAt);
        break;
      }

      const pc = presentCT(t);
      const pt = presentT(t);
      if (pc.length === 0) {
        const pending = cts.filter((l) => l.alive && !l.saving && l.readyAt > t).map((l) => l.readyAt);
        const next = Math.max(regroupAt, pending.length ? Math.min(...pending) : 0);
        if (next <= t) {
          finish('T', 'bomb', explodeAt);
          break;
        }
        t = Math.max(t + 1, next);
        continue;
      }
      if (pt.length === 0) {
        // Ts retreated: CTs try to defuse before they come back.
        const kit = pc.some((l) => l.rp.inv.kit);
        const done = t + (kit ? ROUND.DEFUSE_TIME_KIT : ROUND.DEFUSE_TIME);
        const back = ts.filter((l) => l.alive && l.readyAt > t).map((l) => l.readyAt);
        const nextT = back.length ? Math.min(...back) : Infinity;
        if (nextT < done) {
          t = nextT;
          continue;
        }
        if (done <= explodeAt) {
          const defuser = pc.find((l) => l.rp.inv.kit) ?? (pc[0] as Live);
          emit({ type: 'defuse', round, t: done, player: defuser.rp.id, site: target, kit });
          defuser.defused = true;
          finish('CT', 'defuse', done);
        } else finish('T', 'bomb', explodeAt);
        break;
      }

      const a = nextUp(pc, CT_RETAKE_ORDER);
      const d = nextUp(pt, DEFEND_ORDER);
      const tEnd = fight(a, d, t, {
        area: site.plant,
        // Post-plant Ts are set up but not on fresh angles: GDD's +5 applies instead.
        defenderHoldingAngle: false,
        retakeProT: 'D',
        presentA: pc,
        presentD: pt,
        fallbackA: ctFallback(a, map),
        fallbackD: site.entrances[0],
        firstAtSite: false,
      });
      t = tEnd + rng.int(ROUND.DUEL_GAP_MIN, ROUND.DUEL_GAP_MAX);
    }
  }

  if (!winner) finish('CT', 'time', ROUND.TIME);
  const finalWinner = winner as unknown as Side;
  const finalReason = reason as unknown as RoundEndReason;

  // -------------------------------------------------------------- 8. Wrap up
  const survivors = [...cts, ...ts].filter((l) => l.alive).map((l) => l.rp.id);
  const stats: Record<PlayerId, PlayerRoundStats> = {};
  let clutch: RoundResult['clutch'];
  let ace: PlayerId | undefined;
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
    };
  }

  const score: [number, number] = [params.score[0], params.score[1]];
  const winnerTeam = teamIndex[finalWinner];
  score[winnerTeam]++;
  emit({
    type: 'roundEnd',
    round,
    t: endT,
    winner: finalWinner,
    winnerTeam,
    reason: finalReason,
    score,
    survivors,
    ...(clutch ? { clutch } : {}),
    ...(ace ? { ace } : {}),
  });

  // Drop movements scheduled after the round ended (late rotations, saves),
  // clamp buzzer-beater kills/trades to the final second, then stable-sort by
  // time; insertion order breaks ties (roundEnd was emitted last).
  const indexed = events
    .filter((e) => !(e.type === 'move' && e.t > endT))
    .map((e, i) => ({ e: e.t > endT ? { ...e, t: endT } : e, i }));
  indexed.sort((x, y) => x.e.t - y.e.t || x.i - y.i);

  const result: RoundResult = {
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
    stats,
  };
  if (clutch) result.clutch = clutch;
  if (ace) result.ace = ace;
  return result;
}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

function reaction(tatico: number): number {
  return ROUND.REACTION_BASE + ROUND.REACTION_TATICO * (1 - tatico / 100);
}

function chooseCTSetup(rng: Rng, igl: Live | undefined, prev: TCall | undefined, buy: BuyType): CTSetup {
  const options: CTSetup[] = ['default', 'stackA', 'stackB', 'aggressive'];
  // Broke CTs stack a site and pray (real-CS eco behaviour). [v0]
  if (buy === 'eco' && rng.chance(ROUND.ECO_STACK)) return rng.pick(['stackA', 'stackB'] as CTSetup[]);
  if (!igl) return rng.pick(options);
  const prevSite: SiteId | null = prev ? (prev.endsWith('A') ? 'A' : prev.endsWith('B') ? 'B' : null) : null;
  const tat = igl.attrs.tatico / 100;
  const wRead = prevSite ? ROUND.CT_STACK_READ * tat : 0;
  const wOther = prevSite ? ROUND.CT_STACK_OTHER : (ROUND.CT_STACK_READ + ROUND.CT_STACK_OTHER) / 2;
  const weights: [CTSetup, number][] = [
    ['default', ROUND.CT_DEFAULT + (prevSite ? ROUND.CT_STACK_READ * (1 - tat) : 0)],
    [prevSite === 'B' ? 'stackB' : 'stackA', prevSite ? wRead : wOther],
    [prevSite === 'B' ? 'stackA' : 'stackB', wOther],
    ['aggressive', ROUND.CT_AGGRESSIVE],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [s, w] of weights) {
    r -= w;
    if (r <= 0) return s;
  }
  return 'default';
}

function defendersBySetup(setup: CTSetup, eco = false): Record<SiteId, number> {
  // On an eco the stack is a full 4-man site (mid player still roams). [v0]
  switch (setup) {
    case 'stackA':
      return eco ? { A: 4, B: 0 } : { A: 3, B: 1 };
    case 'stackB':
      return eco ? { A: 0, B: 4 } : { A: 1, B: 3 };
    default:
      return { A: 2, B: 2 };
  }
}

function chooseTCall(rng: Rng, igl: Live | undefined, setup: CTSetup, buy: BuyType, ctEco: boolean): { call: TCall; target: SiteId } {
  const def = defendersBySetup(setup, ctEco);
  const weaker: SiteId | null = def.A < def.B ? 'A' : def.B < def.A ? 'B' : null;
  let target: SiteId;
  if (igl) {
    const read = rng.chance(ROUND.READ_BASE + ROUND.READ_TATICO * (igl.attrs.tatico / 100));
    target = read && weaker ? weaker : rng.pick(['A', 'B'] as SiteId[]);
  } else if (weaker && rng.chance(ROUND.NO_IGL_BAD_PICK)) {
    target = weaker === 'A' ? 'B' : 'A';
  } else {
    target = rng.pick(['A', 'B'] as SiteId[]);
  }
  const poor = buy === 'eco' || buy === 'pistol' || buy === 'force';
  if (rng.chance(poor ? ROUND.RUSH_WHEN_POOR : ROUND.RUSH_WHEN_RICH)) {
    return { call: target === 'A' ? 'rushA' : 'rushB', target };
  }
  if (igl && rng.chance(ROUND.FAKE_CHANCE)) return { call: 'fake', target };
  if (rng.chance(ROUND.SPLIT_VS_DEFAULT)) return { call: target === 'A' ? 'splitA' : 'splitB', target };
  return { call: 'default', target };
}

/** Assign CTs to A / B / mid according to the setup. Mutates `post`/`forward`. */
function assignCTs(cts: Live[], setup: CTSetup, eco: boolean): void {
  const counts = defendersBySetup(setup, eco);
  const slots: (SiteId | 'mid')[] = [];
  for (let i = 0; i < counts.A; i++) slots.push('A');
  slots.push('mid');
  for (let i = 0; i < counts.B; i++) slots.push('B');
  const order: PlayerClass[] = ['anchor', 'awper', 'igl', 'support', 'rifler', 'star', 'entry'];
  const sorted = orderBy(cts, order);
  const taken = new Set<number>();
  for (const c of sorted) {
    let idx = -1;
    if (c.cls === 'awper') idx = slots.findIndex((s, i) => s === 'mid' && !taken.has(i));
    if (c.cls === 'anchor') idx = slots.findIndex((s, i) => s !== 'mid' && !taken.has(i));
    if (idx < 0) idx = slots.findIndex((_, i) => !taken.has(i));
    taken.add(idx);
    c.post = slots[idx] as SiteId | 'mid';
    c.forward = false;
  }
  if (setup === 'aggressive') {
    for (const site of ['A', 'B'] as SiteId[]) {
      const candidates = cts.filter((c) => c.post === site && c.cls !== 'anchor');
      const pusher = orderBy(candidates, ['entry', 'star', 'rifler', 'support', 'igl', 'awper', 'anchor'])[0];
      if (pusher && candidates.length >= 1 && cts.filter((c) => c.post === site).length >= 2) pusher.forward = true;
    }
  }
}

function ctHold(c: Live, cts: Live[], map: MapDef): AreaId {
  if (c.post === 'mid') return map.mid.ct;
  const site = map.sites[c.post];
  const mates = cts.filter((x) => x.post === c.post);
  const i = mates.indexOf(c);
  return site.holds[i % site.holds.length] as AreaId;
}

function ctFallback(c: Live, map: MapDef): AreaId {
  return map.spawns.CT === c.area ? map.mid.ct : map.spawns.CT;
}

/** Area right before `entrance` on the T path (where lanes are contested). */
function preArea(map: MapDef, entrance: AreaId): AreaId {
  const p = shortestPath(map, map.spawns.T, entrance);
  return p ? (p.path[p.path.length - 2] ?? map.spawns.T) : map.spawns.T;
}

/** Areas a player passes through on the way (mid contact / forward areas only). */
function pathStops(map: MapDef, l: Live, from: AreaId, to: AreaId, start: number): { l: Live; area: AreaId; t: number }[] {
  const p = shortestPath(map, from, to);
  if (!p) return [];
  const watch = new Set<AreaId>([map.mid.contact, map.sites.A.forward, map.sites.B.forward]);
  const out: { l: Live; area: AreaId; t: number }[] = [];
  let t = start;
  for (let i = 0; i < p.path.length; i++) {
    const a = p.path[i] as AreaId;
    if (i > 0) t += Math.round(shortestPath(map, p.path[i - 1] as AreaId, a)!.time * l.speed);
    if (watch.has(a)) out.push({ l, area: a, t: Math.round(t) });
  }
  return out;
}
