/**
 * Sketch viewport math.
 *
 * The sketch generator draws in room coordinates (millimeters) but Konva draws
 * in screen pixels. This module computes a "fit" transform that maps a room's
 * bounding box into a canvas of a given size with a margin, preserving aspect
 * ratio. Keeping the transform as a pure, tested function means the visual
 * layer stays a thin renderer and the tricky coordinate math is verifiable.
 */

import type { Point2D } from '@/types';

export interface Size {
  width: number;
  height: number;
}

/**
 * A uniform scale + translation from room mm to canvas px:
 *
 *     px = mm * scale + offset
 *
 * `scale` is pixels-per-mm; `offset` centers the drawing within the canvas.
 */
export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Canvas size the transform was computed for (for scale bars, etc.). */
  canvas: Size;
}

/**
 * Fit a room of `roomSize` (mm) into `canvas` (px), leaving `margin` px on all
 * sides, preserving aspect ratio and centering the result.
 */
export function fitTransform(
  roomSize: Size,
  canvas: Size,
  margin = 40,
): ViewTransform {
  const availW = Math.max(1, canvas.width - margin * 2);
  const availH = Math.max(1, canvas.height - margin * 2);

  // Guard against zero-sized rooms so we never divide by zero.
  const roomW = roomSize.width > 0 ? roomSize.width : 1;
  const roomH = roomSize.height > 0 ? roomSize.height : 1;

  const scale = Math.min(availW / roomW, availH / roomH);

  // Center: leftover space split evenly around the scaled drawing.
  const offsetX = (canvas.width - roomW * scale) / 2;
  const offsetY = (canvas.height - roomH * scale) / 2;

  return { scale, offsetX, offsetY, canvas };
}

/** Map a room point (mm) to a canvas point (px) using the transform. */
export function project(t: ViewTransform, p: Point2D): Point2D {
  return { x: p.x * t.scale + t.offsetX, y: p.y * t.scale + t.offsetY };
}

/** Scale a length in mm to px (no translation). */
export function scaleLength(t: ViewTransform, lengthMm: number): number {
  return lengthMm * t.scale;
}

/**
 * Choose a "nice" round scale-bar length (in mm) that renders around
 * `targetPx` pixels wide — one of 1/2/5 × a power of ten.
 */
export function niceScaleBarMm(t: ViewTransform, targetPx = 120): number {
  const rawMm = targetPx / t.scale;
  const pow = Math.pow(10, Math.floor(Math.log10(rawMm)));
  const candidates = [1, 2, 5, 10].map((m) => m * pow);
  // Pick the largest candidate not exceeding rawMm, or the smallest overall.
  let best = candidates[0];
  for (const c of candidates) {
    if (c <= rawMm) best = c;
  }
  return best;
}
