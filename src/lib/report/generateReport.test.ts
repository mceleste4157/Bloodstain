import { describe, expect, it } from 'vitest';
import { analyzeScene } from '@/lib/calculations';
import { sampleCase } from '@/lib/sample';
import { generateReportDoc } from './generateReport';

describe('generateReportDoc', () => {
  const analysis = analyzeScene(sampleCase.stains, sampleCase.room);

  it('produces a multi-page PDF document', () => {
    const doc = generateReportDoc(sampleCase, analysis);
    // Case tables + stringing on page 1, plus the signature page.
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    const out = doc.output('datauristring');
    expect(out.startsWith('data:application/pdf')).toBe(true);
    // A real document, not an empty shell.
    expect(out.length).toBeGreaterThan(2000);
  });

  it('handles an empty case without throwing', () => {
    const empty = { ...sampleCase, stains: [], notes: undefined };
    const emptyAnalysis = analyzeScene(empty.stains, empty.room);
    expect(() => generateReportDoc(empty, emptyAnalysis)).not.toThrow();
  });
});
