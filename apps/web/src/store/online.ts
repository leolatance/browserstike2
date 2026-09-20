/**
 * Online queue client (Fase 2b). The server simulates and settles; the client
 * only replays seed + config and shows what the server decided.
 */
import type { MatchLog, Team } from '@idle-strike/engine';
import { supabase } from './supabase';

export interface OnlineRewards {
  xp: number;
  mmrBefore: number;
  mmrAfter: number;
  mmrDelta: number;
  rankBefore: string;
  rankAfter: string;
  level: number;
  reached: number[];
  cards: { card: string; from: number | null; to: number }[];
}

export type QueueResponse =
  | { status: 'waiting'; found: number; range: number; nextRange: number; retryInSec: number }
  | {
      status: 'ready';
      matchId: number;
      seed: number;
      config: { mapId: string; teams: [Team, Team]; startingCT: 0 | 1 };
      myId: string;
      myTeam: 0 | 1;
      hash: string;
      result: { score: [number, number]; winner: 0 | 1; rating: number; won: boolean };
      rewards: OnlineRewards;
      realPlayers: number;
    }
  | { error: string; retryInSec?: number };

export async function queueOnline(attempt: number): Promise<QueueResponse> {
  if (!supabase) return { error: 'cloud_off' };
  const { data, error } = await supabase.functions.invoke('queue_match', { body: { attempt } });
  if (error) {
    // Non-2xx responses surface here; try to read the body.
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        return (await ctx.json()) as QueueResponse;
      } catch {
        /* fall through */
      }
    }
    return { error: error.message };
  }
  return data as QueueResponse;
}

/** Same FNV-1a as the server (supabase/functions/_shared/queue.ts). */
export function logHash(log: MatchLog): string {
  const s = JSON.stringify(log.events);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface MyMmr {
  mmr: number;
  matches: number;
  seasonId: number;
}

export async function fetchMyMmr(): Promise<MyMmr | null> {
  if (!supabase) return null;
  const { data: season } = await supabase.rpc('current_season_id');
  if (!season) return null;
  const { data } = await supabase.from('mmr').select('mmr, matches').eq('season_id', season as number).maybeSingle();
  return { mmr: (data?.mmr as number) ?? 1000, matches: (data?.matches as number) ?? 0, seasonId: season as number };
}

export interface PassiveRow {
  id: number;
  rating: number;
  won: boolean;
  team: 0 | 1;
  player_id: string;
  xp: number;
  cards: string[] | null;
  played_at: string;
  match: { id: number; seed: number; config: { mapId: string; teams: [Team, Team]; startingCT: 0 | 1 }; result: { score: [number, number]; winner: 0 | 1 } } | null;
}

/** Passive participations not shown yet (the character played while the owner was away). */
export async function unseenPassive(): Promise<PassiveRow[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('online_participations')
    .select('id, rating, won, team, player_id, xp, cards, played_at, match:online_matches(id, seed, config, result)')
    .eq('present', false)
    .eq('seen', false)
    .order('played_at', { ascending: false })
    .limit(20);
  return ((data as unknown as PassiveRow[]) ?? []).map((r) => ({ ...r, match: Array.isArray(r.match) ? ((r.match as unknown[])[0] as PassiveRow['match']) ?? null : r.match }));
}

export async function markSeen(ids: number[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  await supabase.from('online_participations').update({ seen: true }).in('id', ids);
}

export interface LadderRow {
  nick: string;
  color: string;
  photo_url: string | null;
  mmr: number;
  matches: number;
  pos: number;
  rating?: number;
  rating_global?: number;
  pos_global?: number;
}

export async function fetchLadder(kind: 'rating' | 'mmr', seasonId: number, global = false): Promise<LadderRow[]> {
  if (!supabase) return [];
  const view = kind === 'rating' ? 'ladder_rating' : 'ladder_mmr';
  const order = kind === 'rating' ? (global ? 'pos_global' : 'pos') : 'pos';
  const { data } = await supabase.from(view).select('*').eq('season_id', seasonId).order(order, { ascending: true }).limit(200);
  return (data as LadderRow[]) ?? [];
}
