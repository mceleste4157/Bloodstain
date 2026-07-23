/**
 * Area of origin and stringing.
 *
 * Once the 2D area of convergence is known, the third dimension (height of the
 * blood source above the plane of the stains) is recovered with the tangent
 * method. For each stain:
 *
 *     z = d · tan(α)
 *
 * where d is the horizontal distance from the stain to the convergence point
 * and α is the stain's angle of impact. Geometrically this is the classic
 * "stringing" reconstruction — a string runs from each stain back toward the
 * source, rising out of the plane at the impact angle; all the strings meet
 * near the area of origin.
 *
 * Because every stain gives an independent height estimate, we report the mean
 * height together with its spread, which is a direct, honest measure of the
 * reconstruction's uncertainty.
 */

import type { Point2D, Point3D } from '@/types';
import { distance2D } from './coordinates';
import { toDegrees, toRadians } from './units';

/** A stain reduced to just what the origin calculation needs. */
export interface OriginInputStain {
  id: string;
  position: Point2D;
  /** Angle of impact in degrees (from `impactAngleDeg`). */
  impactAngleDeg: number;
}

/** The reconstructed string for a single stain. */
export interface StringingResult {
  stainId: string;
  /** Horizontal (in-plane) distance from stain to the convergence point. */
  horizontalDistance: number;
  /** Height of the origin above the plane implied by this stain alone. */
  heightEstimate: number;
  /** 3D length of the string from stain to the estimated origin. */
  stringLength: number;
  /** Compass bearing (deg, math convention) from stain toward convergence. */
  azimuthDeg: number;
  /** Elevation angle of the string above the plane = the impact angle. */
  elevationDeg: number;
}

export interface AreaOfOriginResult {
  /** Best estimate of the source location in 3D (plane coords + height). */
  origin: Point3D;
  /** Mean of the per-stain height estimates. */
  meanHeight: number;
  /** Sample standard deviation of the height estimates (0 for a single stain). */
  heightStdDev: number;
  /** Per-stain stringing detail, useful for the sketch and report tables. */
  strings: StringingResult[];
}

/**
 * Compute stringing detail and the area of origin from a set of stains and a
 * previously-computed convergence point.
 *
 * The plane is treated as z = 0; `origin.z` (and every `heightEstimate`) is the
 * height *above that plane*. For floor stains this is height above the floor;
 * the caller is responsible for choosing a convergence plane consistent with
 * the stains it passes in.
 *
 * Returns null when no stains are supplied.
 */
export function areaOfOrigin(
  stains: OriginInputStain[],
  convergence: Point2D,
): AreaOfOriginResult | null {
  if (stains.length === 0) return null;

  const strings: StringingResult[] = stains.map((stain) => {
    const d = distance2D(stain.position, convergence);
    const alpha = toRadians(stain.impactAngleDeg);
    const height = d * Math.tan(alpha);
    const dx = convergence.x - stain.position.x;
    const dy = convergence.y - stain.position.y;
    return {
      stainId: stain.id,
      horizontalDistance: d,
      heightEstimate: height,
      stringLength: Math.hypot(d, height),
      azimuthDeg: toDegrees(Math.atan2(dy, dx)),
      elevationDeg: stain.impactAngleDeg,
    };
  });

  const heights = strings.map((s) => s.heightEstimate);
  const meanHeight = mean(heights);

  return {
    origin: { x: convergence.x, y: convergence.y, z: meanHeight },
    meanHeight,
    heightStdDev: sampleStdDev(heights),
    strings,
  };
}

// --- small statistics helpers ---

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
}
