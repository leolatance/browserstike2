import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rankOf } from '@idle-strike/engine';
import { useSession } from '../store/auth';
import { queueOnline, type QueueResponse } from '../store/online';
import { setPendingMatch } from '../store/pending';
import { push } from '../store/sync';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';

/** Asynchronous online queue: the server matches, simulates and settles; we poll every 10s while it widens the MMR window. */
export function QueueOnline() {
  const nav = useNavigate();
  const { session, loading } = useSession();
  const [status, setStatus] = useState<string>('enviando seu boneco…');
  const [attempt, setAttempt] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      nav('/login');
      return;
    }
    stop.current = false;
    (async () => {
      try {
        await push().catch(() => undefined); // the server must see the current build/attrs
      } catch {
        /* keep going with what the server has */
      }
      let n = 0;
      while (!stop.current) {
        setAttempt(n);
        setStatus(`procurando · faixa ±${Math.min(400, 150 + 50 * n)} MMR`);
        const res: QueueResponse = await queueOnline(n);
        if (stop.current) return;
        if ('error' in res) {
          setErr(res.error === 'rate_limited' ? `Calma: uma partida online a cada 3 min (tente em ${res.retryInSec ?? 60}s).` : res.error === 'no_character' ? 'Seu boneco ainda não subiu pra nuvem. Abra o perfil e confira o sync.' : res.error);
          return;
        }
        if (res.status === 'ready') {
          setPendingMatch({
            kind: 'online',
            seed: res.seed,
            config: res.config,
            myId: res.myId,
            myTeam: res.myTeam,
            online: { matchId: res.matchId, hash: res.hash, rewards: res.rewards, result: res.result, realPlayers: res.realPlayers },
          });
          nav('/match', { replace: true });
          return;
        }
        setStatus(`procurando · faixa ±${res.range} MMR · ${res.found} bonecos reais encontrados`);
        await new Promise((r) => setTimeout(r, res.retryInSec * 1000));
        n++;
      }
    })();
    return () => {
      stop.current = true;
    };
  }, [session, loading, nav]);

  return (
    <Shell title="Queue online">
      <div className={ui.page}>
        <section className={ui.card}>
          <span className={ui.h2}>{err ? 'Não deu' : status}</span>
          {!err && <span className={ui.muted}>Bonecos de outros jogadores entram como passivos; quem falta vira bot nivelado. Tentativa {attempt + 1}.</span>}
          {err && <span style={{ color: 'var(--danger)' }}>{err}</span>}
          <div className={ui.row}>
            <button onClick={() => nav('/lobby')}>{err ? 'Voltar' : 'Cancelar'}</button>
          </div>
          <span className={ui.muted}>Patente inicial: {rankOf(1000).name} (1000 MMR). Elo K=25 com amortecimento por rating.</span>
        </section>
      </div>
    </Shell>
  );
}
