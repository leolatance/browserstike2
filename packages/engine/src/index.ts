export const ENGINE_VERSION = '0.0.1';

export { Rng } from './rng';
export * from './events';
export * from './player';
export * from './economy';
export * from './duel';
export * from './rating';
export * from './bots';
export * from './map';
export { ROUND, simulateRound } from './round';
export type { RoundParams, RoundResult, RoundPlayer, RoundTeam, PlayerRoundStats } from './round';
export { MENTAL, ctFor, simulateMatch } from './match';
export type { MatchConfig } from './match';
export * from './data/weapons';
export { MAP01 } from './data/maps/map01';
export * from './data/cards';
export * from './drill';
export { BOT_NICKS, BOT_TEAM_NAMES } from './data/botnames';
