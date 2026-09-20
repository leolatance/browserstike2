import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MAP01, X1, makePlayer, simulateX1, type Attrs, type Player, type PlayerClass } from '@idle-strike/engine';
import { DuelTargetGame, type DuelTargetStats } from '../minigames/duelTarget';
import { useSession } from '../store/auth';
import { getCharacter } from '../store/character';
import { pullNow } from '../store/sync';
import { useQuery } from '../store/useQuery';
import { saveX1 } from '../store/x1';
import { MiraBoard } from '../x1/MiraBoard';
import { createInvite, fetchMatch, getPendingX1, reportResult, reportWo, serverNow, matchChannel, type X1MatchRow, type X1SidePlayer } from '../x1/online';
import type { Side } from '../x1/mira';
import { realtimeTransport } from '../x1/transport.realtime';
import type { Transport, X1Msg } from '../x1/transport';
import { X1View } from '../x1/X1View';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';

/** Opponent absent for this long (after the start) = walkover. */
const WO_MS = 20_000;
const XP_FIXED = { build: [40, 20], mira: [15, 10] } as const;

interface Done {
  score: [number, number];
  won: boolean | null;
  wo: boolean;
  eloDelta?: number;
  xp: number;
}

type Phase = { kind: 'loading' } | { kind: 'sync' } | { kind: 'playing' } | ({ kind: 'done' } & Done) | { kind: 'error'; msg: string };

function toPlayer(p: X1SidePlayer): Player {
  const pl = makePlayer(p.id, p.nick, p.class as PlayerClass, p.attrs as Attrs);
  pl.build = { cards: (p.build?.cards ?? []).map((c) => ({ id: c.id, level: c.level as 1 | 2 | 3 })) };
  return pl;
}

/** /x1/partida/:id — both clients simulate (build) or play (mira) the same match, synced by the server clock. */
export function X1Online() {
  const { id = '' } = useParams();
  const matchId = Number(id);
  const nav = useNavigate();
  const { session, loading } = useSession();
  const { data: c } = useQuery(getCharacter);
  const [m, setM] = useState<X1MatchRow | null>(() => (getPendingX1()?.id === matchId ? getPendingX1() : null));
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [transport, setTransport] = useState<Transport | null>(null);
  const [oppPresent, setOppPresent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [oppMini, setOppMini] = useState<{ avg: number; n: number } | null>(null);
  const [myMini, setMyMini] = useState<DuelTargetStats | null>(null);
  const [rematch, setRematch] = useState<string | null>(null);
  const game = useMemo(() => new DuelTargetGame(), []);
  const finishing = useRef(false);

  useEffect(() => {
    if (m || !session) return;
    fetchMatch(matchId).then((row) => (row ? setM(row) : setPhase({ kind: 'error', msg: 'partida não encontrada' })));
  }, [m, matchId, session]);

  const uid = session?.user.id ?? '';
  const iAmHost = Boolean(m && m.host_id === uid);
  const meSide = iAmHost ? m?.config.host : m?.config.guest;
  const oppSide = iAmHost ? m?.config.guest : m?.config.host;
  const startAt = m ? Date.parse(m.start_at) : 0;

  // Already settled (reload after the end).
  useEffect(() => {
    if (!m || phase.kind !== 'loading') return;
    if (m.status !== 'ready' && m.result) {
      const won = (m.result.winner === 'host') === iAmHost;
      const score: [number, number] = iAmHost ? m.result.score : [m.result.score[1], m.result.score[0]];
      setPhase({ kind: 'done', score, won, wo: m.status === 'wo', xp: XP_FIXED[m.kind][won ? 0 : 1] });
      return;
    }
    setPhase({ kind: 'sync' });
  }, [m, phase.kind, iAmHost]);

  // Channel with presence.
  useEffect(() => {
    if (!m || !uid || phase.kind === 'done' || phase.kind === 'error') return;
    let t: Transport | null = null;
    let closed = false;
    realtimeTransport(matchChannel(m.id), uid)
      .then((tr) => {
        if (closed) return tr.close();
        t = tr;
        setTransport(tr);
        tr.onPresence((ids) => setOppPresent(ids.some((x) => x !== uid)));
      })
      .catch((e: Error) => setPhase({ kind: 'error', msg: e.message }));
    return () => {
      closed = true;
      t?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id, uid]);

  // Countdown → playing.
  useEffect(() => {
    if (phase.kind !== 'sync' || !m) return;
    const tick = () => {
      const left = startAt - serverNow();
      setCountdown(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        if (import.meta.env.DEV) console.info('[x1] start', { matchId: m.id, at: Date.now(), serverAt: serverNow() });
        setPhase({ kind: 'playing' });
      }
    };
    tick();
    const iv = window.setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [phase.kind, m, startAt]);

  const saveAndDone = useCallback(
    async (score: [number, number], won: boolean | null, wo: boolean, eloDelta?: number) => {
      if (!m || !oppSide) return;
      const xp = won === null ? XP_FIXED[m.kind][1] : XP_FIXED[m.kind][won ? 0 : 1];
      await saveX1({ playedAt: Date.now(), kind: m.kind, opponent: oppSide.nick, score, won: won === true, xp, eloDelta, minigame: m.kind === 'build' ? (myMini ?? game.stats()) : null, cloudId: m.id, wo });
      void pullNow();
      setPhase({ kind: 'done', score, won, wo, eloDelta, xp });
    },
    [m, oppSide, myMini, game],
  );

  // Walkover: the opponent never showed up / left for WO_MS.
  useEffect(() => {
    if (!m || !transport || phase.kind === 'done' || phase.kind === 'error' || phase.kind === 'loading') return;
    if (oppPresent) return;
    const timer = window.setTimeout(async () => {
      if (finishing.current) return;
      finishing.current = true;
      try {
        const r = await reportWo(m.id);
        const won = (r.result.winner === 'host') === iAmHost;
        const score: [number, number] = iAmHost ? r.result.score : [r.result.score[1], r.result.score[0]];
        await saveAndDone(score, won, true, eloDeltaFor(r.elo, won));
      } catch (e) {
        setPhase({ kind: 'error', msg: (e as Error).message });
      }
    }, Math.max(WO_MS, startAt + WO_MS - serverNow()));
    return () => clearTimeout(timer);
  }, [m, transport, oppPresent, phase.kind, iAmHost, startAt, saveAndDone]);

  // Messages: opponent minigame score, rematch offers.
  useEffect(() => {
    if (!transport) return;
    return transport.onMessage((msg: X1Msg) => {
      if (msg.type === 'score') setOppMini({ avg: msg.avg as number, n: msg.n as number });
      if (msg.type === 'rematch') setRematch(msg.code as string);
    });
  }, [transport]);

  const onStats = useCallback(
    (s: DuelTargetStats) => {
      setMyMini(s);
      transport?.send({ type: 'score', from: uid, avg: s.accompanied ? s.average : 0, n: s.accompanied });
    },
    [transport, uid],
  );

  const sim = useMemo(() => (m && m.kind === 'build' ? simulateX1({ map: MAP01, a: toPlayer(m.config.host.player), b: toPlayer(m.config.guest.player) }, m.seed) : null), [m]);

  const finishBuild = useCallback(async () => {
    if (!m || !sim || finishing.current) return;
    finishing.current = true;
    const winner = sim.winner === 0 ? 'host' : 'guest';
    try {
      const r = await reportResult(m.id, sim.score, winner, 'played');
      const won = (winner === 'host') === iAmHost;
      const score: [number, number] = iAmHost ? sim.score : [sim.score[1], sim.score[0]];
      await saveAndDone(score, won, false, r.already ? undefined : eloDeltaFor(r.elo, won));
    } catch (e) {
      setPhase({ kind: 'error', msg: (e as Error).message });
    }
  }, [m, sim, iAmHost, saveAndDone]);

  const finishMira = useCallback(
    async (score: [number, number], winner: Side | null) => {
      if (!m || finishing.current) return;
      finishing.current = true;
      const hostScore: [number, number] = iAmHost ? score : [score[1], score[0]];
      const hostWins = winner === null ? iAmHost : (winner === 'me') === iAmHost;
      try {
        await reportResult(m.id, hostScore, hostWins ? 'host' : 'guest', winner === null ? 'draw' : 'played');
        await saveAndDone(score, winner === null ? null : winner === 'me', false);
      } catch (e) {
        setPhase({ kind: 'error', msg: (e as Error).message });
      }
    },
    [m, iAmHost, saveAndDone],
  );

  const offerRematch = async () => {
    if (!m || !oppSide) return;
    const r = await createInvite(m.kind, oppSide.nick);
    transport?.send({ type: 'rematch', from: uid, code: r.code });
    nav(`/x1/convite/${r.code}`);
  };

  if (!loading && !session) {
    return (
      <Shell title="x1 online">
        <div className={ui.page}>
          <section className={ui.card}>entre com sua conta pra ver essa partida.</section>
        </div>
      </Shell>
    );
  }
  const kindLabel = m?.kind === 'mira' ? 'x1 de mira' : 'x1 de build';

  return (
    <Shell title={kindLabel}>
      <div className={ui.page}>
        {phase.kind === 'loading' && <section className={ui.card}>carregando…</section>}
        {phase.kind === 'error' && (
          <section className={ui.card}>
            erro: {phase.msg}
            <button onClick={() => nav('/x1')}>voltar</button>
          </section>
        )}
        {phase.kind === 'sync' && m && (
          <section className={ui.card}>
            <span className={ui.h2}>
              {meSide?.nick} vs {oppSide?.nick}
            </span>
            <div className="mono" style={{ fontSize: 40, fontWeight: 800 }}>
              {countdown}
            </div>
            <span className={ui.muted}>{transport ? (oppPresent ? 'os dois conectados · sincronizando pelo relógio do servidor' : 'esperando o outro conectar…') : 'conectando…'}</span>
          </section>
        )}
        {phase.kind === 'playing' && m && c && transport && meSide && oppSide && m.kind === 'build' && sim && (
          <X1View
            log={sim.log}
            me={iAmHost ? 'a1' : 'b1'}
            myColor={c.color}
            rounds={X1.ROUNDS}
            game={game}
            onStats={onStats}
            onFinish={() => void finishBuild()}
            extra={
              <span>
                minigame · você <b className="mono">{myMini?.accompanied ? myMini.average : '–'}</b> · {oppSide.nick} <b className="mono">{oppMini?.n ? oppMini.avg : '–'}</b>
                {!oppPresent && <span className={ui.muted}> · {oppSide.nick} desconectou (W.O. em 20s)</span>}
              </span>
            }
          />
        )}
        {phase.kind === 'playing' && m && transport && meSide && oppSide && m.kind === 'mira' && (
          <>
            <MiraBoard matchId={m.id} seed={m.seed} startAt={startAt} transport={transport} uid={uid} myNick={meSide.nick} oppNick={oppSide.nick} onFinish={(score, winner) => void finishMira(score, winner)} />
            {!oppPresent && <div className={ui.muted}>{oppSide.nick} desconectou (W.O. em 20s)</div>}
          </>
        )}
        {phase.kind === 'done' && m && oppSide && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>
                {phase.won === null ? 'Empate' : phase.won ? 'Vitória' : 'Derrota'}
                {phase.wo ? ' por W.O.' : ''} · {kindLabel}
              </span>
              <div className="mono" style={{ fontSize: 30, fontWeight: 800 }}>
                {phase.score[0]} – {phase.score[1]} <span className={ui.muted}>vs {oppSide.nick}</span>
              </div>
              <div className={ui.row}>
                <span>
                  xp <b className="mono">+{phase.xp}</b>
                </span>
                {m.kind === 'build' && (
                  <span>
                    Elo x1{' '}
                    <b className="mono">{phase.eloDelta === undefined ? '…' : `${phase.eloDelta >= 0 ? '+' : ''}${phase.eloDelta}`}</b>
                  </span>
                )}
                {m.kind === 'build' && myMini && (
                  <span>
                    minigame <b className="mono">{myMini.accompanied ? myMini.average : '–'}</b>
                  </span>
                )}
              </div>
            </section>
            {rematch && (
              <button className={`primary ${ui.big}`} onClick={() => nav(`/x1/convite/${rematch}`)}>
                {oppSide.nick} quer revanche · aceitar
              </button>
            )}
            <div className={ui.grid2}>
              <button className="primary" disabled={!oppPresent && !rematch} onClick={() => void offerRematch()}>
                Revanche
              </button>
              <button onClick={() => nav('/lobby')}>Lobby</button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function eloDeltaFor(elo: Partial<{ winner: { before: number; after: number }; loser: { before: number; after: number } }> | undefined, won: boolean): number | undefined {
  const e = won ? elo?.winner : elo?.loser;
  return e ? e.after - e.before : undefined;
}
