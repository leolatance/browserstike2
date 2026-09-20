import { useEffect, useMemo, useRef, useState } from 'react';
import type { MatchLog } from '@idle-strike/engine';
import { ReplayPlayer, type ReplayOptions, type ReplayState } from './replay';

/** React state is refreshed at most every `throttleMs` (the radar draws on its own). */
const THROTTLE_MS = 100;

export function useReplay(log: MatchLog, opts?: ReplayOptions): { player: ReplayPlayer; state: ReplayState } {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const player = useMemo(() => new ReplayPlayer(log, opts), [log]);
  const [state, setState] = useState<ReplayState>(() => player.getState());
  const lastPush = useRef(0);

  useEffect(() => {
    player.attach();
    const unsubscribe = player.subscribe((s) => {
      const now = performance.now();
      const prev = player.getState();
      const structural = !s.playing || s.finished || s.roundIdx !== prev.roundIdx || now - lastPush.current >= THROTTLE_MS;
      if (structural) {
        lastPush.current = now;
        setState(s);
      }
    });
    player.play();
    return () => {
      unsubscribe();
      player.detach();
    };
  }, [player]);

  return { player, state };
}
