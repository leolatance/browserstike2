/**
 * Cloud sync (Fase 2a). Dexie stays the local source of truth; the server is a
 * mirror. First login with a local character uploads it; afterwards every local
 * write schedules a debounced push, and opening the app pulls when the server
 * copy is newer (server wins, and the UI is told).
 */
import type { Session } from '@supabase/supabase-js';
import { db, notify, subscribe, type CharacterRecord, type MatchRecord } from './db';
import { getSetting, setSetting } from './settings';
import { supabase } from './supabase';
import { localDay } from './db';

export class NickTakenError extends Error {
  constructor(public nick: string) {
    super(`Nick "${nick}" já está em uso`);
  }
}

export type SyncStatus = 'off' | 'idle' | 'pushing' | 'error';
type Listener = (s: SyncStatus, message?: string) => void;
const listeners = new Set<Listener>();
let status: SyncStatus = 'off';
function set(s: SyncStatus, message?: string) {
  status = s;
  for (const l of listeners) l(s, message);
}
export function onSync(l: Listener): () => void {
  listeners.add(l);
  l(status);
  return () => {
    listeners.delete(l);
  };
}

let session: Session | null = null;
let timer = 0;
let unsubscribe: (() => void) | null = null;
/** Suppresses the push that a pull's own writes would trigger. */
let pulling = false;

/** Call once per session change. Pulls (or uploads) then watches local writes. */
export async function startSync(s: Session | null): Promise<void> {
  session = s;
  unsubscribe?.();
  unsubscribe = null;
  clearTimeout(timer);
  if (!supabase || !s) {
    set('off');
    return;
  }
  set('idle');
  await pullOrUpload();
  unsubscribe = subscribe(() => {
    if (pulling) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => void push(), 2000);
  });
}

/** Server newer than our last push → replace local; otherwise push local. */
async function pullOrUpload(): Promise<void> {
  if (!supabase || !session) return;
  const uid = session.user.id;
  const local = await db.character.get(1);
  const { data: remote, error } = await supabase.from('characters').select('*').eq('user_id', uid).maybeSingle();
  if (error) {
    set('error', error.message);
    return;
  }
  if (!remote) {
    if (local) await push();
    return;
  }
  const lastPush = (await getSetting('lastPushAt')) ?? 0;
  const remoteAt = new Date(remote.updated_at as string).getTime();
  if (!local || remoteAt > lastPush + 1000) {
    await pullInto(uid, remote, local);
    return;
  }
  await push();
}

async function pullInto(uid: string, remote: Record<string, unknown>, local: CharacterRecord | undefined): Promise<void> {
  if (!supabase) return;
  pulling = true;
  try {
    const [{ data: profile }, { data: cards }, { data: matches }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('cards').select('*').eq('user_id', uid),
      supabase.from('matches').select('*').eq('user_id', uid).order('played_at', { ascending: false }).limit(200),
    ]);
    let photo: Blob | undefined = local?.photo;
    if (profile?.photo_url && !local?.photo) {
      try {
        photo = await fetch(profile.photo_url as string).then((r) => (r.ok ? r.blob() : undefined));
      } catch {
        photo = undefined;
      }
    }
    const record: CharacterRecord = {
      id: 1,
      nick: (profile?.nick as string) ?? local?.nick ?? 'jogador',
      avatar: 0,
      country: (profile?.country as string) ?? local?.country ?? 'BR',
      color: (profile?.color as CharacterRecord['color']) ?? local?.color ?? 'yellow',
      attrs: remote.attrs as CharacterRecord['attrs'],
      level: remote.level as number,
      xp: remote.xp as number,
      class: 'rifler',
      createdAt: local?.createdAt ?? Date.now(),
      build: (remote.build as CharacterRecord['build']) ?? [],
      dust: (remote.dust as number) ?? 0,
      updatedAt: new Date(remote.updated_at as string).getTime(),
      ...(photo ? { photo } : {}),
    };
    await db.transaction('rw', db.character, db.cards, db.matches, async () => {
      await db.character.put(record);
      await db.cards.clear();
      for (const c of cards ?? []) await db.cards.put({ id: c.card_id as string, qty: c.qty as number, level: c.level as 1 | 2 | 3, acquiredAt: Date.now() });
      if (matches && matches.length) {
        const have = new Set((await db.matches.toArray()).map((m) => m.cloudId).filter(Boolean));
        for (const m of matches) {
          if (have.has(m.id as number)) continue;
          await db.matches.add({
            cloudId: m.id as number,
            playedAt: new Date(m.played_at as string).getTime(),
            seed: Number(m.seed),
            config: m.config as MatchRecord['config'],
            score: (m.stats as { score?: [number, number] }).score ?? [0, 0],
            winner: ((m.stats as { winner?: 0 | 1 }).winner ?? 0) as 0 | 1,
            myTeam: 0,
            myId: 'a1',
            stats: (m.stats as { stats: MatchRecord['stats'] }).stats,
            rating: m.rating as number,
            rewards: m.rewards as MatchRecord['rewards'],
            mode: m.mode as 'solo' | 'online',
          });
        }
      }
    });
    await setSetting('lastPushAt', Date.now());
    set('idle', local ? 'A nuvem tinha um boneco mais novo: o servidor venceu.' : undefined);
    notify();
  } finally {
    pulling = false;
  }
}

/** Uploads profile, character, cards, today's training count and unsynced matches. */
export async function push(): Promise<void> {
  if (!supabase || !session) return;
  const uid = session.user.id;
  const c = await db.character.get(1);
  if (!c) return;
  set('pushing');
  try {
    let photo_url: string | undefined;
    if (c.photo && !(await getSetting('photoUploadedAt'))) {
      const path = `${uid}/avatar.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, c.photo, { upsert: true, contentType: 'image/jpeg' });
      if (!error) {
        photo_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        await setSetting('photoUploadedAt', Date.now());
      }
    }
    const profile: Record<string, unknown> = { user_id: uid, nick: c.nick, country: c.country, color: c.color };
    if (photo_url) profile.photo_url = photo_url;
    const { error: pErr } = await supabase.from('profiles').upsert(profile, { onConflict: 'user_id' });
    if (pErr) {
      if (pErr.code === '23505') {
        set('error', 'nick em uso');
        throw new NickTakenError(c.nick);
      }
      throw pErr;
    }
    const { error: cErr } = await supabase
      .from('characters')
      .upsert({ user_id: uid, attrs: c.attrs, level: c.level, xp: c.xp, build: c.build, dust: c.dust ?? 0, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (cErr) throw cErr;
    const cards = await db.cards.toArray();
    if (cards.length) {
      const { error } = await supabase.from('cards').upsert(cards.map((k) => ({ user_id: uid, card_id: k.id, qty: k.qty, level: k.level })), { onConflict: 'user_id,card_id' });
      if (error) throw error;
    }
    const today = await db.training.where('day').equals(localDay()).count();
    await supabase.from('training_sessions').upsert({ user_id: uid, date: localDay(), count: today }, { onConflict: 'user_id,date' });
    const unsynced = (await db.matches.toArray()).filter((m) => m.cloudId === undefined && !m.abandoned);
    for (const m of unsynced) {
      const { data, error } = await supabase
        .from('matches')
        .insert({ user_id: uid, seed: m.seed, config: m.config, stats: { stats: m.stats, score: m.score, winner: m.winner }, rating: m.rating, rewards: m.rewards, mode: m.mode ?? 'solo', played_at: new Date(m.playedAt).toISOString() })
        .select('id')
        .single();
      if (!error && data && m.id !== undefined) {
        pulling = true;
        await db.matches.update(m.id, { cloudId: data.id as number });
        pulling = false;
      }
    }
    await setSetting('lastPushAt', Date.now());
    set('idle');
  } catch (e) {
    if (!(e instanceof NickTakenError)) set('error', (e as Error).message);
    throw e;
  }
}
