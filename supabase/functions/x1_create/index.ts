/**
 * Edge function `x1_create`: { action: 'invite', kind, targetNick? } → { code }
 *                            { action: 'accept', code } → match row
 *                            { action: 'result', matchId, score, winner, reason } → ladder update (build kind)
 *                            { action: 'wo', matchId } → the caller wins by walkover
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { START_DELAY_MS, inviteCode, x1Config, x1Delta, type X1Player } from '../_shared/x1.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify({ ...body, serverNow: Date.now() }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth?.user) return json({ error: 'unauthorized' }, 401);
  const uid = auth.user.id;
  const db = createClient(url, service);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const loadPlayer = async (id: string): Promise<X1Player | null> => {
    const [{ data: p }, { data: c }] = await Promise.all([db.from('profiles').select('nick, color').eq('user_id', id).maybeSingle(), db.from('characters').select('attrs, build').eq('user_id', id).maybeSingle()]);
    if (!p || !c) return null;
    return { user_id: id, nick: p.nick, color: p.color, attrs: c.attrs, build: c.build ?? [] };
  };

  switch (body.action) {
    case 'invite': {
      const kind = body.kind === 'mira' ? 'mira' : 'build';
      const code = inviteCode(Math.random);
      const targetNick = typeof body.targetNick === 'string' && body.targetNick.trim() ? body.targetNick.trim() : null;
      const { data: hp } = await db.from('profiles').select('nick').eq('user_id', uid).maybeSingle();
      if (!hp) return json({ error: 'no_character' }, 400);
      const { error } = await db.from('x1_invites').insert({ code, host_id: uid, host_nick: hp.nick, kind, target_nick: targetNick });
      if (error) return json({ error: error.message }, 500);
      return json({ code, kind });
    }
    case 'peek': {
      const code = String(body.code ?? '').toUpperCase();
      const { data: inv } = await db.from('x1_invites').select('*').eq('code', code).maybeSingle();
      if (!inv) return json({ error: 'invite_not_found' }, 404);
      return json({ kind: inv.kind, hostNick: inv.host_nick, hostId: inv.host_id, matchId: inv.match_id, targetNick: inv.target_nick });
    }
    case 'accept': {
      const code = String(body.code ?? '').toUpperCase();
      const { data: inv } = await db.from('x1_invites').select('*').eq('code', code).maybeSingle();
      if (!inv) return json({ error: 'invite_not_found' }, 404);
      if (inv.host_id === uid) return json({ error: 'own_invite' }, 400);
      if (inv.match_id) {
        const { data: m } = await db.from('x1_matches').select('*').eq('id', inv.match_id).single();
        return json({ match: m as Record<string, unknown> | null, rematch: false });
      }
      const [host, guest] = await Promise.all([loadPlayer(inv.host_id), loadPlayer(uid)]);
      if (!host || !guest) return json({ error: 'no_character' }, 400);
      const seed = Math.floor(Math.random() * 2 ** 31);
      const start_at = new Date(Date.now() + START_DELAY_MS).toISOString();
      const { data: m, error } = await db
        .from('x1_matches')
        .insert({ kind: inv.kind, host_id: inv.host_id, guest_id: uid, seed, config: x1Config(host, guest), start_at })
        .select('*')
        .single();
      if (error || !m) return json({ error: error?.message ?? 'insert_failed' }, 500);
      await db.from('x1_invites').update({ accepted_by: uid, match_id: m.id }).eq('code', code);
      return json({ match: m as Record<string, unknown> });
    }
    case 'result':
    case 'wo': {
      const matchId = Number(body.matchId);
      const { data: m } = await db.from('x1_matches').select('*').eq('id', matchId).maybeSingle();
      if (!m) return json({ error: 'match_not_found' }, 404);
      if (m.host_id !== uid && m.guest_id !== uid) return json({ error: 'forbidden' }, 403);
      if (m.status !== 'ready') return json({ ok: true, already: true, result: m.result as Record<string, unknown> });
      const iAmHost = m.host_id === uid;
      let winner: 'host' | 'guest';
      let score: [number, number];
      let reason: string;
      if (body.action === 'wo') {
        winner = iAmHost ? 'host' : 'guest';
        score = iAmHost ? [10, 0] : [0, 10];
        reason = 'wo';
      } else {
        winner = body.winner === 'host' ? 'host' : 'guest';
        score = (Array.isArray(body.score) ? (body.score as number[]).slice(0, 2) : [0, 0]) as [number, number];
        reason = typeof body.reason === 'string' ? body.reason : 'played';
      }
      const result = { score, winner, reason };
      await db.from('x1_matches').update({ status: body.action === 'wo' ? 'wo' : 'done', result }).eq('id', matchId);
      let elo: Record<string, unknown> = {};
      if (m.kind === 'build') {
        const winId = winner === 'host' ? m.host_id : m.guest_id;
        const loseId = winner === 'host' ? m.guest_id : m.host_id;
        const [{ data: rw }, { data: rl }] = await Promise.all([db.from('x1_ratings').select('*').eq('user_id', winId).maybeSingle(), db.from('x1_ratings').select('*').eq('user_id', loseId).maybeSingle()]);
        const we = rw?.elo ?? 1000;
        const le = rl?.elo ?? 1000;
        const d = x1Delta(we, le);
        await db.from('x1_ratings').upsert({ user_id: winId, elo: we + d.winner, matches: (rw?.matches ?? 0) + 1, wins: (rw?.wins ?? 0) + 1, updated_at: new Date().toISOString() });
        await db.from('x1_ratings').upsert({ user_id: loseId, elo: le + d.loser, matches: (rl?.matches ?? 0) + 1, wins: rl?.wins ?? 0, updated_at: new Date().toISOString() });
        elo = { winner: { before: we, after: we + d.winner }, loser: { before: le, after: le + d.loser } };
      }
      // XP: build → online formula on the client side is not trusted; server grants a fixed amount here.
      const xpWin = m.kind === 'build' ? 40 : 15;
      const xpLose = m.kind === 'build' ? 20 : 10;
      for (const [id, xp] of [[m.host_id, winner === 'host' ? xpWin : xpLose], [m.guest_id, winner === 'guest' ? xpWin : xpLose]] as [string, number][]) {
        const { data: ch } = await db.from('characters').select('level, xp').eq('user_id', id).maybeSingle();
        if (ch) await db.from('characters').update({ xp: ch.xp + xp, updated_at: new Date().toISOString() }).eq('user_id', id);
      }
      return json({ ok: true, result, elo });
    }
    default:
      return json({ error: 'bad_action' }, 400);
  }
});
