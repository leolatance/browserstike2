import { ENGINE_VERSION } from '@idle-strike/engine';
import { MatchScreen } from './screens/MatchScreen.tsx';

// Minimal routing for now: only /match exists. Lobby/profile/training come later.
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/match') return <MatchScreen />;
  return (
    <main style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 8px' }}>Idle Strike 2</h1>
      <p style={{ color: 'var(--text-1)' }}>engine v{ENGINE_VERSION}. Só a tela de partida existe nesta etapa.</p>
      <p>
        <a href="/match?seed=42">Assistir partida (seed 42)</a>
        {' · '}
        <a href={`/match?seed=${Math.floor(Math.random() * 100000)}`}>seed aleatória</a>
      </p>
    </main>
  );
}
