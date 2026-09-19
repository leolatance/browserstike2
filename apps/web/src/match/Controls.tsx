import { SPEEDS, type ReplayState, type Speed } from './replay';
import styles from './Controls.module.css';

interface Props {
  state: ReplayState;
  onToggle: () => void;
  onSpeed: (s: Speed) => void;
  onNextRound: () => void;
  onSkipToEnd: () => void;
}

export function Controls({ state, onToggle, onSpeed, onNextRound, onSkipToEnd }: Props) {
  return (
    <div className={styles.bar}>
      <button className="primary" onClick={onToggle} disabled={state.finished} aria-label={state.playing ? 'Pausar' : 'Reproduzir'}>
        {state.playing ? '❚❚' : '▶'}
      </button>
      <div className={styles.speeds} role="group" aria-label="Velocidade">
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => onSpeed(s)} aria-pressed={state.speed === s}>
            {s}x
          </button>
        ))}
      </div>
      <button onClick={onNextRound} disabled={state.finished} title="Próximo round">
        round ▸
      </button>
      <button onClick={onSkipToEnd} disabled={state.finished} title="Pular pro fim">
        fim ⏭
      </button>
    </div>
  );
}
