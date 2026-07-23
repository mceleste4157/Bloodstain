import { describe, expect, it } from 'vitest';
import { analyzeScene } from '@/lib/calculations';
import { sampleCase } from '@/lib/sample';
import { buildMethodology } from './methodology';

describe('buildMethodology', () => {
  const analysis = analyzeScene(sampleCase.stains, sampleCase.room);
  const sections = buildMethodology(sampleCase, analysis);

  it('includes conventions, every stain, convergence, and origin', () => {
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Conventions');
    expect(titles).toContain('Area of convergence');
    expect(titles).toContain('Area of origin (tangent method)');
    for (const stain of sampleCase.stains) {
      expect(titles).toContain(`Stain ${stain.stainId}`);
    }
  });

  it('shows the impact-angle derivation with substituted numbers', () => {
    const s1 = sections.find((s) => s.title === 'Stain BS-001')!;
    const angleLine = s1.lines.find((l) => l.label === 'Impact angle')!;
    expect(angleLine.formula).toBe('α = arcsin(W / L)');
    expect(angleLine.result).toContain('30.0°'); // width 5, length 10 → 30°
  });

  it('reports the least-squares convergence result for the sample scene', () => {
    const conv = sections.find((s) => s.title === 'Area of convergence')!;
    const resultLine = conv.lines.find((l) => l.result && l.result.includes('mm'));
    expect(resultLine).toBeTruthy();
  });

  it('explains why a stain is excluded when the angle is invalid', () => {
    const bad = {
      ...sampleCase,
      stains: [{ ...sampleCase.stains[0], width: 20, length: 10 }],
    };
    const secs = buildMethodology(bad, analyzeScene(bad.stains, bad.room));
    const angleLine = secs
      .find((s) => s.title === 'Stain BS-001')!
      .lines.find((l) => l.label === 'Impact angle')!;
    expect(angleLine.result).toContain('not computable');
  });
});
