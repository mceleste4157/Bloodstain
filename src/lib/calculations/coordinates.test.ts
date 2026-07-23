import { describe, expect, it } from 'vitest';
import type { Bloodstain, Room } from '@/types';
import {
  axisDiscrepancy,
  distance2D,
  distance3D,
  resolveAxis,
  stainRoomPosition,
} from './coordinates';

describe('distance helpers', () => {
  it('computes 2D and 3D Euclidean distance', () => {
    expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 6 })).toBe(7);
  });
});

describe('resolveAxis', () => {
  it('uses the near measurement when only it is present', () => {
    expect(resolveAxis(3, undefined, 10)).toBe(3);
  });

  it('derives from the far measurement and span', () => {
    expect(resolveAxis(undefined, 7, 10)).toBe(3);
  });

  it('averages agreeing near and far measurements', () => {
    expect(resolveAxis(3, 7, 10)).toBe(3);
  });

  it('averages disagreeing measurements toward the middle', () => {
    // near says 3, far says span-8 = 2 → mean 2.5
    expect(resolveAxis(3, 8, 10)).toBe(2.5);
  });

  it('returns null when nothing is measurable', () => {
    expect(resolveAxis(undefined, undefined, 10)).toBeNull();
    expect(resolveAxis(undefined, 7, undefined)).toBeNull();
  });
});

describe('axisDiscrepancy', () => {
  it('is zero when the two estimates agree', () => {
    expect(axisDiscrepancy(3, 7, 10)).toBe(0);
  });

  it('reports the gap between disagreeing estimates', () => {
    expect(axisDiscrepancy(3, 8, 10)).toBe(1);
  });

  it('is null when it cannot be computed', () => {
    expect(axisDiscrepancy(3, undefined, 10)).toBeNull();
  });
});

describe('stainRoomPosition', () => {
  const room: Room = { width: 100, length: 200, height: 250 };

  it('maps wall-relative measurements into room coordinates', () => {
    const stain = {
      distanceFromLeftWall: 20,
      distanceFromFrontWall: 30,
      heightAboveFloor: 40,
    } as Bloodstain;
    expect(stainRoomPosition(stain, room)).toEqual({ x: 20, y: 30, z: 40 });
  });

  it('resolves from far-wall measurements using the room span', () => {
    const stain = {
      distanceFromRightWall: 25, // → x = 100 - 25 = 75
      distanceFromRearWall: 50, // → y = 200 - 50 = 150
      distanceFromCeiling: 10, // → z = 250 - 10 = 240
    } as Bloodstain;
    expect(stainRoomPosition(stain, room)).toEqual({ x: 75, y: 150, z: 240 });
  });

  it('defaults unresolved axes to zero but still returns a point', () => {
    const stain = { distanceFromLeftWall: 20 } as Bloodstain;
    expect(stainRoomPosition(stain, room)).toEqual({ x: 20, y: 0, z: 0 });
  });

  it('returns null when no axis can be resolved', () => {
    expect(stainRoomPosition({} as Bloodstain, room)).toBeNull();
  });
});
