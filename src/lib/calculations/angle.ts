/**
 * Impact-angle and stain-shape calculations.
 *
 * When a blood droplet strikes a surface it leaves an elliptical stain. The
 * ratio of the ellipse's minor axis (width) to its major axis (length) encodes
 * the angle at which the droplet struck:
 *
 *     sin(α) = width / length            →      α = arcsin(width / length)
 *
 * where α is the *angle of impact* measured from the plane of the surface. A
 * droplet hitting head-on (90°) makes a circle (width ≈ length); a shallow,
 * glancing droplet makes a long thin ellipse (width ≪ length).
 */

import { toDegrees } from './units';

/**
 * Width-to-length ratio of an elliptical stain. Values approach 1 for
 * near-circular stains and approach 0 for highly elongated ones.
 *
 * Returns NaN when `length` is not positive, so callers can surface a
 * validation message rather than propagate a divide-by-zero.
 */
export function widthToLengthRatio(width: number, length: number): number {
  if (!(length > 0)) return NaN;
  return width / length;
}

/**
 * Angle of impact in degrees, α = arcsin(width / length).
 *
 * Returns `null` when the inputs cannot yield a physically meaningful angle:
 *  - non-positive width or length, or
 *  - width > length (ratio > 1), which is physically impossible for a real
 *    stain and usually indicates the axes were swapped or mismeasured.
 *
 * Callers should treat `null` as "prompt the investigator to re-check the
 * measurement" rather than silently substituting a value.
 */
export function impactAngleDeg(width: number, length: number): number | null {
  if (!(width > 0) || !(length > 0)) return null;
  const ratio = width / length;
  if (ratio > 1) return null;
  return toDegrees(Math.asin(ratio));
}
