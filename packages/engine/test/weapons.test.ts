import { describe, expect, it } from 'vitest';
import { GEAR, KILL_REWARD, WEAPONS, riflesFor, smgFor, starterPistol, weapon } from '../src/data/weapons';

describe('weapons table', () => {
  it('has unique ids and GDD prices', () => {
    const ids = WEAPONS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(weapon('ak47').price).toBe(2700);
    expect(weapon('m4').price).toBe(3100);
    expect(weapon('m4s').price).toBe(2900);
    expect(weapon('awp').price).toBe(4750);
    expect(weapon('galil').price).toBe(1800);
    expect(weapon('famas').price).toBe(2050);
    expect(weapon('mp9').price).toBe(1250);
    expect(weapon('mac10').price).toBe(1050);
    expect(weapon('deagle').price).toBe(700);
    expect(weapon('p250').price).toBe(300);
  });

  it('kill rewards follow GDD 5.4', () => {
    expect(KILL_REWARD).toMatchObject({ rifle: 300, awp: 100, smg: 600, shotgun: 900, knife: 1500 });
    expect(weapon('ak47').killReward).toBe(300);
    expect(weapon('awp').killReward).toBe(100);
  });

  it('range modifiers follow GDD 5.4', () => {
    expect(weapon('awp').rangeMod).toMatchObject({ long: 18, short: -10 });
    expect(weapon('ak47').rangeMod).toEqual({ short: 0, mid: 0, long: 0 });
    expect(weapon('mp9').rangeMod).toMatchObject({ short: 6, mid: -6 });
    expect(weapon('glock').rangeMod.long).toBe(-18);
  });

  it('gear prices follow GDD 5.4', () => {
    expect(GEAR.kevlar).toBe(650);
    expect(GEAR.kevlarHelmet).toBe(1000);
    expect(GEAR.kit).toBe(400);
    expect(GEAR.flash).toBe(200);
    expect(GEAR.smoke).toBe(300);
    expect(GEAR.molotov.T).toBe(400);
    expect(GEAR.molotov.CT).toBe(600);
    expect(GEAR.he).toBe(300);
  });

  it('side helpers', () => {
    expect(starterPistol('T').id).toBe('glock');
    expect(starterPistol('CT').id).toBe('usp');
    expect(riflesFor('T').map((w) => w.id)).toEqual(['galil', 'ak47']);
    expect(riflesFor('CT').map((w) => w.id)).toEqual(['famas', 'm4s', 'm4']);
    expect(smgFor('CT').id).toBe('mp9');
    expect(() => weapon('nope')).toThrow();
  });
});
