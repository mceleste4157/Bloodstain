/**
 * Scene-level analysis orchestration.
 *
 * Ties the primitives together for a whole case: computes each stain's derived
 * values, assembles the directionality lines on the top-view (floor) plane,
 * solves for the area of convergence, and reconstructs the 3D area of origin.
 *
 * This is the single function the UI, sketch generator, and PDF report all call
 * to get a consistent, fully-derived picture of a scene. It performs no I/O and
 * mutates nothing, so it is trivially testable and safe to run on every edit.
 */

import type { Bloodstain, Point3D, Room } from '@/types';
import { impactAngleDeg } from './angle';
import { areaOfConvergence, type ConvergenceResult, type DirectionalityLine } from './convergence';
import { areaOfOrigin, type AreaOfOriginResult, type OriginInputStain } from './origin';
import { calculateStain } from './stain';
import type { StainCalculations } from '@/types';

export interface SceneAnalysis {
  /** Per-stain derived values, keyed by stain id. */
  stainResults: Record<string, StainCalculations>;
  /** Area of convergence on the top-view plane, or null if not derivable. */
  convergence: ConvergenceResult | null;
  /** Reconstructed 3D area of origin, or null if not derivable. */
  origin: AreaOfOriginResult | null;
  /** Stains that could not contribute (missing angle or directionality). */
  excludedStainIds: string[];
}

/**
 * Analyze an entire scene.
 *
 * A stain contributes to the convergence/origin reconstruction only when it has
 * both a resolvable top-view position and both a valid impact angle and a
 * directionality bearing. Stains missing any of these are still given per-stain
 * results but are reported in `excludedStainIds` so the UI can explain why the
 * reconstruction used fewer stains than were documented.
 */
export function analyzeScene(stains: Bloodstain[], room?: Room): SceneAnalysis {
  const stainResults: Record<string, StainCalculations> = {};
  const lines: DirectionalityLine[] = [];
  const originInputs: OriginInputStain[] = [];
  const excludedStainIds: string[] = [];

  for (const stain of stains) {
    const result = calculateStain(stain, room);
    stainResults[stain.id] = result;

    const angle = impactAngleDeg(stain.width, stain.length);
    const position = result.position;
    const hasBearing = typeof stain.directionality === 'number';

    if (position && angle !== null && hasBearing) {
      // Top-view plane uses (x, y); height (z) is recovered by the origin step.
      const planePosition = { x: position.x, y: position.y };
      lines.push({ position: planePosition, bearingDeg: stain.directionality as number });
      originInputs.push({ id: stain.id, position: planePosition, impactAngleDeg: angle });
    } else {
      excludedStainIds.push(stain.id);
    }
  }

  const convergence = areaOfConvergence(lines);
  const origin = convergence ? areaOfOrigin(originInputs, convergence.point) : null;

  return { stainResults, convergence, origin, excludedStainIds };
}

/** Convenience: the 3D area-of-origin point, or null. */
export function originPoint(analysis: SceneAnalysis): Point3D | null {
  return analysis.origin?.origin ?? null;
}
