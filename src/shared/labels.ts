import type { StatKey } from './types';

export const STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP',
  mp: 'MP',
  att: 'ATT',
  def: 'DEF',
  spd: 'SPD',
  dex: 'DEX',
  vit: 'VIT',
  wis: 'WIS',
};

/** Stat → the potion that raises it. */
export const POT_LABEL: Record<StatKey, string> = {
  hp: 'Life',
  mp: 'Mana',
  att: 'Attack',
  def: 'Defense',
  spd: 'Speed',
  dex: 'Dexterity',
  vit: 'Vitality',
  wis: 'Wisdom',
};
