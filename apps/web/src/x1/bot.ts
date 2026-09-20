import { MAP01, Rng, averageAttr, generateBotTeam, makePlayer, resolveBuild, type Attrs, type Player, type X1Config } from '@idle-strike/engine';
import type { CharacterRecord } from '../store/db';

export type BotDelta = 0 | 5 | 10;
export const BOT_DELTAS: { delta: BotDelta; label: string; hint: string }[] = [
  { delta: 0, label: 'igual', hint: 'bot com a sua média' },
  { delta: 5, label: '+5', hint: 'média +5' },
  { delta: 10, label: '+10', hint: 'média +10 · ~73% pra ele' },
];

/** x1 vs bot: the character (with build) against a rifler bot levelled at avg + delta. */
export function x1BotConfig(c: CharacterRecord, build: { cards: { id: string; level: 1 | 2 | 3 }[] }, delta: BotDelta, seed: number): X1Config {
  const rng = new Rng(seed);
  const a: Player = makePlayer('a1', c.nick, resolveBuild(build).activeClass, c.attrs as Attrs);
  a.build = build;
  const team = generateBotTeam({ rng, targetAvg: averageAttr(c.attrs) + delta, spread: 3, idPrefix: 'b', classes: ['rifler'] });
  const b = team.players[0]!;
  if (b.nick === c.nick) b.nick = `${b.nick}_`;
  return { map: MAP01, a, b };
}
