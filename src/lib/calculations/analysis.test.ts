import { describe, expect, it } from 'vitest';
import type { Bloodstain, Room } from '@/types';
import { analyzeScene, groupOf } from './analysis';

const room: Room = { width: 400, length: 400, height: 300 };

/** Build a floor stain at (x, y) with a given impact angle and bearing. */
function stain(
  id: string,
  x: number,
  y: number,
  width: number,
  length: number,
  bearingDeg: number,
  group?: string,
): Bloodstain {
  return {
    id,
    stainId: id,
    surface: 'floor',
    group,
    width,
    length,
    directionality: bearingDeg,
    distanceFromLeftWall: x,
    distanceFromFrontWall: y,
    heightAboveFloor: 0,
  };
}

describe('analyzeScene', () => {
  it('reconstructs convergence and origin per group', () => {
    // Two stains whose axes cross at (100, 100), each at a 45° impact angle.
    const stains: Bloodstain[] = [
      stain('s1', 100, 0, Math.SQRT1_2 * 10, 10, 90, 'A'),
      stain('s2', 0, 100, Math.SQRT1_2 * 10, 10, 0, 'A'),
    ];
    const analysis = analyzeScene(stains, room);

    const groupA = groupOf(analysis, 'A')!;
    expect(groupA).toBeTruthy();
    expect(groupA.convergence).not.toBeNull();
    expect(groupA.convergence!.point.x).toBeCloseTo(100);
    expect(groupA.convergence!.point.y).toBeCloseTo(100);
    expect(groupA.origin).not.toBeNull();
    expect(groupA.origin!.meanHeight).toBeCloseTo(100);
    expect(groupA.excludedStainIds).toHaveLength(0);
  });

  it('reconstructs each group independently', () => {
    const stains: Bloodstain[] = [
      stain('a1', 100, 0, Math.SQRT1_2 * 10, 10, 90, 'A'),
      stain('a2', 0, 100, Math.SQRT1_2 * 10, 10, 0, 'A'),
      stain('b1', 300, 0, Math.SQRT1_2 * 10, 10, 90, 'B'),
      stain('b2', 200, 100, Math.SQRT1_2 * 10, 10, 0, 'B'),
    ];
    const analysis = analyzeScene(stains, room);
    expect(analysis.groups).toHaveLength(2);
    expect(groupOf(analysis, 'A')!.convergence!.point.x).toBeCloseTo(100);
    expect(groupOf(analysis, 'B')!.convergence!.point.x).toBeCloseTo(300);
  });

  it('does not converge a group with a single usable stain', () => {
    const analysis = analyzeScene([stain('solo', 100, 0, 5, 10, 90, 'A')], room);
    const g = groupOf(analysis, 'A')!;
    expect(g.convergence).toBeNull();
    expect(g.origin).toBeNull();
  });

  it('excludes stains missing directionality or a valid angle', () => {
    const good = stain('good', 100, 0, Math.SQRT1_2 * 10, 10, 90, 'A');
    const noBearing = stain('noBearing', 0, 100, Math.SQRT1_2 * 10, 10, 90, 'A');
    delete (noBearing as { directionality?: number }).directionality;
    const badAngle = stain('badAngle', 0, 100, 11, 10, 0, 'A'); // width > length

    const analysis = analyzeScene([good, noBearing, badAngle], room);
    const g = groupOf(analysis, 'A')!;
    expect(g.excludedStainIds).toContain('noBearing');
    expect(g.excludedStainIds).toContain('badAngle');
    // Only one usable line → no unique convergence.
    expect(g.convergence).toBeNull();
  });

  it('still returns per-stain results for every stain', () => {
    const analysis = analyzeScene([stain('s1', 100, 0, 5, 10, 90, 'A')], room);
    expect(analysis.stainResults['s1'].impactAngleDeg).toBeCloseTo(30);
    expect(analysis.stainResults['s1'].widthToLengthRatio).toBeCloseTo(0.5);
  });
});
