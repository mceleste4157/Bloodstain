import { describe, expect, it } from 'vitest';
import { areaOfConvergence, type DirectionalityLine } from './convergence';

describe('areaOfConvergence', () => {
  it('returns null with fewer than two lines', () => {
    expect(areaOfConvergence([])).toBeNull();
    expect(areaOfConvergence([{ position: { x: 0, y: 0 }, bearingDeg: 0 }])).toBeNull();
  });

  it('finds the intersection of two perpendicular axes', () => {
    // Vertical axis x = 10 (bearing 90°) and horizontal axis y = 10 (bearing 0°)
    const lines: DirectionalityLine[] = [
      { position: { x: 10, y: 0 }, bearingDeg: 90 },
      { position: { x: 0, y: 10 }, bearingDeg: 0 },
    ];
    const result = areaOfConvergence(lines)!;
    expect(result.point.x).toBeCloseTo(10);
    expect(result.point.y).toBeCloseTo(10);
    expect(result.rmsError).toBeCloseTo(0);
  });

  it('finds the common point of three concurrent lines with ~zero error', () => {
    const lines: DirectionalityLine[] = [
      { position: { x: 10, y: 0 }, bearingDeg: 90 }, // x = 10
      { position: { x: 0, y: 10 }, bearingDeg: 0 }, // y = 10
      { position: { x: 0, y: 0 }, bearingDeg: 45 }, // y = x
    ];
    const result = areaOfConvergence(lines)!;
    expect(result.point.x).toBeCloseTo(10);
    expect(result.point.y).toBeCloseTo(10);
    expect(result.rmsError).toBeCloseTo(0);
    expect(result.lineCount).toBe(3);
  });

  it('returns null for parallel lines', () => {
    const lines: DirectionalityLine[] = [
      { position: { x: 0, y: 0 }, bearingDeg: 0 },
      { position: { x: 0, y: 5 }, bearingDeg: 0 },
    ];
    expect(areaOfConvergence(lines)).toBeNull();
  });

  it('produces a non-zero RMS error for near-miss lines', () => {
    // Two lines that cross plus one offset parallel-ish line → imperfect fit.
    const lines: DirectionalityLine[] = [
      { position: { x: 10, y: 0 }, bearingDeg: 90 },
      { position: { x: 0, y: 10 }, bearingDeg: 0 },
      { position: { x: 5, y: 0 }, bearingDeg: 90 }, // x = 5, pulls the fit
    ];
    const result = areaOfConvergence(lines)!;
    expect(result.rmsError).toBeGreaterThan(0);
    // Best fit x is pulled between 10 and 5.
    expect(result.point.x).toBeGreaterThan(5);
    expect(result.point.x).toBeLessThan(10);
  });
});
