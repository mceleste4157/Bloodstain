/**
 * Per-stain derived values.
 *
 * Wraps the individual calculation primitives into the `StainCalculations`
 * shape consumed by the UI, sketch labels, and report tables. Everything here
 * is a pure function of the stain's raw measurements, so it can be recomputed
 * cheaply whenever an input changes — the app never stores a derived value as
 * the source of truth.
 */

import type { Bloodstain, Room, StainCalculations } from '@/types';
import { impactAngleDeg, widthToLengthRatio } from './angle';
import { stainRoomPosition } from './coordinates';

/** Compute all derived values for a single stain. */
export function calculateStain(stain: Bloodstain, room?: Room): StainCalculations {
  return {
    widthToLengthRatio: widthToLengthRatio(stain.width, stain.length),
    impactAngleDeg: impactAngleDeg(stain.width, stain.length),
    position: stainRoomPosition(stain, room),
  };
}
