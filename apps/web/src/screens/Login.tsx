import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail, signInWithGoogle, signOut, useSession } from '../store/auth';
import { cloudEnabled } from '../store/supabase';
import { Shell } from '../ui/Shell';
import ui from '../ui/ui.module.css';

export function Login() {
  const nav = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const magic = async () => {
    setBusy(true);
    setErr(null);
    try {
      await signInWithEmail(email.trim());
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Conta">
      <div className={ui.page}>
        {!cloudEnabled && (
          <section className={ui.card}>
            <span className={ui.h2}>Nuvem desligada</span>
            <span className={ui.muted}>Este build não tem as chaves do Supabase. O jogo roda 100% local.</span>
          </section>
        )}
        {cloudEnabled && session && (
          <section className={ui.card}>
            <span className={ui.h2}>Conectado</span>
            <span>{session.user.email ?? session.user.id}</span>
            <div className={ui.row}>
              <button onClick={() => nav('/lobby')}>Ir pro lobby</button>
              <button onClick={() => void signOut()}>Sair</button>
            </div>
          </section>
        )}
        {cloudEnabled && !session && (
          <>
            <section className={ui.card}>
              <span className={ui.h2}>Entrar por e-mail</span>
              <span className={ui.muted}>Mandamos um link mágico. Sem senha.</span>
              <input className={ui.input} type="email" inputMode="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="primary" disabled={busy || !email.includes('@')} onClick={() => void magic()}>
                {sent ? 'Link enviado · reenviar' : 'Enviar link'}
              </button>
              {sent && <span className={ui.muted}>Abra o e-mail neste mesmo dispositivo e toque no link.</span>}
              {err && <span style={{ color: 'var(--danger)' }}>{err}</span>}
            </section>
            <section className={ui.card}>
              <span className={ui.h2}>Ou</span>
              <button onClick={() => void signInWithGoogle().catch((e: Error) => setErr(e.message))}>Entrar com Google</button>
            </section>
            <span className={ui.muted}>
              Sem conta o jogo continua jogável; só a queue online e o link público precisam de conta. <Link to="/lobby">Voltar</Link>
            </span>
          </>
        )}
      </div>
    </Shell>
  );
}
