import { describe, expect, it } from 'vitest';
import type { Bloodstain, Room } from '@/types';
import { analyzeScene } from './analysis';

const room: Room = { width: 400, length: 400, height: 300 };

/** Build a floor stain at (x, y) with a given impact angle and bearing. */
function stain(
  id: string,
  x: number,
  y: number,
  width: number,
  length: number,
  bearingDeg: number,
): Bloodstain {
  return {
    id,
    stainId: id,
    surface: 'floor',
    width,
    length,
    directionality: bearingDeg,
    distanceFromLeftWall: x,
    distanceFromFrontWall: y,
    heightAboveFloor: 0,
  };
}

describe('analyzeScene', () => {
  it('reconstructs convergence and origin from consistent stains', () => {
    // Two stains whose axes cross at (100, 100), each at a 45° impact angle.
    const stains: Bloodstain[] = [
      stain('s1', 100, 0, Math.SQRT1_2 * 10, 10, 90), // x=100 axis, points +y
      stain('s2', 0, 100, Math.SQRT1_2 * 10, 10, 0), // y=100 axis, points +x
    ];
    const analysis = analyzeScene(stains, room);

    expect(analysis.convergence).not.toBeNull();
    expect(analysis.convergence!.point.x).toBeCloseTo(100);
    expect(analysis.convergence!.point.y).toBeCloseTo(100);

    expect(analysis.origin).not.toBeNull();
    // Each stain: d=100, 45° → height 100.
    expect(analysis.origin!.meanHeight).toBeCloseTo(100);
    expect(analysis.excludedStainIds).toHaveLength(0);
  });

  it('excludes stains missing directionality or a valid angle', () => {
    const good = stain('good', 100, 0, Math.SQRT1_2 * 10, 10, 90);
    const noBearing = stain('noBearing', 0, 100, Math.SQRT1_2 * 10, 10, 90);
    delete (noBearing as { directionality?: number }).directionality;
    const badAngle = stain('badAngle', 0, 100, 11, 10, 0); // width > length

    const analysis = analyzeScene([good, noBearing, badAngle], room);
    expect(analysis.excludedStainIds).toContain('noBearing');
    expect(analysis.excludedStainIds).toContain('badAngle');
    // Only one usable line → no unique convergence.
    expect(analysis.convergence).toBeNull();
    expect(analysis.origin).toBeNull();
  });

  it('still returns per-stain results for every stain', () => {
    const stains = [stain('s1', 100, 0, 5, 10, 90)];
    const analysis = analyzeScene(stains, room);
    expect(analysis.stainResults['s1'].impactAngleDeg).toBeCloseTo(30);
    expect(analysis.stainResults['s1'].widthToLengthRatio).toBeCloseTo(0.5);
  });
});
