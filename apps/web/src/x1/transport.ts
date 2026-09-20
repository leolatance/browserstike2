/**
 * Message transport between the two x1 clients. `MemoryHub` wires fake clients
 * for tests; the Supabase implementation lives in transport.realtime.ts (pure here).
 */

export interface X1Msg {
  type: string;
  from: string;
  [k: string]: unknown;
}

export interface Transport {
  send(msg: X1Msg): void;
  onMessage(cb: (m: X1Msg) => void): () => void;
  /** Ids currently present (including self). */
  present(): string[];
  onPresence(cb: (ids: string[]) => void): () => void;
  close(): void;
}

export class MemoryHub {
  private clients = new Map<string, MemoryTransport>();

  connect(id: string): Transport {
    const t = new MemoryTransport(id, this);
    this.clients.set(id, t);
    for (const c of this.clients.values()) c.emitPresence(this.ids());
    return t;
  }

  disconnect(id: string): void {
    this.clients.delete(id);
    for (const c of this.clients.values()) c.emitPresence(this.ids());
  }

  ids(): string[] {
    return [...this.clients.keys()];
  }

  deliver(from: string, msg: X1Msg): void {
    for (const [id, c] of this.clients) if (id !== from) queueMicrotask(() => c.receive(msg));
  }
}

class MemoryTransport implements Transport {
  private listeners = new Set<(m: X1Msg) => void>();
  private presence = new Set<(ids: string[]) => void>();
  private ids: string[] = [];
  constructor(
    private id: string,
    private hub: MemoryHub,
  ) {}
  send(msg: X1Msg): void {
    this.hub.deliver(this.id, msg);
  }
  onMessage(cb: (m: X1Msg) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  receive(m: X1Msg): void {
    for (const l of this.listeners) l(m);
  }
  present(): string[] {
    return this.ids;
  }
  onPresence(cb: (ids: string[]) => void): () => void {
    this.presence.add(cb);
    cb(this.ids);
    return () => this.presence.delete(cb);
  }
  emitPresence(ids: string[]): void {
    this.ids = ids;
    for (const p of this.presence) p(ids);
  }
  close(): void {
    this.hub.disconnect(this.id);
  }
}
