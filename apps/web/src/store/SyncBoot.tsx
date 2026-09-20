import { useEffect, useState } from 'react';
import { useSession } from './auth';
import { onSync, startSync, type SyncStatus } from './sync';

/** Starts/stops cloud sync with the session and exposes a small status toast. */
export function SyncBoot() {
  const { session, loading } = useSession();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (loading) return;
    void startSync(session).catch(() => undefined);
  }, [session, loading]);
  useEffect(() => onSync((_s: SyncStatus, message) => message && setMsg(message)), []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(id);
  }, [msg]);
  if (!msg) return null;
  return (
    <div role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 20, background: 'var(--bg-3)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
      {msg}
    </div>
  );
}
