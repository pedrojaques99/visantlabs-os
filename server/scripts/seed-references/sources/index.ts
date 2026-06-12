/**
 * Source registry. Add new award/archive adapters here.
 *
 * Tier-1 geo-native sources are implemented as the exemplary pattern. To add
 * another (iF Design, Golden Bee, Packaging of the World, European Design
 * Awards…), copy an adapter, set its gallery URL + awardSource, and register it.
 */

import type { SeedSource } from '../types.js';
import { arena } from './arena.js';
import { oneClub } from './one-club.js';
import { fontsInUse } from './fonts-in-use.js';
import { pentawards } from './pentawards.js';

// arena first — it's the free, no-credits starter source.
export const SOURCES: SeedSource[] = [arena, oneClub, fontsInUse, pentawards];

export function getSource(id: string): SeedSource | undefined {
  return SOURCES.find((s) => s.id === id);
}
