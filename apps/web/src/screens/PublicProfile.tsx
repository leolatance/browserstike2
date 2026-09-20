import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CLASS_LABEL, card, resolveBuild, type EquippedCard } from '@idle-strike/engine';
import { COLOR_LABEL } from '../match/colors';
import { attrCap } from '../progression/xp';
import { cloudEnabled, supabase } from '../store/supabase';
import type { PlayerColor } from '../store/db';
import { Avatar } from '../ui/Avatar';
import { CardView } from '../ui/CardView';
import { nickColor } from '../ui/Avatar';
import ui from '../ui/ui.module.css';

interface PublicRow {
  nick: string;
  country: string;
  color: PlayerColor;
  photo_url: string | null;
  level: number;
  build: EquippedCard[];
  matches: number;
  kills: number;
  deaths: number;
  career_rating: number | null;
  form: number | null;
  top100?: boolean;
}

/** Shareable page: anyone opens it without logging in. */
export function PublicProfile() {
  const { nick = '' } = useParams();
  const [row, setRow] = useState<PublicRow | null | undefined>(undefined);
  const [photo, setPhoto] = useState<Blob | null>(null);
  useEffect(() => {
    if (!supabase) {
      setRow(null);
      return;
    }
    supabase
      .from('public_profiles_v2')
      .select('*')
      .ilike('nick', nick)
      .maybeSingle()
      .then(async ({ data }) => {
        setRow((data as PublicRow | null) ?? null);
        if (data?.photo_url) {
          try {
            setPhoto(await fetch(data.photo_url).then((r) => (r.ok ? r.blob() : null)));
          } catch {
            setPhoto(null);
          }
        }
      });
  }, [nick]);

  return (
    <div className={ui.page}>
      <div className={ui.row}>
        <Link to="/lobby" style={{ color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.08em', textDecoration: 'none' }}>
          IDLE STRIKE 2
        </Link>
      </div>
      {row === undefined && <div className={ui.muted}>carregando…</div>}
      {row === null && (
        <section className={ui.card}>
          <span className={ui.h2}>{cloudEnabled ? 'Jogador não encontrado' : 'Nuvem desligada'}</span>
          <span className={ui.muted}>{cloudEnabled ? `Ninguém com o nick "${nick}".` : 'Perfis públicos precisam do Supabase configurado.'}</span>
        </section>
      )}
      {row && (
        <>
          <section className={`${ui.card}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar photo={photo} nick={row.nick} size={72} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <h1 className={ui.h1} style={{ color: nickColor(row.nick) }}>{row.nick}</h1>
              <span className={ui.muted}>
                {row.country} · lvl {row.level} · {CLASS_LABEL[resolveBuild({ cards: row.build ?? [] }).activeClass]} · cor {COLOR_LABEL[row.color] ?? row.color}
                {row.top100 && <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 800 }}>TOP 100 RATING</span>}
              </span>
            </div>
          </section>
          <section className={ui.grid3}>
            <div className={ui.stat}>
              <b>{row.matches}</b>
              <span>partidas</span>
            </div>
            <div className={ui.stat}>
              <b>{row.deaths ? (row.kills / row.deaths).toFixed(2) : row.kills}</b>
              <span>K/D</span>
            </div>
            <div className={ui.stat}>
              <b>{row.career_rating ? row.career_rating.toFixed(2) : '–'}</b>
              <span>rating carreira</span>
            </div>
            <div className={ui.stat}>
              <b>{row.form ? row.form.toFixed(2) : '–'}</b>
              <span>forma</span>
            </div>
            <div className={ui.stat}>
              <b>{attrCap(row.level).toFixed(0)}</b>
              <span>cap</span>
            </div>
          </section>
          <section className={ui.card}>
            <span className={ui.h2}>Build atual</span>
            {(row.build ?? []).length === 0 && <span className={ui.muted}>sem cartas equipadas</span>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {(row.build ?? []).map((e) => (
                <CardView key={e.id} card={card(e.id)} level={e.level} small />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
