import { describe, expect, it } from 'vitest';
import { impactAngleDeg, widthToLengthRatio } from './angle';

describe('widthToLengthRatio', () => {
  it('computes the ratio for a valid ellipse', () => {
    expect(widthToLengthRatio(5, 10)).toBe(0.5);
    expect(widthToLengthRatio(10, 10)).toBe(1);
  });

  it('returns NaN for a non-positive length', () => {
    expect(widthToLengthRatio(5, 0)).toBeNaN();
    expect(widthToLengthRatio(5, -3)).toBeNaN();
  });
});

describe('impactAngleDeg', () => {
  it('returns 90° for a circular stain (width == length)', () => {
    expect(impactAngleDeg(10, 10)).toBeCloseTo(90);
  });

  it('returns 30° when the ratio is 0.5', () => {
    expect(impactAngleDeg(5, 10)).toBeCloseTo(30);
  });

  it('returns 45° for the sin(45°) ratio', () => {
    expect(impactAngleDeg(Math.SQRT1_2 * 10, 10)).toBeCloseTo(45);
  });

  it('rejects physically impossible or invalid measurements', () => {
    expect(impactAngleDeg(11, 10)).toBeNull(); // width > length
    expect(impactAngleDeg(0, 10)).toBeNull();
    expect(impactAngleDeg(5, 0)).toBeNull();
    expect(impactAngleDeg(-1, 10)).toBeNull();
  });
});
