import { describe, expect, it } from 'vitest';
import { fitTransform, niceScaleBarMm, project, scaleLength } from './viewport';

describe('fitTransform', () => {
  it('fits a room into the canvas preserving aspect ratio and centering', () => {
    // 1000×1000 mm room into an 840×440 canvas with 20px margins.
    // Available 800×400 → limited by height → scale 400/1000 = 0.4.
    const t = fitTransform({ width: 1000, height: 1000 }, { width: 840, height: 440 }, 20);
    expect(t.scale).toBeCloseTo(0.4);
    // Scaled drawing is 400×400; centered → offsetX (840-400)/2, offsetY (440-400)/2.
    expect(t.offsetX).toBeCloseTo(220);
    expect(t.offsetY).toBeCloseTo(20);
  });

  it('projects room points into canvas space', () => {
    const t = fitTransform({ width: 1000, height: 1000 }, { width: 840, height: 440 }, 20);
    // Room origin maps to the top-left of the centered drawing.
    expect(project(t, { x: 0, y: 0 })).toEqual({ x: 220, y: 20 });
    // Far corner maps to bottom-right of the drawing.
    const corner = project(t, { x: 1000, y: 1000 });
    expect(corner.x).toBeCloseTo(620);
    expect(corner.y).toBeCloseTo(420);
  });

  it('scales lengths by pixels-per-mm', () => {
    const t = fitTransform({ width: 1000, height: 1000 }, { width: 840, height: 440 }, 20);
    expect(scaleLength(t, 500)).toBeCloseTo(200);
  });

  it('never divides by zero for a degenerate room', () => {
    const t = fitTransform({ width: 0, height: 0 }, { width: 100, height: 100 });
    expect(Number.isFinite(t.scale)).toBe(true);
    expect(t.scale).toBeGreaterThan(0);
  });
});

describe('niceScaleBarMm', () => {
  it('picks a round 1/2/5×10ⁿ length near the target width', () => {
    // scale 0.4 px/mm, target 120px → rawMm 300 → nice value 200.
    const t = fitTransform({ width: 1000, height: 1000 }, { width: 840, height: 440 }, 20);
    expect(niceScaleBarMm(t, 120)).toBe(200);
  });
});
