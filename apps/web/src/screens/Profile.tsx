import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type MatchRecord } from '../store/db';
import { listX1, x1Badge } from '../store/x1';
import { careerFromMatches } from '../store/matches';
import { getCharacter, setColor, setPhoto } from '../store/character';
import { PLAYER_COLORS } from '../store/db';
import { COLOR_LABEL, COLOR_VAR } from '../match/colors';
import { Avatar } from '../ui/Avatar';
import { resizeToJpeg } from '../ui/photo';
import { signOut, useSession } from '../store/auth';
import { cloudEnabled } from '../store/supabase';
import { NickTakenError, onSync, push, type SyncStatus } from '../store/sync';
import { getSetting, setSetting } from '../store/settings';
import { updateCharacter } from '../store/character';
import { useQuery } from '../store/useQuery';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Profile.module.css';

function RatingChart({ ratings }: { ratings: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = 140;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    ctx.fillStyle = css('--bg-2');
    ctx.fillRect(0, 0, w, h);
    const pad = 24;
    const lo = 0.4;
    const hi = 1.8;
    const y = (r: number) => h - pad / 2 - ((Math.min(hi, Math.max(lo, r)) - lo) / (hi - lo)) * (h - pad);
    // Reference line at 1.00
    ctx.strokeStyle = css('--line-strong');
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, y(1));
    ctx.lineTo(w - 6, y(1));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css('--text-2');
    ctx.font = `10px ${css('--mono')}`;
    ctx.fillText('1.00', 2, y(1) + 3);
    if (ratings.length === 0) {
      ctx.fillText('sem partidas', pad, h / 2);
      return;
    }
    const last = ratings.slice(-50);
    const x = (i: number) => pad + (last.length === 1 ? (w - pad - 6) / 2 : (i / (last.length - 1)) * (w - pad - 6));
    ctx.strokeStyle = css('--accent');
    ctx.lineWidth = 2;
    ctx.beginPath();
    last.forEach((r, i) => (i === 0 ? ctx.moveTo(x(i), y(r)) : ctx.lineTo(x(i), y(r))));
    ctx.stroke();
    ctx.fillStyle = css('--accent');
    last.forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(r), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [ratings]);
  return <canvas ref={ref} className={styles.chart} aria-label="Rating por partida" />;
}

export function Profile() {
  const nav = useNavigate();
  const { session } = useSession();
  const [sync, setSync] = useState<SyncStatus>('off');
  const [nickErr, setNickErr] = useState<string | null>(null);
  const [newNick, setNewNick] = useState('');
  useEffect(() => onSync((s) => setSync(s)), []);
  const retryNick = async () => {
    if (newNick.trim().length < 3) return;
    await updateCharacter({ nick: newNick.trim() });
    try {
      await push();
      setNickErr(null);
    } catch (e) {
      setNickErr(e instanceof NickTakenError ? e.message : (e as Error).message);
    }
  };
  const { data: c } = useQuery(getCharacter);
  const { data: all } = useQuery(() => db.matches.toArray());
  const { data: x1s } = useQuery(() => listX1(10));
  const { data: availablePassive } = useQuery(() => getSetting('availablePassive'));
  const cs = all ? careerFromMatches(all) : null;
  const last20: MatchRecord[] = all ? all.slice().sort((a, b) => b.playedAt - a.playedAt).slice(0, 20) : [];
  return (
    <Shell title="Perfil">
      <div className={ui.page}>
        <section className={`${ui.card} ${styles.identity}`}>
          <Avatar photo={c?.photo ?? null} nick={c?.nick ?? '?'} size={72} />
          <div className={styles.idText}>
            <h1 className={ui.h1}>{c?.nick ?? '…'}</h1>
            <div className={ui.row}>
              <label className={styles.file}>
                {c?.photo ? 'trocar foto' : 'enviar foto'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    void (async () => {
                      const f = e.target.files?.[0];
                      if (f) await setPhoto(await resizeToJpeg(f));
                    })()
                  }
                />
              </label>
              {c?.photo && <button onClick={() => void setPhoto(null)}>remover foto</button>}
            </div>
            <div className={styles.colors} aria-label="Cor do jogador">
              {PLAYER_COLORS.map((col) => (
                <button key={col} className={styles.swatch} style={{ background: COLOR_VAR[col] }} aria-pressed={c?.color === col} aria-label={COLOR_LABEL[col]} title={COLOR_LABEL[col]} onClick={() => void setColor(col)} />
              ))}
              <span className={ui.muted}>cor no radar: {c ? COLOR_LABEL[c.color] : '…'}</span>
            </div>
          </div>
        </section>
        {cloudEnabled && (
          <section className={ui.card}>
            <span className={ui.h2}>Conta</span>
            {session ? (
              <>
                <div className={ui.row}>
                  <span>{session.user.email ?? session.user.id}</span>
                  <span className={ui.muted}>sync: {sync === 'error' ? 'erro' : sync === 'pushing' ? 'enviando…' : 'ok'}</span>
                  <button onClick={() => void signOut()}>Sair</button>
                </div>
                <div className={ui.row}>
                  <button aria-pressed={Boolean(availablePassive)} onClick={() => void setSetting('availablePassive', !availablePassive)}>
                    disponível pra partidas quando estou fora: {availablePassive ? 'sim' : 'não'}
                  </button>
                  <span className={ui.muted}>desligado, seu boneco sai do pool da queue online</span>
                </div>
                {c && (
                  <div className={ui.row}>
                    <span className={ui.muted}>link público:</span>
                    <a href={`/u/${encodeURIComponent(c.nick)}`}>{`${window.location.origin}/u/${c.nick}`}</a>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(`${window.location.origin}/u/${c.nick}`);
                      }}
                    >
                      copiar
                    </button>
                  </div>
                )}
                {(sync === 'error' || nickErr) && (
                  <div className={ui.row}>
                    <span style={{ color: 'var(--danger)' }}>{nickErr ?? 'Falha ao sincronizar. Se o nick já existe, escolha outro:'}</span>
                    <input className={ui.input} style={{ maxWidth: 200 }} placeholder="novo nick" value={newNick} onChange={(e) => setNewNick(e.target.value)} />
                    <button onClick={() => void retryNick()}>usar este nick</button>
                  </div>
                )}
              </>
            ) : (
              <div className={ui.row}>
                <span className={ui.muted}>sem conta = sem online e sem link público</span>
                <button className="primary" onClick={() => nav('/login')}>
                  Entrar
                </button>
              </div>
            )}
          </section>
        )}
        <section className={ui.grid3}>
          <div className={ui.stat}>
            <b>{cs?.matches ?? 0}</b>
            <span>partidas</span>
          </div>
          <div className={ui.stat}>
            <b>{cs ? cs.kd.toFixed(2) : '–'}</b>
            <span>K/D</span>
          </div>
          <div className={ui.stat}>
            <b>{cs ? cs.adr.toFixed(0) : '–'}</b>
            <span>ADR</span>
          </div>
          <div className={ui.stat}>
            <b>{cs ? `${cs.hsPercent.toFixed(0)}%` : '–'}</b>
            <span>HS</span>
          </div>
          <div className={ui.stat}>
            <b>{cs?.careerRating ? cs.careerRating.toFixed(2) : '–'}</b>
            <span>rating carreira</span>
          </div>
          <div className={ui.stat}>
            <b>{cs ? `${cs.wins}–${cs.matches - cs.wins}` : '–'}</b>
            <span>V–D</span>
          </div>
        </section>
        <section className={ui.card}>
          <span className={ui.h2}>Rating por partida</span>
          <RatingChart ratings={cs?.ratings ?? []} />
        </section>
        <section className={ui.card}>
          <span className={ui.h2}>Últimas partidas</span>
          {last20.length === 0 && <div className={ui.muted}>Nenhuma partida ainda. Entre na queue solo.</div>}
          {last20.map((m) => {
            const won = m.winner === m.myTeam;
            const other = m.myTeam === 0 ? 1 : 0;
            return (
              <div key={m.id} className={styles.match}>
                <span className={`${styles.result} ${won ? styles.win : styles.loss}`}>{won ? 'V' : 'D'}</span>
                <span className={`mono ${styles.score}`}>
                  {m.score[m.myTeam]}–{m.score[other]}
                </span>
                <span className={styles.opp}>vs {m.config.teams[other].name}</span>
                <span className="mono">
                  {m.stats.kills}-{m.stats.deaths}
                </span>
                <span className={`mono ${styles.rating}`}>{m.rating.toFixed(2)}</span>
                <button onClick={() => nav(`/match?replay=${m.id}`)}>rever</button>
              </div>
            );
          })}
        </section>
        {x1s && x1s.length > 0 && (
          <section className={ui.card}>
            <span className={ui.h2}>Últimos x1</span>
            {x1s.map((h) => (
              <div key={h.id} className={ui.row}>
                <span className={`${styles.result} ${h.won ? styles.win : styles.loss}`}>{h.won ? 'V' : 'D'}</span>
                <span>{x1Badge(h)}</span>
                <span className={`mono ${ui.muted}`}>+{h.xp} xp{h.eloDelta !== undefined ? ` · ${h.eloDelta >= 0 ? '+' : ''}${h.eloDelta} Elo` : ''}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </Shell>
  );
}
