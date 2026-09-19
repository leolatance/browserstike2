import { useEffect, useState } from 'react';
import { subscribe } from './db';

/** Runs an async query and re-runs it whenever the store notifies a write. */
export function useQuery<T>(query: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const run = () => {
      query().then((v) => {
        if (alive) {
          setData(v);
          setLoading(false);
        }
      });
    };
    run();
    const unsub = subscribe(run);
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading };
}
