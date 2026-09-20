import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ATTR_KEYS, type Attrs } from '@idle-strike/engine';
import { classWithSetLabel } from '../store/buildLabel';
import { currentBuild, unopenedBoxes } from '../store/cards';
import { getSetting, setSetting, type LastSeen } from '../store/settings';
import { sessionsToday } from '../store/training';
import { dailyYield } from '../progression/training';
import { useSession } from '../store/auth';
import { cloudEnabled } from '../store/supabase';
import { fetchMyMmr, markSeen, unseenPassive, type PassiveRow } from '../store/online';
import { setPendingMatch } from '../store/pending';
import { watchInbox, type InboxInvite } from '../x1/online';
import { useNavigate } from 'react-router-dom';
import { card } from '@idle-strike/engine';
import { RankIcon } from '../ui/RankIcon';
import { attrCap, xpForLevel } from '../progression/xp';
import { COUNTRIES, getCharacter } from '../store/character';
import { career } from '../store/matches';
import { useQuery } from '../store/useQuery';
import { AttrBars } from '../ui/AttrBars';
import { Avatar } from '../ui/Avatar';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Lobby.module.css';

interface Changes {
  deltas: Partial<Attrs>;
  level: [number, number] | null;
}

export function Lobby() {
  const { data: c } = useQuery(getCharacter);
  const { data: cs } = useQuery(career);
  const { data: today } = useQuery(sessionsToday);
  const { data: build } = useQuery(currentBuild);
  const { data: boxes } = useQuery(unopenedBoxes);
  const [changes, setChanges] = useState<Changes | null>(null);
  const { session } = useSession();
  const { data: mine } = useQuery(() => (session ? fetchMyMmr() : Promise.resolve(null)), [session?.user.id]);
  const nav = useNavigate();
  const [passive, setPassive] = useState<PassiveRow[]>([]);
  const [invites, setInvites] = useState<InboxInvite[]>([]);
  useEffect(() => {
    if (!session || !c) return;
    return watchInbox(c.nick, setInvites);
  }, [session, c?.nick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!session) return;
    unseenPassive().then(setPassive);
  }, [session]);
  const dismissPassive = async () => {
    await markSeen(passive.map((p) => p.id));
    setPassive([]);
  };
  const replayPassive = async (p: PassiveRow) => {
    if (!p.match) return;
    await markSeen([p.id]);
    setPendingMatch({ kind: 'replay', seed: p.match.seed, config: p.match.config, myId: p.player_id, myTeam: p.team });
    nav('/match');
  };
  const snapped = useRef(false);

  // Highlight what changed since the last visit for 3s, then snapshot.
  useEffect(() => {
    if (!c || snapped.current) return;
    snapped.current = true;
    let timer = 0;
    (async () => {
      const last = await getSetting('lastSeen');
      if (last) {
        const deltas: Partial<Attrs> = {};
        for (const k of ATTR_KEYS) {
          const d = Math.round((c.attrs[k] - (last.attrs[k] ?? c.attrs[k])) * 100) / 100;
          if (d > 0) deltas[k] = d;
        }
        const level: [number, number] | null = last.level !== c.level ? [last.level, c.level] : null;
        if (Object.keys(deltas).length || level) {
          setChanges({ deltas, level });
          timer = window.setTimeout(() => setChanges(null), 3000);
        }
      }
      const snap: LastSeen = { attrs: { ...c.attrs }, level: c.level, at: Date.now() };
      await setSetting('lastSeen', snap);
    })();
    return () => clearTimeout(timer);
  }, [c]);

  if (!c) return <Shell title="Lobby">{null}</Shell>;
  const fullLeft = Math.min(today ?? 0, 3);
  const need = xpForLevel(c.level);
  const flag = COUNTRIES.find((x) => x.code === c.country)?.flag ?? '';
  const cap = attrCap(c.level);
  return (
    <Shell title="Lobby">
      <div className={ui.page}>
        {cloudEnabled && !session && (
          <Link to="/login" className={styles.notice}>
            <b>sem conta = sem online</b>
            <span>entre com e-mail ou Google pra guardar o boneco na nuvem e jogar a queue online</span>
          </Link>
        )}
        {invites.map((inv) => (
          <Link key={inv.code} to={`/x1/convite/${inv.code}`} className={styles.notice}>
            <b>{inv.hostNick} te chamou pro {inv.kind === 'mira' ? 'x1 de mira' : 'x1 de build'}</b>
            <span>toca pra ver o convite</span>
          </Link>
        ))}
        {passive.length > 0 && (
          <section className={ui.card}>
            <span className={ui.h2}>Enquanto você tava fora · {passive.length} {passive.length === 1 ? 'partida' : 'partidas'}</span>
            <span className={ui.muted}>passivo não mexe em patente, rating de carreira nem forma · +15 XP cada · 5% de box</span>
            {passive.map((p) => (
              <div key={p.id} className={styles.passiveRow}>
                <span className={p.won ? 'ct' : ''} style={!p.won ? { color: 'var(--danger)' } : undefined}>{p.won ? 'V' : 'D'}</span>
                <span className="mono">{p.match ? `${p.match.result.score[p.team]}–${p.match.result.score[p.team === 0 ? 1 : 0]}` : '–'}</span>
                <span className="mono">{p.rating.toFixed(2)}</span>
                <span className={ui.muted}>{p.cards?.length ? `box: ${p.cards.map((c) => card(c).name).join(', ')}` : ''}</span>
                <button disabled={!p.match} onClick={() => void replayPassive(p)}>
                  rever
                </button>
              </div>
            ))}
            <div className={ui.row}>
              <button onClick={() => void dismissPassive()}>ok, vi</button>
            </div>
          </section>
        )}
        <section className={`${ui.card} ${styles.hero}`}>
          <div className={styles.identity}>
            <Avatar photo={c.photo ?? null} nick={c.nick} size={64} />
            <div className={styles.who}>
              <div className={styles.nick}>
                {c.nick} <span className={styles.flag}>{flag}</span>
              </div>
              <div className={`${ui.muted} ${styles.rankLine}`}>
                {mine ? <RankIcon mmr={mine.mmr} size={16} withName /> : <span>sem patente</span>}
                <span>·</span>
                <span>{classWithSetLabel({ cards: build ?? [] })}</span>
              </div>
              {changes?.level && (
                <div className={styles.changed}>
                  nível {changes.level[0]} → {changes.level[1]} · cap {attrCap(changes.level[1]).toFixed(1)}
                </div>
              )}
              <div className={styles.level}>
                <span className="mono">lvl {c.level}</span>
                <div className={styles.xpTrack} aria-label={`XP ${c.xp} de ${need}`}>
                  <div className={styles.xpFill} style={{ width: `${Math.min(100, (100 * c.xp) / need)}%` }} />
                </div>
                <span className={`${ui.muted} mono`}>
                  {c.xp}/{need} xp
                </span>
              </div>
            </div>
          </div>
          <div className={ui.grid2}>
            <div className={ui.stat}>
              <b>{cs?.careerRating ? cs.careerRating.toFixed(2) : '–'}</b>
              <span>rating de carreira</span>
            </div>
            <div className={ui.stat}>
              <b>{cs?.form ? cs.form.toFixed(2) : '–'}</b>
              <span>forma (últimas 10)</span>
            </div>
          </div>
        </section>

        <section className={ui.card}>
          <span className={ui.h2}>Atributos · cap {cap.toFixed(1)}</span>
          <AttrBars attrs={c.attrs} cap={cap} deltas={changes?.deltas} />
          <span className={ui.muted}>
            sessões cheias hoje: {fullLeft}/3 · rendimento agora: <b className={dailyYield(today ?? 0).label === 'alto' ? 'ct' : dailyYield(today ?? 0).label === 'médio' ? 't' : ''}>{dailyYield(today ?? 0).label}</b>
          </span>
        </section>

        <section className={styles.actions}>
          <Link to="/treino" className={`${styles.action}`}>
            <b>Treino</b>
            <span>3 min · sobe uma barra</span>
          </Link>
          <Link to="/dm" className={styles.action}>
            <b>Deathmatch</b>
            <span>4 min · Mira, Peek, Mov</span>
          </Link>
          <Link to="/queue" className={`${styles.action} ${styles.primary}`}>
            <b>Queue solo</b>
            <span>5x5 contra bots · XP</span>
          </Link>
          {cloudEnabled && session ? (
            <Link to="/queue-online" className={styles.action}>
              <b>Queue online</b>
              <span>bonecos reais · patente</span>
            </Link>
          ) : (
            <Link to="/login" className={`${styles.action} ${styles.disabled}`}>
              <b>Queue online</b>
              <span>precisa de conta</span>
            </Link>
          )}
          <Link to="/x1" className={styles.action}>
            <b>x1</b>
            <span>contra bot · amigo · ranking</span>
          </Link>
          <Link to="/build" className={styles.action}>
            <b>Build</b>
            <span>{build?.length ?? 0} cartas equipadas</span>
          </Link>
          <Link to="/inventario" className={`${styles.action} ${boxes?.length ? styles.attention : ''}`}>
            <b>Box de cartas</b>
            <span>{boxes?.length ? `${boxes.length} não ${boxes.length === 1 ? 'aberta' : 'abertas'}` : 'nenhuma pendente'}</span>
          </Link>
          <Link to="/perfil" className={styles.action}>
            <b>Perfil</b>
            <span>carreira e histórico</span>
          </Link>
          {cloudEnabled && (
            <Link to="/ranking" className={styles.action}>
              <b>Ranking</b>
              <span>rating e patente</span>
            </Link>
          )}
        </section>
      </div>
    </Shell>
  );
}
