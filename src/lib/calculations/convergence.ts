/**
 * Area of convergence.
 *
 * Each stain's long axis, extended backward along its directionality, points
 * toward the 2D location of the blood source projected onto the plane of the
 * stains (classically the floor plan). With two stains the lines simply
 * intersect; with many stains the lines rarely meet at one point, so we compute
 * the point that minimizes the total squared perpendicular distance to every
 * line — the least-squares "area of convergence".
 *
 * Math: for a line through point pᵢ with unit direction uᵢ, the matrix that
 * projects onto the direction perpendicular to the line is
 *
 *     Mᵢ = I − uᵢ uᵢᵀ
 *
 * The convergence point x minimizes Σ (x − pᵢ)ᵀ Mᵢ (x − pᵢ), giving the normal
 * equations (Σ Mᵢ) x = Σ Mᵢ pᵢ, a 2×2 linear system.
 */

import type { Point2D } from '@/types';
import { toRadians } from './units';

/** One input line: a stain position and its directionality bearing (degrees). */
export interface DirectionalityLine {
  position: Point2D;
  /** Bearing of the long axis toward the source, degrees, math convention. */
  bearingDeg: number;
}

export interface ConvergenceResult {
  point: Point2D;
  /** RMS of the perpendicular distances from the point to each line. */
  rmsError: number;
  /** Number of lines that contributed to the estimate. */
  lineCount: number;
}

/**
 * Compute the least-squares area of convergence for a set of directionality
 * lines. Returns null when there are fewer than two lines or the lines are
 * (near-)parallel, in which case no unique convergence exists.
 */
export function areaOfConvergence(
  lines: DirectionalityLine[],
): ConvergenceResult | null {
  if (lines.length < 2) return null;

  // Accumulate the normal-equation matrix A (Σ Mᵢ) and vector b (Σ Mᵢ pᵢ).
  let a00 = 0;
  let a01 = 0;
  let a11 = 0;
  let b0 = 0;
  let b1 = 0;

  for (const line of lines) {
    const theta = toRadians(line.bearingDeg);
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);

    // Mᵢ = I − uuᵀ  (symmetric: m01 == m10)
    const m00 = 1 - ux * ux;
    const m01 = -ux * uy;
    const m11 = 1 - uy * uy;

    a00 += m00;
    a01 += m01;
    a11 += m11;

    const { x: px, y: py } = line.position;
    // Mᵢ pᵢ
    b0 += m00 * px + m01 * py;
    b1 += m01 * px + m11 * py;
  }

  // Solve the 2×2 system A x = b via Cramer's rule.
  const det = a00 * a11 - a01 * a01;
  if (Math.abs(det) < 1e-9) return null; // lines parallel → no unique point

  const x = (b0 * a11 - b1 * a01) / det;
  const y = (a00 * b1 - a01 * b0) / det;
  const point: Point2D = { x, y };

  return {
    point,
    rmsError: rmsPerpendicularError(lines, point),
    lineCount: lines.length,
  };
}

/** RMS of perpendicular distances from `point` to each directionality line. */
export function rmsPerpendicularError(
  lines: DirectionalityLine[],
  point: Point2D,
): number {
  if (lines.length === 0) return 0;
  let sumSq = 0;
  for (const line of lines) {
    const theta = toRadians(line.bearingDeg);
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const dx = point.x - line.position.x;
    const dy = point.y - line.position.y;
    // Perpendicular component = |(d) − (d·u)u| = |d·nperp|, n = (-uy, ux)
    const perp = dx * -uy + dy * ux;
    sumSq += perp * perp;
  }
  return Math.sqrt(sumSq / lines.length);
}
