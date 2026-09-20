/**
 * In-memory hand-off between screens (queue → match → resultado). Nothing here
 * survives a reload on purpose: the match is only "real" once saved in Dexie.
 */
import type { MatchLog, Team } from '@idle-strike/engine';
import type { DuelTargetStats } from '../minigames/duelTarget';
import type { OnlineRewards } from './online';

export interface OnlineInfo {
  matchId: number;
  hash: string;
  rewards: OnlineRewards;
  result: { score: [number, number]; winner: 0 | 1; rating: number; won: boolean };
  realPlayers: number;
}

export interface MatchSource {
  kind: 'queue' | 'replay' | 'dev' | 'online';
  /** Server-decided data for an online match. */
  online?: OnlineInfo;
  seed: number;
  config: { mapId: string; teams: [Team, Team]; startingCT: 0 | 1 };
  /** Character's player id in the teams (queue/replay). */
  myId: string;
  myTeam: 0 | 1;
  /** Saved match id when replaying. */
  matchId?: number;
}

export interface MatchOutcome {
  source: MatchSource;
  log: MatchLog;
  minigame: DuelTargetStats | null;
  /** Set once /resultado has persisted it. */
  savedId?: number;
}

let pending: MatchSource | null = null;
let outcome: MatchOutcome | null = null;

export function setPendingMatch(src: MatchSource | null): void {
  pending = src;
}

/** Reads without consuming: the queue hand-off stays until /resultado persists it (StrictMode-safe). */
export function peekPendingMatch(): MatchSource | null {
  return pending;
}

export function setOutcome(o: MatchOutcome | null): void {
  outcome = o;
}

export function getOutcome(): MatchOutcome | null {
  return outcome;
}
