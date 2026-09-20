import { BOT_TEAM_NAMES, Rng, generateBotTeam, makePlayer, resolveBuild, type AttrKey, type Attrs, type Player, type ScenarioKind, type Team } from '@idle-strike/engine';
import { hashSeed } from '../minigames/duelTarget';
import type { CharacterRecord } from '../store/db';

/** Scenario chain per focus (GDD 4.1 v1). Trimmed to fit the session length. */
export const CHAIN: Record<AttrKey, ScenarioKind[]> = {
  mira: ['aim1v1', 'aim1v1', 'rush', 'aim1v1', 'retake2v2', 'aim1v1'],
  peek: ['peek', 'peek', 'rush', 'peek', 'execute', 'peek'],
  mov: ['peek', 'rush', 'aim1v1', 'retake2v2', 'rush', 'peek'],
  tatico: ['retake2v2', 'retake3v2', 'retake2v2', 'retake3v2', 'retake2v2'],
  util: ['execute', 'execute', 'rush', 'execute', 'execute'],
  mental: ['aim1v1'],
};

const KIND_SECONDS: Record<ScenarioKind, number> = { aim1v1: 20, peek: 20, rush: 25, retake2v2: 30, retake3v2: 30, execute: 30 };

export function chainFor(focus: AttrKey, seconds: number): ScenarioKind[] {
  const chain = [...CHAIN[focus]];
  while (chain.length > 5 && chain.reduce((s, k) => s + KIND_SECONDS[k], 0) > seconds + 10) chain.pop();
  return chain;
}

export function characterPlayer(c: CharacterRecord, build: { cards: { id: string; level: 1 | 2 | 3 }[] }): Player {
  const p = makePlayer('a1', c.nick, resolveBuild(build).activeClass, c.attrs as Attrs);
  p.build = build;
  return p;
}

/** Team DM: character + 4 leveled mates vs 5 leveled bots. */
export function dmTeams(me: Player, botAvg: number, seed: number): [Team, Team] {
  const rng = new Rng(seed);
  const names = rng.shuffle(BOT_TEAM_NAMES);
  const mates = generateBotTeam({ rng, targetAvg: botAvg, idPrefix: 'x', classes: ['igl', 'awper', 'entry', 'anchor'] });
  const a: Team = { id: 'a', name: names[0] as string, players: [me, ...mates.players.map((p, i) => ({ ...p, id: `a${i + 2}` }))] };
  const b = generateBotTeam({ rng, targetAvg: botAvg, idPrefix: 'b', name: names[1] });
  return [a, b];
}

export function scenarioSeed(sessionStart: number, index: number): number {
  return hashSeed(`${sessionStart}:${index}`);
}
