import { describe, expect, it } from 'vitest';
import { categoryCounts, patternCategory, patternLabel, PATTERN_GROUPS } from './patterns';

describe('pattern taxonomy', () => {
  it('resolves labels and categories for known values', () => {
    expect(patternLabel('impact')).toBe('Impact spatter');
    expect(patternCategory('impact')).toBe('spatter');
    expect(patternCategory('drip')).toBe('passive');
    expect(patternCategory('wipe')).toBe('transfer');
    expect(patternCategory('void')).toBe('altered');
  });

  it('falls back gracefully for unknown or empty values', () => {
    expect(patternLabel(undefined)).toBe('—');
    expect(patternLabel('nonsense')).toBe('nonsense');
    expect(patternCategory(undefined)).toBeNull();
    expect(patternCategory('nonsense')).toBeNull();
  });

  it('counts stains per category', () => {
    const counts = categoryCounts(['impact', 'cast-off', 'drip', undefined, 'wipe']);
    expect(counts.spatter).toBe(2);
    expect(counts.passive).toBe(1);
    expect(counts.transfer).toBe(1);
    expect(counts.altered).toBe(0);
  });

  it('has unique pattern values across all groups', () => {
    const values = PATTERN_GROUPS.flatMap((g) => g.types.map((t) => t.value));
    expect(new Set(values).size).toBe(values.length);
  });
});
