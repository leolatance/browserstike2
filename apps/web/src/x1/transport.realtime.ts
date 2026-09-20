import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../store/supabase';
import type { Transport, X1Msg } from './transport';

/** Supabase Realtime channel: resolves once subscribed and presence is tracked. */
export function realtimeTransport(name: string, uid: string): Promise<Transport> {
  if (!supabase) return Promise.reject(new Error('cloud_off'));
  const sb = supabase;
  const ch: RealtimeChannel = sb.channel(name, { config: { broadcast: { self: false, ack: false }, presence: { key: uid } } });
  const listeners = new Set<(m: X1Msg) => void>();
  const presence = new Set<(ids: string[]) => void>();
  let ids: string[] = [];
  const syncPresence = () => {
    ids = Object.keys(ch.presenceState());
    for (const p of presence) p(ids);
  };
  ch.on('broadcast', { event: 'x1' }, ({ payload }) => {
    for (const l of listeners) l(payload as X1Msg);
  });
  ch.on('presence', { event: 'sync' }, syncPresence);
  return new Promise((resolve, reject) => {
    ch.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ uid, at: Date.now() });
        resolve({
          send: (msg) => void ch.send({ type: 'broadcast', event: 'x1', payload: msg }),
          onMessage: (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
          },
          present: () => ids,
          onPresence: (cb) => {
            presence.add(cb);
            cb(ids);
            return () => presence.delete(cb);
          },
          close: () => void sb.removeChannel(ch),
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status));
    });
  });
}
