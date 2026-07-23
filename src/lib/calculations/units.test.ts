import { describe, expect, it } from 'vitest';
import { convertLength, formatLength, fromMm, toDegrees, toMm, toRadians } from './units';

describe('length conversion', () => {
  it('converts to and from millimeters', () => {
    expect(toMm(1, 'in')).toBeCloseTo(25.4);
    expect(toMm(1, 'ft')).toBeCloseTo(304.8);
    expect(toMm(1, 'm')).toBe(1000);
    expect(fromMm(1000, 'm')).toBe(1);
    expect(fromMm(25.4, 'in')).toBeCloseTo(1);
  });

  it('converts directly between units', () => {
    expect(convertLength(1, 'ft', 'in')).toBeCloseTo(12);
    expect(convertLength(100, 'cm', 'm')).toBeCloseTo(1);
    expect(convertLength(5, 'mm', 'mm')).toBe(5); // identity fast-path
  });

  it('formats canonical mm values in the chosen system', () => {
    expect(formatLength(1000, 'metric')).toBe('100.0 cm');
    expect(formatLength(25.4, 'imperial')).toBe('1.0 in');
  });
});

describe('angle helpers', () => {
  it('round-trips degrees and radians', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI);
    expect(toDegrees(Math.PI)).toBeCloseTo(180);
    expect(toDegrees(toRadians(37))).toBeCloseTo(37);
  });
});
