/** Pure x1 helpers (Elo K=30, no damping; invite codes; server-side config). */
export const X1_K = 30;

export function x1Expected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function x1Delta(winnerElo: number, loserElo: number): { winner: number; loser: number } {
  const e = x1Expected(winnerElo, loserElo);
  const d = Math.round(X1_K * (1 - e));
  return { winner: d, loser: -d };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function inviteCode(random: () => number, len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

export interface X1Player {
  user_id: string;
  nick: string;
  color: string;
  attrs: Record<string, number>;
  build: { id: string; level: number }[];
}

/** Match row config: both characters as the engine wants them, host first. */
export function x1Config(host: X1Player, guest: X1Player) {
  const player = (p: X1Player, id: string) => ({ id, nick: p.nick, class: 'rifler', attrs: p.attrs, build: { cards: p.build ?? [] } });
  return { mapId: 'baixada', host: { ...host, player: player(host, 'a1') }, guest: { ...guest, player: player(guest, 'b1') } };
}

/** Start 3s after the server clock so both clients begin together. */
export const START_DELAY_MS = 3000;
