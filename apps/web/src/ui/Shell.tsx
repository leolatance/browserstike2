import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCharacter } from '../store/character';
import { useQuery } from '../store/useQuery';
import styles from './Shell.module.css';

/** Top bar + page container shared by every non-match screen. */
export function Shell({ children, title }: { children: ReactNode; title?: string }) {
  const { data: c } = useQuery(getCharacter);
  const loc = useLocation();
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link to="/lobby" className={styles.brand}>
          IDLE STRIKE 2
        </Link>
        {title && <span className={styles.title}>{title}</span>}
        <nav className={styles.nav}>
          <Link to="/lobby" aria-current={loc.pathname === '/lobby' ? 'page' : undefined}>
            Lobby
          </Link>
          <Link to="/perfil" aria-current={loc.pathname === '/perfil' ? 'page' : undefined}>
            Perfil
          </Link>
          {c && (
            <span className={`${styles.me} mono`}>
              {c.nick} · lvl {c.level}
            </span>
          )}
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
