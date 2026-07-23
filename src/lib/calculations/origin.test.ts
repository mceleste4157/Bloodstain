import { describe, expect, it } from 'vitest';
import { areaOfOrigin, type OriginInputStain } from './origin';

describe('areaOfOrigin', () => {
  it('returns null with no stains', () => {
    expect(areaOfOrigin([], { x: 0, y: 0 })).toBeNull();
  });

  it('applies the tangent method for a single stain', () => {
    const stains: OriginInputStain[] = [
      { id: 's1', position: { x: 0, y: 0 }, impactAngleDeg: 45 },
    ];
    const result = areaOfOrigin(stains, { x: 10, y: 0 })!;
    // d = 10, tan(45°) = 1 → height 10
    expect(result.meanHeight).toBeCloseTo(10);
    expect(result.origin).toMatchObject({ x: 10, y: 0 });
    expect(result.origin.z).toBeCloseTo(10);
    expect(result.heightStdDev).toBe(0);

    const s = result.strings[0];
    expect(s.horizontalDistance).toBeCloseTo(10);
    expect(s.heightEstimate).toBeCloseTo(10);
    expect(s.stringLength).toBeCloseTo(Math.hypot(10, 10));
    expect(s.azimuthDeg).toBeCloseTo(0); // toward +x
    expect(s.elevationDeg).toBe(45);
  });

  it('averages independent height estimates and reports their spread', () => {
    const stains: OriginInputStain[] = [
      { id: 's1', position: { x: 0, y: 0 }, impactAngleDeg: 45 }, // d=10 → h=10
      { id: 's2', position: { x: 30, y: 0 }, impactAngleDeg: 45 }, // d=20 → h=20
    ];
    const result = areaOfOrigin(stains, { x: 10, y: 0 })!;
    expect(result.meanHeight).toBeCloseTo(15);
    // sample stddev of {10, 20} = sqrt(((-5)^2+5^2)/1) = sqrt(50)
    expect(result.heightStdDev).toBeCloseTo(Math.sqrt(50));
  });

  it('computes a shallower height for a low impact angle', () => {
    const stains: OriginInputStain[] = [
      { id: 's1', position: { x: 0, y: 0 }, impactAngleDeg: 30 },
    ];
    const result = areaOfOrigin(stains, { x: 10, y: 0 })!;
    // 10 * tan(30°) ≈ 5.7735
    expect(result.meanHeight).toBeCloseTo(10 * Math.tan(Math.PI / 6));
  });
});
