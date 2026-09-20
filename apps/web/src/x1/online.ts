/**
 * x1 online client: edge function calls, invite rendezvous, match fetch, ladder.
 * The server draws the seed and writes the match; both clients simulate locally.
 */
import type { Attrs } from '@idle-strike/engine';
import { supabase } from '../store/supabase';

export type X1Kind = 'build' | 'mira';

export interface X1SidePlayer {
  id: string;
  nick: string;
  class: string;
  attrs: Attrs;
  build: { cards: { id: string; level: number }[] };
}

export interface X1Side {
  user_id: string;
  nick: string;
  color: string;
  attrs: Attrs;
  build: { id: string; level: number }[];
  player: X1SidePlayer;
}

export interface X1ResultRow {
  score: [number, number];
  winner: 'host' | 'guest';
  reason: string;
}

export interface X1MatchRow {
  id: number;
  kind: X1Kind;
  host_id: string;
  guest_id: string;
  seed: number;
  config: { mapId: string; host: X1Side; guest: X1Side };
  status: 'ready' | 'done' | 'wo';
  start_at: string;
  result: X1ResultRow | null;
}

export interface InviteRow {
  code: string;
  host_id: string;
  host_nick: string | null;
  kind: X1Kind;
  target_nick: string | null;
  created_at: string;
  accepted_by: string | null;
  match_id: number | null;
}

/** Estimated server clock offset (serverNow − Date.now()), refreshed by every function call. */
let offsetMs = 0;
export function serverNow(): number {
  return Date.now() + offsetMs;
}
export function serverOffset(): number {
  return offsetMs;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('cloud_off');
  const sent = Date.now();
  const { data, error } = await supabase.functions.invoke('x1_create', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const j = (await ctx.json()) as { error?: string };
        throw new Error(j.error ?? error.message);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
    throw new Error(error.message);
  }
  const d = data as T & { error?: string; serverNow?: number };
  if (d?.error) throw new Error(d.error);
  if (typeof d?.serverNow === 'number') {
    // Assume symmetric latency: the server stamped half-way through the round trip.
    const rtt = Date.now() - sent;
    offsetMs = d.serverNow + rtt / 2 - Date.now();
  }
  return d;
}

export async function createInvite(kind: X1Kind, targetNick?: string): Promise<{ code: string; kind: X1Kind }> {
  const r = await call<{ code: string; kind: X1Kind }>({ action: 'invite', kind, targetNick: targetNick?.trim() || undefined });
  if (targetNick?.trim()) {
    const me = await hostNick();
    void notifyInbox(targetNick.trim(), { type: 'invite', code: r.code, kind, hostNick: me });
  }
  return r;
}

export async function peekInvite(code: string): Promise<{ kind: X1Kind; hostNick: string; hostId: string; matchId: number | null; targetNick: string | null }> {
  return call({ action: 'peek', code: code.toUpperCase() });
}

export async function acceptInvite(code: string): Promise<X1MatchRow> {
  const r = await call<{ match: X1MatchRow }>({ action: 'accept', code: code.toUpperCase() });
  return r.match;
}

export interface EloInfo {
  winner: { before: number; after: number };
  loser: { before: number; after: number };
}

export async function reportResult(matchId: number, score: [number, number], winner: 'host' | 'guest', reason: string): Promise<{ result: X1ResultRow; elo: Partial<EloInfo>; already?: boolean }> {
  return call({ action: 'result', matchId, score, winner, reason });
}

export async function reportWo(matchId: number): Promise<{ result: X1ResultRow; elo: Partial<EloInfo>; already?: boolean }> {
  return call({ action: 'wo', matchId });
}

export async function fetchMatch(id: number): Promise<X1MatchRow | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('x1_matches').select('*').eq('id', id).maybeSingle();
  return (data as X1MatchRow | null) ?? null;
}

async function hostNick(): Promise<string> {
  if (!supabase) return '';
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return '';
  const { data } = await supabase.from('profiles').select('nick').eq('user_id', u.user.id).maybeSingle();
  return (data?.nick as string) ?? '';
}

// ---------------------------------------------------------------------------
// Rendezvous channels
// ---------------------------------------------------------------------------
export const inviteChannel = (code: string) => `x1-invite:${code.toUpperCase()}`;
export const matchChannel = (id: number) => `x1:${id}`;
export const inboxChannel = (nick: string) => `x1-inbox:${nick.trim().toLowerCase()}`;

async function subscribed(name: string) {
  const ch = supabase!.channel(name, { config: { broadcast: { self: false } } });
  await new Promise<void>((resolve, reject) => {
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
    });
  });
  return ch;
}

/** One-shot broadcast: subscribe, send, leave. */
async function shout(name: string, event: string, payload: Record<string, unknown>): Promise<void> {
  if (!supabase) return;
  const ch = await subscribed(name);
  await ch.send({ type: 'broadcast', event, payload });
  setTimeout(() => void supabase?.removeChannel(ch), 1500);
}

export async function announceAccepted(code: string, match: X1MatchRow): Promise<void> {
  await shout(inviteChannel(code), 'accepted', { match, at: serverNow() });
}

export async function notifyInbox(nick: string, payload: Record<string, unknown>): Promise<void> {
  await shout(inboxChannel(nick), 'invite', payload);
}

/** Host side: resolves when the guest accepts (broadcast, with a 3s poll as fallback). */
export function watchInvite(code: string, onMatch: (m: X1MatchRow) => void): () => void {
  if (!supabase) return () => undefined;
  let done = false;
  const ch = supabase.channel(inviteChannel(code), { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'accepted' }, ({ payload }) => {
    if (done) return;
    done = true;
    onMatch((payload as { match: X1MatchRow }).match);
  }).subscribe();
  const poll = window.setInterval(async () => {
    if (done) return;
    const { data } = await supabase!.from('x1_invites').select('match_id').eq('code', code.toUpperCase()).maybeSingle();
    const id = data?.match_id as number | null | undefined;
    if (id && !done) {
      const m = await fetchMatch(id);
      if (m && !done) {
        done = true;
        onMatch(m);
      }
    }
  }, 3000);
  return () => {
    done = true;
    clearInterval(poll);
    void supabase?.removeChannel(ch);
  };
}

export interface InboxInvite {
  code: string;
  kind: X1Kind;
  hostNick: string;
}

/** Lobby: pending invites addressed to `nick` (last 15 min), plus live ones over Realtime. */
export function watchInbox(nick: string, onInvites: (list: InboxInvite[]) => void): () => void {
  if (!supabase) return () => undefined;
  const seen = new Map<string, InboxInvite>();
  const emit = () => onInvites([...seen.values()]);
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  void supabase
    .from('x1_invites')
    .select('code, kind, host_nick, accepted_by, created_at')
    .eq('target_nick', nick)
    .is('accepted_by', null)
    .gte('created_at', since)
    .then(({ data }) => {
      for (const r of (data ?? []) as Pick<InviteRow, 'code' | 'kind' | 'host_nick'>[]) seen.set(r.code, { code: r.code, kind: r.kind, hostNick: r.host_nick ?? '?' });
      emit();
    });
  const ch = supabase.channel(inboxChannel(nick), { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
    const p = payload as InboxInvite;
    seen.set(p.code, { code: p.code, kind: p.kind, hostNick: p.hostNick });
    emit();
  }).subscribe();
  return () => {
    void supabase?.removeChannel(ch);
  };
}

// ---------------------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------------------
export interface X1LadderRow {
  pos: number;
  nick: string;
  color: string;
  photo_url: string | null;
  elo: number;
  matches: number;
  wins: number;
}

export async function fetchLadderX1(): Promise<X1LadderRow[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('ladder_x1').select('*').order('pos');
  return (data ?? []) as X1LadderRow[];
}

export async function fetchMyX1(): Promise<{ elo: number; matches: number; wins: number } | null> {
  if (!supabase) return null;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from('x1_ratings').select('elo, matches, wins').eq('user_id', u.user.id).maybeSingle();
  return (data as { elo: number; matches: number; wins: number } | null) ?? null;
}

// ---------------------------------------------------------------------------
// In-memory hand-off (accept → match screen); the screen refetches on reload.
// ---------------------------------------------------------------------------
let pending: X1MatchRow | null = null;
export function setPendingX1(m: X1MatchRow | null): void {
  pending = m;
}
export function getPendingX1(): X1MatchRow | null {
  return pending;
}
