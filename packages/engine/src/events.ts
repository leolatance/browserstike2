/**
 * Event log types (GDD 5.3). The engine's only output is a `MatchLog`; the app
 * replays it at whatever pace it wants. Every event carries `round` and `t`
 * (seconds elapsed inside that round).
 */

export type Side = 'CT' | 'T';
export type PlayerId = string;
export type AreaId = string;
export type SiteId = 'A' | 'B';

export type TCall = 'rushA' | 'rushB' | 'splitA' | 'splitB' | 'default' | 'fake';
export type CTSetup = 'default' | 'stackA' | 'stackB' | 'aggressive';
export type BuyType = 'pistol' | 'eco' | 'force' | 'full';
export type RoundEndReason = 'elimination' | 'bomb' | 'defuse' | 'time';

interface Base {
  /** Round number, 1-based. */
  round: number;
  /** Seconds since the round started. */
  t: number;
}

export interface RoundStartEvent extends Base {
  type: 'roundStart';
  /** Score before this round: [team 0, team 1]. */
  score: [number, number];
  /** Which team index plays each side this round. */
  sides: Record<Side, 0 | 1>;
  /** Money per player at round start (before buying). */
  money: Record<PlayerId, number>;
  buy: Record<Side, BuyType>;
  /** True for rounds 1 and 13 (half starts, $800 each). */
  pistol: boolean;
}

export interface BuyEvent extends Base {
  type: 'buy';
  player: PlayerId;
  weapon: string;
  armor: boolean;
  helmet: boolean;
  kit: boolean;
  utils: string[];
  spent: number;
}

export interface CallEvent extends Base {
  type: 'call';
  side: Side;
  /** Player making the call; undefined when the team has no IGL. */
  caller?: PlayerId;
  call: TCall | CTSetup;
}

export interface MoveEvent extends Base {
  type: 'move';
  player: PlayerId;
  from: AreaId;
  to: AreaId;
  /** Seconds the displacement takes; arrival is at `t + duration`. */
  duration: number;
}

export interface DamageEvent extends Base {
  type: 'damage';
  attacker: PlayerId;
  victim: PlayerId;
  amount: number;
  weapon: string;
  area: AreaId;
}

export interface KillEvent extends Base {
  type: 'kill';
  attacker: PlayerId;
  victim: PlayerId;
  weapon: string;
  headshot: boolean;
  wallbang?: boolean;
  throughSmoke?: boolean;
  /** Where the victim died. */
  area: AreaId;
  /** True when this kill traded a teammate who died within the last 3s. */
  trade?: boolean;
}

export interface AssistEvent extends Base {
  type: 'assist';
  player: PlayerId;
  victim: PlayerId;
}

export interface FlashAssistEvent extends Base {
  type: 'flashAssist';
  player: PlayerId;
  victim: PlayerId;
}

export type UtilKind = 'flash' | 'smoke' | 'molotov' | 'he';

/** A grenade used during a fight. `area` is where it lands. */
export interface UtilEvent extends Base {
  type: 'util';
  player: PlayerId;
  util: UtilKind;
  area: AreaId;
}

export interface PlantEvent extends Base {
  type: 'plant';
  player: PlayerId;
  site: SiteId;
}

export interface DefuseEvent extends Base {
  type: 'defuse';
  player: PlayerId;
  site: SiteId;
  kit: boolean;
}

export interface RoundEndEvent extends Base {
  type: 'roundEnd';
  winner: Side;
  /** Team index that won. */
  winnerTeam: 0 | 1;
  reason: RoundEndReason;
  /** Score after this round: [team 0, team 1]. */
  score: [number, number];
  /** Players alive at the end of the round. */
  survivors: PlayerId[];
  /** Player who won a 1vN clutch this round, if any. */
  clutch?: { player: PlayerId; vs: number };
  /** Player who got 5 kills this round, if any. */
  ace?: PlayerId;
}

export type MatchEvent =
  | RoundStartEvent
  | BuyEvent
  | CallEvent
  | MoveEvent
  | DamageEvent
  | KillEvent
  | AssistEvent
  | FlashAssistEvent
  | UtilEvent
  | PlantEvent
  | DefuseEvent
  | RoundEndEvent;

export type EventType = MatchEvent['type'];

export interface RoundSummary {
  round: number;
  winner: Side;
  winnerTeam: 0 | 1;
  reason: RoundEndReason;
  /** Score after the round: [team 0, team 1]. */
  score: [number, number];
  buy: Record<Side, BuyType>;
  sides: Record<Side, 0 | 1>;
  /** Round duration in seconds. */
  duration: number;
  planted: boolean;
}

export interface PlayerStats {
  id: PlayerId;
  team: 0 | 1;
  kills: number;
  deaths: number;
  assists: number;
  flashAssists: number;
  headshots: number;
  damage: number;
  /** Rounds with a Kill, Assist, Survival or Trade. */
  kastRounds: number;
  rounds: number;
  entryKills: number;
  entryDeaths: number;
  multiKills: { 2: number; 3: number; 4: number; 5: number };
  clutchesWon: number;
  clutchAttempts: number;
  plants: number;
  defuses: number;
  /** Per-match rating (GDD 8.2). */
  rating: number;
  adr: number;
  kast: number;
}

export interface MatchLogTeam {
  id: string;
  name: string;
  players: { id: PlayerId; nick: string; class: string }[];
}

export interface MatchLog {
  version: 1;
  seed: number;
  mapId: string;
  teams: [MatchLogTeam, MatchLogTeam];
  /** Team index that started as CT / T. */
  startingSides: Record<Side, 0 | 1>;
  events: MatchEvent[];
  rounds: RoundSummary[];
  /** Final score: [team 0, team 1]. */
  score: [number, number];
  winner: 0 | 1;
  overtime: boolean;
  stats: PlayerStats[];
}

/** Type-narrowing helper used by the app's replay and by tests. */
export function isEvent<T extends EventType>(
  e: MatchEvent,
  type: T,
): e is Extract<MatchEvent, { type: T }> {
  return e.type === type;
}
