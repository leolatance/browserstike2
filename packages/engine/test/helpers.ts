import { generateBotMatchup } from '../src/bots';
import { freshInventory } from '../src/economy';
import { START_MONEY } from '../src/economy';
import type { Side } from '../src/events';
import type { Team } from '../src/player';
import { Rng } from '../src/rng';
import type { RoundPlayer, RoundTeam } from '../src/round';

export function botTeams(seed: number, avgA = 50, avgB = 50, spread?: number): [Team, Team] {
  return generateBotMatchup(new Rng(seed), avgA, avgB, spread);
}

export function roundTeam(team: Team, index: 0 | 1, side: Side, money = START_MONEY): RoundTeam {
  const players: RoundPlayer[] = team.players.map((p) => ({
    id: p.id,
    team: index,
    base: p,
    money,
    inv: freshInventory(side),
    mental: p.attrs.mental,
  }));
  return { index, players, lossStreak: 0 };
}
