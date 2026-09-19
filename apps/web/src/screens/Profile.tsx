import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type MatchRecord } from '../store/db';
import { careerFromMatches } from '../store/matches';
import { getCharacter } from '../store/character';
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
  const { data: c } = useQuery(getCharacter);
  const { data: all } = useQuery(() => db.matches.toArray());
  const cs = all ? careerFromMatches(all) : null;
  const last20: MatchRecord[] = all ? all.slice().sort((a, b) => b.playedAt - a.playedAt).slice(0, 20) : [];
  return (
    <Shell title="Perfil">
      <div className={ui.page}>
        <h1 className={ui.h1}>{c?.nick ?? '…'}</h1>
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
      </div>
    </Shell>
  );
}
