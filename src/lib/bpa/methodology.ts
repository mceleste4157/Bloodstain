/**
 * Calculation methodology / "show your work".
 *
 * Turns a case and its scene analysis into an ordered, human-readable
 * derivation: every formula, the numbers substituted into it, and the result.
 * This is what makes the tool defensible in court — nothing is a black box; a
 * reviewer can reproduce each figure by hand.
 *
 * The builder is pure and unit-tested, and is consumed by both the on-screen
 * Calculations page and (optionally) the PDF report. All lengths are expressed
 * in millimeters — the canonical unit the math runs in — and angles in degrees.
 */

import type { Bloodstain, Case, Room } from '@/types';
import type { SceneAnalysis } from '@/lib/calculations';
import { impactAngleDeg, resolveAxis, widthToLengthRatio } from '@/lib/calculations';

export interface MethodologyLine {
  label: string;
  /** Symbolic formula, e.g. "α = arcsin(W / L)". */
  formula?: string;
  /** The formula with the actual numbers substituted in. */
  substitution?: string;
  /** The computed result. */
  result?: string;
  /** An explanatory aside or caveat. */
  note?: string;
}

export interface MethodologySection {
  title: string;
  intro?: string;
  lines: MethodologyLine[];
}

const fmt = (n: number, digits = 1): string =>
  Number.isFinite(n) ? n.toFixed(digits) : '—';

/** Build the full ordered methodology for a case. */
export function buildMethodology(kase: Case, analysis: SceneAnalysis): MethodologySection[] {
  const sections: MethodologySection[] = [];

  sections.push({
    title: 'Conventions',
    intro:
      'All lengths are computed in millimeters (mm); angles are in degrees. ' +
      'Derived values are recomputed from the raw measurements every time an ' +
      'input changes, so no stale value can persist.',
    lines: [
      { label: 'Width-to-length ratio', formula: 'r = W / L' },
      { label: 'Impact angle', formula: 'α = arcsin(W / L)' },
      {
        label: 'Area of convergence',
        formula: 'minimize Σ (perpendicular distance from point to each stain axis)²',
        note: 'Solved as the least-squares intersection of the directionality lines.',
      },
      { label: 'Area of origin height', formula: 'z = d · tan(α)', note: 'd = horizontal distance from the stain to the convergence point.' },
      { label: 'String length', formula: 'L_string = √(d² + z²)' },
    ],
  });

  for (const stain of kase.stains) {
    sections.push(stainSection(stain, kase.room));
  }

  sections.push(convergenceSection(kase, analysis));
  sections.push(originSection(analysis));

  return sections;
}

function stainSection(stain: Bloodstain, room: Room | undefined): MethodologySection {
  const lines: MethodologyLine[] = [];
  const r = widthToLengthRatio(stain.width, stain.length);
  const angle = impactAngleDeg(stain.width, stain.length);

  lines.push({
    label: 'Width-to-length ratio',
    formula: 'r = W / L',
    substitution: `${fmt(stain.width, 2)} / ${fmt(stain.length, 2)}`,
    result: Number.isFinite(r) ? fmt(r, 3) : 'undefined (length ≤ 0)',
  });

  lines.push({
    label: 'Impact angle',
    formula: 'α = arcsin(W / L)',
    substitution: Number.isFinite(r) ? `arcsin(${fmt(r, 3)})` : '—',
    result: angle == null ? 'not computable — re-check the measurements (W must be ≤ L)' : `${fmt(angle, 1)}°`,
  });

  // Coordinate resolution per axis.
  const axes: Array<[string, number | undefined, number | undefined, number | undefined, string, string]> = [
    ['x (left ↔ right)', stain.distanceFromLeftWall, stain.distanceFromRightWall, room?.width, 'from left wall', 'width'],
    ['y (front ↔ rear)', stain.distanceFromFrontWall, stain.distanceFromRearWall, room?.length, 'from front wall', 'length'],
    ['z (floor ↔ ceiling)', stain.heightAboveFloor, stain.distanceFromCeiling, room?.height, 'height above floor', 'height'],
  ];
  for (const [label, near, far, span, nearName, spanName] of axes) {
    const resolved = resolveAxis(near, far, span);
    if (resolved === null) continue;
    let substitution: string;
    if (typeof near === 'number' && typeof far === 'number' && typeof span === 'number') {
      substitution = `mean(${fmt(near, 0)}, ${fmt(span, 0)} − ${fmt(far, 0)})`;
    } else if (typeof near === 'number') {
      substitution = `${nearName} = ${fmt(near, 0)}`;
    } else {
      substitution = `room ${spanName} − far wall = ${fmt(span ?? 0, 0)} − ${fmt(far ?? 0, 0)}`;
    }
    lines.push({ label: `Position ${label}`, substitution, result: `${fmt(resolved, 0)} mm` });
  }

  return { title: `Stain ${stain.stainId}`, lines };
}

function convergenceSection(kase: Case, analysis: SceneAnalysis): MethodologySection {
  const conv = analysis.convergence;
  const lines: MethodologyLine[] = [];

  const contributing = kase.stains.filter(
    (s) => !analysis.excludedStainIds.includes(s.id) && analysis.stainResults[s.id]?.position,
  );
  for (const s of contributing) {
    const p = analysis.stainResults[s.id].position!;
    lines.push({
      label: `${s.stainId} axis line`,
      substitution: `through (${fmt(p.x, 0)}, ${fmt(p.y, 0)}) at bearing ${fmt(s.directionality ?? 0, 0)}°`,
    });
  }

  if (conv) {
    lines.push({
      label: 'Least-squares convergence point',
      result: `(${fmt(conv.point.x, 0)}, ${fmt(conv.point.y, 0)}) mm`,
      note: `RMS perpendicular error ${fmt(conv.rmsError, 0)} mm across ${conv.lineCount} stains.`,
    });
  } else {
    lines.push({
      label: 'Convergence point',
      result: 'not determined',
      note: 'At least two stains with a valid impact angle and a directionality bearing are required.',
    });
  }

  return {
    title: 'Area of convergence',
    intro:
      'Each usable stain contributes a line through its top-view position along ' +
      'its directionality. The convergence point minimizes the total squared ' +
      'perpendicular distance to those lines (normal-equations least squares).',
    lines,
  };
}

function originSection(analysis: SceneAnalysis): MethodologySection {
  const origin = analysis.origin;
  const lines: MethodologyLine[] = [];

  if (origin) {
    for (const s of origin.strings) {
      lines.push({
        label: `${s.stainId} height`,
        formula: 'z = d · tan(α)',
        substitution: `${fmt(s.horizontalDistance, 0)} · tan(${fmt(s.elevationDeg, 1)}°)`,
        result: `${fmt(s.heightEstimate, 0)} mm  (string ${fmt(s.stringLength, 0)} mm, azimuth ${fmt(s.azimuthDeg, 0)}°)`,
      });
    }
    lines.push({
      label: 'Estimated origin height',
      formula: 'mean of the per-stain heights',
      result: `${fmt(origin.meanHeight, 0)} mm ± ${fmt(origin.heightStdDev, 0)} mm (1σ)`,
      note: 'The standard deviation is a direct measure of the reconstruction’s consistency.',
    });
  } else {
    lines.push({
      label: 'Area of origin',
      result: 'not determined',
      note: 'Requires a convergence point (see above).',
    });
  }

  return {
    title: 'Area of origin (tangent method)',
    intro:
      'For each stain a string runs from the stain back toward the source, ' +
      'rising out of the plane at the impact angle. The height each string ' +
      'implies is z = d · tan(α); the origin height is their mean.',
    lines,
  };
}
