/**
 * Prints a human-readable summary of one simulated match.
 *   npm run example -- [seed]
 */
import { MAP01 } from '../src/data/maps/map01';
import { generateBotMatchup } from '../src/bots';
import { weapon } from '../src/data/weapons';
import { isEvent } from '../src/events';
import { simulateMatch } from '../src/match';
import { displayRating } from '../src/rating';
import { Rng } from '../src/rng';

const seed = Number(process.argv[2] ?? 42);
const teams = generateBotMatchup(new Rng(seed), 50, 50);
const log = simulateMatch({ map: MAP01, teams }, seed);
const nick = (id: string) => log.teams.flatMap((t) => t.players).find((p) => p.id === id)?.nick ?? id;

console.log(`seed ${seed} · mapa ${log.mapId} · ${log.events.length} eventos · ${log.rounds.length} rounds${log.overtime ? ' (OT)' : ''}`);
console.log(`${log.teams[0].name} ${log.score[0]} x ${log.score[1]} ${log.teams[1].name}  → vencedor: ${log.teams[log.winner].name}`);
const half = log.rounds.slice(0, 12).reduce((s, r) => (r.winnerTeam === 0 ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]), [0, 0] as [number, number]);
console.log(`1º tempo ${half[0]}–${half[1]} (${log.teams[0].name} começou de ${log.startingSides.CT === 0 ? 'CT' : 'T'})`);

console.log('\nTop 3 rating');
const top = log.stats.slice().sort((a, b) => b.rating - a.rating).slice(0, 3);
for (const s of top) {
  console.log(`  ${nick(s.id).padEnd(14)} ${log.teams[s.team].players.find((p) => p.id === s.id)?.class.padEnd(7)} ${displayRating(s.rating).toFixed(2)}  K ${s.kills} D ${s.deaths} A ${s.assists} ADR ${s.adr.toFixed(0)} KAST ${s.kast.toFixed(0)}%`);
}

console.log('\nKill feed (5 primeiras)');
const kills = log.events.filter((e) => isEvent(e, 'kill')).slice(0, 5);
for (const k of kills) {
  const t = `${String(Math.floor(k.t / 60)).padStart(1)}:${String(k.t % 60).padStart(2, '0')}`;
  console.log(`  R${k.round} ${t}  ${nick(k.attacker)} [${weapon(k.weapon).name}${k.headshot ? ' ✦HS' : ''}${k.trade ? ' trade' : ''}] ${nick(k.victim)}  @${k.area}`);
}

console.log('\nRounds');
console.log('  ' + log.rounds.map((r) => `${r.round}:${r.winner}${r.reason[0]}`).join(' '));
