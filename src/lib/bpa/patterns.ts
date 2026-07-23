/**
 * Bloodstain pattern taxonomy.
 *
 * Classification follows the mainstream forensic scheme (aligned with OSAC /
 * SWGSTAIN terminology): every stain is one of a handful of top-level
 * categories — passive, spatter (impact/projected), transfer, or altered — each
 * with recognized specific pattern types. Classification is a core part of BPA
 * documentation, so it is a first-class field on every stain and surfaces in
 * the report.
 *
 * References:
 *  - OSAC / SWGSTAIN bloodstain terminology
 *  - "Terminology: Pattern Types", Language of Forensics: Bloodstain Pattern
 *    Evidence (eCampusOntario)
 */

export type PatternCategory = 'passive' | 'spatter' | 'transfer' | 'altered' | 'other';

export interface PatternType {
  value: string;
  label: string;
}

export interface PatternGroup {
  category: PatternCategory;
  label: string;
  /** One-line description of the mechanism, shown as help text. */
  description: string;
  types: PatternType[];
}

export const PATTERN_GROUPS: PatternGroup[] = [
  {
    category: 'passive',
    label: 'Passive',
    description: 'Formed by gravity acting on blood (no applied force).',
    types: [
      { value: 'drip', label: 'Drip stain' },
      { value: 'drip-pattern', label: 'Drip pattern (blood into blood)' },
      { value: 'drip-trail', label: 'Drip trail' },
      { value: 'flow', label: 'Flow' },
      { value: 'pool', label: 'Pool' },
      { value: 'saturation', label: 'Saturation' },
      { value: 'clot', label: 'Clot' },
    ],
  },
  {
    category: 'spatter',
    label: 'Spatter (impact / projected)',
    description: 'Blood dispersed through the air by an applied force.',
    types: [
      { value: 'impact', label: 'Impact spatter' },
      { value: 'cast-off', label: 'Cast-off' },
      { value: 'arterial', label: 'Arterial spurt / gush' },
      { value: 'expirated', label: 'Expirated (respiratory)' },
      { value: 'mist', label: 'Mist' },
      { value: 'splash', label: 'Splash' },
      { value: 'projected', label: 'Projected' },
    ],
  },
  {
    category: 'transfer',
    label: 'Transfer / contact',
    description: 'A bloody object contacts a surface, leaving an image.',
    types: [
      { value: 'contact', label: 'Contact / pattern transfer' },
      { value: 'wipe', label: 'Wipe' },
      { value: 'swipe', label: 'Swipe' },
      { value: 'pattern-transfer', label: 'Pattern transfer (e.g. shoeprint)' },
    ],
  },
  {
    category: 'altered',
    label: 'Altered',
    description: 'A stain changed after deposition.',
    types: [
      { value: 'void', label: 'Void' },
      { value: 'diluted', label: 'Diluted' },
      { value: 'diffused', label: 'Diffused' },
      { value: 'insect', label: 'Insect / fly artifact' },
      { value: 'sequenced', label: 'Sequenced / layered' },
      { value: 'dried', label: 'Dried / aged' },
    ],
  },
  {
    category: 'other',
    label: 'Other / unknown',
    description: 'Unclassified or pending determination.',
    types: [{ value: 'unknown', label: 'Unknown' }],
  },
];

/** Flat lookup from a pattern value to its definition and category. */
const PATTERN_INDEX: Record<string, { type: PatternType; category: PatternCategory; groupLabel: string }> =
  (() => {
    const index: Record<string, { type: PatternType; category: PatternCategory; groupLabel: string }> = {};
    for (const group of PATTERN_GROUPS) {
      for (const type of group.types) {
        index[type.value] = { type, category: group.category, groupLabel: group.label };
      }
    }
    return index;
  })();

/** Human label for a stored pattern value (falls back to the raw value). */
export function patternLabel(value: string | undefined): string {
  if (!value) return '—';
  return PATTERN_INDEX[value]?.type.label ?? value;
}

/** Top-level category for a stored pattern value, or null if unknown. */
export function patternCategory(value: string | undefined): PatternCategory | null {
  if (!value) return null;
  return PATTERN_INDEX[value]?.category ?? null;
}

/** Count stains per category, for report/dashboard breakdowns. */
export function categoryCounts(values: Array<string | undefined>): Record<PatternCategory, number> {
  const counts: Record<PatternCategory, number> = {
    passive: 0,
    spatter: 0,
    transfer: 0,
    altered: 0,
    other: 0,
  };
  for (const v of values) {
    const cat = patternCategory(v);
    if (cat) counts[cat] += 1;
  }
  return counts;
}
