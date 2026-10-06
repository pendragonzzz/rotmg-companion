import { biomes } from './gameData';

/** In-game beacon colors by biome tier — so players can spot the right beacon on their minimap. */
export const BEACON: Record<string, { color: string; label: string }> = {
  rookie: { color: '#22d3ee', label: 'Rookie' },
  adept: { color: '#7cc6ff', label: 'Adept' },
  veteran: { color: '#3b82f6', label: 'Veteran' },
  seasonal: { color: '#c084fc', label: 'Seasonal' },
};

export interface BeaconInfo {
  tier: string;
  color: string;
  label: string;
}

/** Beacon info for a biome slug (or null if unknown). */
export function beaconForBiome(slug?: string | null): BeaconInfo | null {
  if (!slug) return null;
  const tier = biomes.biomes[slug]?.tier;
  if (!tier) return null;
  const b = BEACON[tier];
  return b ? { tier, color: b.color, label: b.label } : null;
}

/** "sprite-forest" → "Sprite Forest". */
export const biomeName = (slug: string) =>
  slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
