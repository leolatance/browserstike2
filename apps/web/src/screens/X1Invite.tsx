import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../store/auth';
import { getCharacter } from '../store/character';
import { cloudEnabled } from '../store/supabase';
import { useQuery } from '../store/useQuery';
import { acceptInvite, announceAccepted, peekInvite, setPendingX1, watchInvite, type X1Kind } from '../x1/online';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';

interface Peek {
  kind: X1Kind;
  hostNick: string;
  hostId: string;
  matchId: number | null;
  targetNick: string | null;
}

const KIND: Record<X1Kind, string> = { build: 'x1 de build', mira: 'x1 de mira' };

/** /x1/convite/:code — host waits here; the guest accepts here. */
export function X1Invite() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const { session, loading } = useSession();
  const { data: c } = useQuery(getCharacter);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const link = `${window.location.origin}/x1/convite/${code.toUpperCase()}`;

  useEffect(() => {
    if (!session) return;
    peekInvite(code)
      .then(setPeek)
      .catch((e: Error) => setErr(e.message === 'invite_not_found' ? 'convite não encontrado' : e.message));
  }, [code, session]);

  const iAmHost = Boolean(peek && session && peek.hostId === session.user.id);

  // Already accepted (reload / second tab): straight to the match.
  useEffect(() => {
    if (peek?.matchId) nav(`/x1/partida/${peek.matchId}`, { replace: true });
  }, [peek, nav]);

  // Host: wait for the guest.
  useEffect(() => {
    if (!iAmHost || peek?.matchId) return;
    return watchInvite(code, (m) => {
      if (import.meta.env.DEV) console.info('[x1] host saw accept', { matchId: m.id, at: Date.now() });
      setPendingX1(m);
      nav(`/x1/partida/${m.id}`, { replace: true });
    });
  }, [iAmHost, peek, code, nav]);

  const accept = async () => {
    setAccepting(true);
    setErr(null);
    try {
      const t0 = Date.now();
      const m = await acceptInvite(code);
      if (import.meta.env.DEV) console.info('[x1] accepted', { matchId: m.id, tookMs: Date.now() - t0, at: Date.now() });
      setPendingX1(m);
      void announceAccepted(code, m);
      nav(`/x1/partida/${m.id}`, { replace: true });
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg === 'own_invite' ? 'esse convite é seu' : msg === 'no_character' ? 'um dos bonecos ainda não sincronizou' : msg);
      setAccepting(false);
    }
  };

  return (
    <Shell title="Convite x1">
      <div className={ui.page}>
        {!cloudEnabled && <section className={ui.card}>x1 online precisa do Supabase configurado.</section>}
        {cloudEnabled && !loading && !session && (
          <section className={ui.card}>
            <span className={ui.h2}>Convite pro x1</span>
            <span className={ui.muted}>entre com sua conta pra aceitar.</span>
            <Link to={`/login?next=${encodeURIComponent(`/x1/convite/${code}`)}`} className="primary">
              Entrar
            </Link>
          </section>
        )}
        {session && !c && (
          <section className={ui.card}>
            <span className={ui.muted}>
              você ainda não tem boneco. <Link to="/onboarding">Criar</Link>
            </span>
          </section>
        )}
        {err && <section className={ui.card}>{err}</section>}
        {peek && iAmHost && (
          <section className={ui.card}>
            <span className={ui.h2}>Convite criado · {KIND[peek.kind]}</span>
            <div className="mono" style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.12em' }}>
              {code.toUpperCase()}
            </div>
            <div className={ui.row}>
              <span className={ui.muted} style={{ wordBreak: 'break-all' }}>
                {link}
              </span>
              <button onClick={() => void navigator.clipboard?.writeText(link)}>copiar link</button>
            </div>
            <span className={ui.muted}>{peek.targetNick ? `${peek.targetNick} foi avisado no lobby.` : 'mande o link pro amigo.'} Esperando aceitar…</span>
            <button onClick={() => nav('/x1')}>cancelar</button>
          </section>
        )}
        {peek && !iAmHost && session && c && (
          <section className={ui.card}>
            <span className={ui.h2}>
              {peek.hostNick} te chamou pro {KIND[peek.kind]}
            </span>
            <span className={ui.muted}>{peek.kind === 'build' ? 'a simulação decide com atributos + build; vale Elo no ladder x1.' : 'o minigame é o duelo: mesmo alvo pros dois, 10 rodadas.'}</span>
            <button className={`primary ${ui.big}`} disabled={accepting} onClick={() => void accept()}>
              {accepting ? 'entrando…' : 'Aceitar x1'}
            </button>
          </section>
        )}
      </div>
    </Shell>
  );
}
