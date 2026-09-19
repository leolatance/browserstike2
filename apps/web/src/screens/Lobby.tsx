import { Link } from 'react-router-dom';
import { attrCap, xpForLevel } from '../progression/xp';
import { COUNTRIES, getCharacter } from '../store/character';
import { career } from '../store/matches';
import { useQuery } from '../store/useQuery';
import { AttrBars } from '../ui/AttrBars';
import { Avatar } from '../ui/Avatar';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';
import styles from './Lobby.module.css';

export function Lobby() {
  const { data: c } = useQuery(getCharacter);
  const { data: cs } = useQuery(career);
  if (!c) return <Shell title="Lobby">{null}</Shell>;
  const need = xpForLevel(c.level);
  const flag = COUNTRIES.find((x) => x.code === c.country)?.flag ?? '';
  const cap = attrCap(c.level);
  return (
    <Shell title="Lobby">
      <div className={ui.page}>
        <section className={`${ui.card} ${styles.hero}`}>
          <div className={styles.identity}>
            <Avatar slot={c.avatar} nick={c.nick} size={64} />
            <div className={styles.who}>
              <div className={styles.nick}>
                {c.nick} <span className={styles.flag}>{flag}</span>
              </div>
              <div className={ui.muted}>sem patente · Rifler</div>
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
          <AttrBars attrs={c.attrs} cap={cap} />
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
          <div className={`${styles.action} ${styles.disabled}`} aria-disabled="true">
            <b>Queue online</b>
            <span>Fase 2</span>
          </div>
          <Link to="/perfil" className={styles.action}>
            <b>Perfil</b>
            <span>carreira e histórico</span>
          </Link>
        </section>
      </div>
    </Shell>
  );
}
