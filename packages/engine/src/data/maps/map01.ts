/**
 * Map 01 — "Baixada" (provisional parody name).
 * Two bombsites, a long open lane to A, a catwalk/short lane to A, an open
 * mid, and tunnels to B. Layout is *inspired* by the classic two-site map
 * archetype; geometry, names and radar are original.
 *
 * Radar space: 1024 x 1024 px. T spawn bottom-left, CT spawn top-right.
 */
import type { MapDef } from '../../map';

export const MAP01: MapDef = {
  id: 'baixada',
  name: 'Baixada',
  radar: { w: 1024, h: 1024 },
  spawns: { T: 't_spawn', CT: 'ct_spawn' },
  mid: { t: 't_mid', ct: 'ct_mid', contact: 'mid' },
  sites: {
    A: { plant: 'a_site', entrances: ['a_ramp', 'a_short'], holds: ['a_site', 'a_short'], forward: 'long' },
    B: { plant: 'b_site', entrances: ['b_tuns', 'b_doors'], holds: ['b_site', 'b_doors'], forward: 'b_tuns' },
  },
  areas: [
    // T side
    { id: 't_spawn', name: 'Spawn T', polygon: [[40, 780], [300, 780], [300, 990], [40, 990]], range: 'long' },
    { id: 'long_doors', name: 'Portões do Longo', polygon: [[40, 620], [200, 620], [200, 780], [40, 780]], range: 'short' },
    { id: 'long', name: 'Longo', polygon: [[40, 220], [200, 220], [200, 620], [40, 620]], range: 'long' },
    { id: 'a_ramp', name: 'Rampa A', polygon: [[200, 160], [310, 160], [310, 300], [200, 300]], range: 'mid' },
    { id: 't_mid', name: 'Rampa do Meio', polygon: [[300, 700], [410, 700], [410, 860], [300, 860]], range: 'mid' },
    { id: 'outside_tuns', name: 'Boca do Túnel', polygon: [[480, 780], [750, 780], [750, 990], [480, 990]], range: 'short' },
    { id: 'b_tuns', name: 'Túneis', polygon: [[750, 620], [860, 620], [860, 990], [750, 990]], range: 'short' },

    // Middle
    { id: 'mid', name: 'Meio', polygon: [[380, 380], [560, 380], [560, 700], [380, 700]], range: 'long' },
    { id: 'a_short', name: 'Passarela', polygon: [[440, 160], [560, 160], [560, 380], [440, 380]], range: 'mid' },
    { id: 'ct_mid', name: 'Meio CT', polygon: [[560, 380], [740, 380], [740, 560], [560, 560]], range: 'mid' },

    // Sites & CT side
    { id: 'a_site', name: 'Site A', polygon: [[200, 30], [560, 30], [560, 160], [200, 160]], range: 'mid' },
    { id: 'ct_spawn', name: 'Spawn CT', polygon: [[740, 30], [990, 30], [990, 380], [740, 380]], range: 'mid' },
    { id: 'b_doors', name: 'Portas B', polygon: [[740, 380], [860, 380], [860, 620], [740, 620]], range: 'short' },
    { id: 'b_site', name: 'Site B', polygon: [[860, 380], [990, 380], [990, 620], [860, 620]], range: 'mid' },
  ],
  routes: [
    // T spawn fan-out
    { from: 't_spawn', to: 'long_doors', time: 8, range: 'short' },
    { from: 't_spawn', to: 't_mid', time: 6, range: 'mid' },
    { from: 't_spawn', to: 'outside_tuns', time: 7, range: 'short' },
    // Long lane to A
    { from: 'long_doors', to: 'long', time: 6, range: 'long' },
    { from: 'long', to: 'a_ramp', time: 6, range: 'long' },
    { from: 'a_ramp', to: 'a_site', time: 4, range: 'mid' },
    // Mid and catwalk
    { from: 't_mid', to: 'mid', time: 5, range: 'long' },
    { from: 'mid', to: 'a_short', time: 7, range: 'mid' },
    { from: 'a_short', to: 'a_site', time: 5, range: 'mid' },
    { from: 'a_short', to: 'ct_mid', time: 4, range: 'short' },
    { from: 'mid', to: 'ct_mid', time: 6, range: 'long' },
    // CT side connectors
    { from: 'ct_mid', to: 'ct_spawn', time: 5, range: 'mid' },
    { from: 'ct_mid', to: 'b_doors', time: 5, range: 'short' },
    { from: 'ct_spawn', to: 'a_site', time: 7, range: 'mid' },
    { from: 'ct_spawn', to: 'b_doors', time: 6, range: 'mid' },
    { from: 'b_doors', to: 'b_site', time: 4, range: 'short' },
    // Tunnels to B
    { from: 'outside_tuns', to: 'b_tuns', time: 5, range: 'short' },
    { from: 'b_tuns', to: 'b_site', time: 5, range: 'short' },
  ],
};
