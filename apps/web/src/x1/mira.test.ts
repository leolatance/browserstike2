import { describe, expect, it } from 'vitest';
import { MIRA, MiraMatch, resolveRound, roundVariant, type Shot } from './mira';
import { MemoryHub, type Transport, type X1Msg } from './transport';

const shot = (round: number, score: number, ts: number): Shot => ({ round, score, reactionMs: 300, distance: 0.3, x: 0.5, y: 0.5, ts });

describe('resolveRound', () => {
  it('higher score wins, tie goes to the earlier tap, misses give nothing', () => {
    expect(resolveRound(shot(0, 80, 10), shot(0, 70, 5))).toBe('me');
    expect(resolveRound(shot(0, 70, 10), shot(0, 70, 5))).toBe('them');
    expect(resolveRound(shot(0, 0, 10), shot(0, 0, 5))).toBeNull();
    expect(resolveRound(null, shot(0, 40, 5))).toBe('them');
    expect(resolveRound(shot(0, 40, 5), null)).toBe('me');
    expect(resolveRound(null, null)).toBeNull();
  });
});

describe('roundVariant', () => {
  it('cycles through the three variants in a seed-fixed order', () => {
    const seq = Array.from({ length: 6 }, (_, i) => roundVariant(42, i));
    expect(new Set(seq.slice(0, 3)).size).toBe(3);
    expect(seq.slice(3)).toEqual(seq.slice(0, 3));
    expect(Array.from({ length: 6 }, (_, i) => roundVariant(42, i))).toEqual(seq);
  });
});

/** A fake client: mirrors what X1Online does with its transport and arbiter. */
class FakeClient {
  readonly match = new MiraMatch();
  constructor(
    readonly id: string,
    readonly t: Transport,
  ) {
    t.onMessage((m: X1Msg) => {
      if (m.type === 'shot') this.match.record('them', m.shot as Shot);
    });
  }
  shoot(s: Shot) {
    this.match.record('me', s);
    this.t.send({ type: 'shot', from: this.id, shot: s });
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('two clients over a channel', () => {
  it('converge on the same score and winner after 10 rounds', async () => {
    const hub = new MemoryHub();
    const a = new FakeClient('a', hub.connect('a'));
    const b = new FakeClient('b', hub.connect('b'));
    expect(a.t.present().sort()).toEqual(['a', 'b']);
    // a wins rounds 0-6 (7), b wins 7-9 (3)
    for (let n = 0; n < MIRA.ROUNDS; n++) {
      const aScore = n < 7 ? 90 : 50;
      const bScore = n < 7 ? 60 : 85;
      a.shoot(shot(n, aScore, 1000 + n * 10));
      b.shoot(shot(n, bScore, 1000 + n * 10 + 1));
      await flush();
      a.match.resolve(n);
      b.match.resolve(n);
    }
    expect(a.match.score()).toEqual([7, 3]);
    expect(b.match.score()).toEqual([3, 7]);
    expect(a.match.finished()).toBe(true);
    expect(b.match.finished()).toBe(true);
    expect(a.match.winner()).toBe('me');
    expect(b.match.winner()).toBe('them');
  });

  it('a missing shot counts as zero and a 5–5 goes to tie-break rounds', async () => {
    const hub = new MemoryHub();
    const a = new FakeClient('a', hub.connect('a'));
    const b = new FakeClient('b', hub.connect('b'));
    for (let n = 0; n < MIRA.ROUNDS; n++) {
      if (n % 2 === 0) a.shoot(shot(n, 70, 1000)); // b never shoots on even rounds
      else b.shoot(shot(n, 70, 1000));
      await flush();
      a.match.resolve(n);
      b.match.resolve(n);
    }
    expect(a.match.score()).toEqual([5, 5]);
    expect(a.match.finished()).toBe(false);
    a.shoot(shot(10, 80, 2000));
    b.shoot(shot(10, 80, 2001));
    await flush();
    expect(a.match.resolve(10)).toBe('me');
    expect(b.match.resolve(10)).toBe('them');
    expect(a.match.finished()).toBe(true);
    expect(a.match.score()).toEqual([6, 5]);
  });

  it('presence drops when a client leaves', () => {
    const hub = new MemoryHub();
    const a = hub.connect('a');
    const b = hub.connect('b');
    let seen: string[] = [];
    a.onPresence((ids) => (seen = ids));
    b.close();
    expect(seen).toEqual(['a']);
  });
});
