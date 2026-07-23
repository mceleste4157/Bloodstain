/**
 * Coordinate mapping and distance calculations.
 *
 * Investigators record a stain's position as distances from the room's
 * bounding surfaces (left/right/front/rear walls, floor/ceiling). This module
 * turns those redundant measurements into a single (x, y, z) point in a room
 * coordinate frame whose origin is the front-left-floor corner:
 *
 *     x → rightward   (0 … room.width)
 *     y → rearward    (0 … room.length)
 *     z → upward      (0 … room.height)
 *
 * Redundant measurements (e.g. distance-from-left AND distance-from-right) are
 * reconciled: if both are present we prefer their agreement and can report the
 * discrepancy, catching transcription errors before they reach a report.
 */

import type { Bloodstain, Point2D, Point3D, Room } from '@/types';

/** Straight-line distance between two 2D points. */
export function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Straight-line distance between two 3D points. */
export function distance3D(a: Point3D, b: Point3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/**
 * Resolve a single axis coordinate from a near-side and/or far-side distance
 * measurement plus the total span of the room along that axis.
 *
 * - Only near given:      coordinate = near
 * - Only far given:       coordinate = span - far
 * - Both given:           average of the two estimates (span known)
 * - Both given, no span:  fall back to the near measurement
 * - Neither given:        null
 */
export function resolveAxis(
  near: number | undefined,
  far: number | undefined,
  span: number | undefined,
): number | null {
  const hasNear = typeof near === 'number';
  const hasFar = typeof far === 'number';

  if (hasNear && hasFar && typeof span === 'number') {
    return ((near as number) + (span - (far as number))) / 2;
  }
  if (hasNear) return near as number;
  if (hasFar && typeof span === 'number') return span - (far as number);
  return null;
}

/**
 * Disagreement (absolute difference) between the near-side and far-side
 * estimates of an axis coordinate, or null when it cannot be computed. A large
 * value flags a probable measurement/transcription error to the UI.
 */
export function axisDiscrepancy(
  near: number | undefined,
  far: number | undefined,
  span: number | undefined,
): number | null {
  if (typeof near !== 'number' || typeof far !== 'number' || typeof span !== 'number') {
    return null;
  }
  const nearEstimate = near;
  const farEstimate = span - far;
  return Math.abs(nearEstimate - farEstimate);
}

/**
 * Map a stain's wall-relative measurements into a room (x, y, z) point.
 *
 * Returns null only when no axis can be resolved at all. Individual axes that
 * cannot be resolved default to 0 so a partially-measured stain still yields a
 * usable point for sketching, while the caller can inspect `resolveAxis`
 * results directly when full rigor is required.
 */
export function stainRoomPosition(stain: Bloodstain, room?: Room): Point3D | null {
  const x = resolveAxis(
    stain.distanceFromLeftWall,
    stain.distanceFromRightWall,
    room?.width,
  );
  const y = resolveAxis(
    stain.distanceFromFrontWall,
    stain.distanceFromRearWall,
    room?.length,
  );
  const z = resolveAxis(
    stain.heightAboveFloor,
    stain.distanceFromCeiling,
    room?.height,
  );

  if (x === null && y === null && z === null) return null;

  return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
}
