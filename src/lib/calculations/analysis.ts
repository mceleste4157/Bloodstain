/**
 * Scene-level analysis orchestration.
 *
 * Ties the primitives together for a whole case. Stains are partitioned into
 * pattern **groups** (via `Bloodstain.group`); each group is reconstructed
 * independently — its own area of convergence and area of origin — because
 * mixing stains from unrelated impact patterns would produce a meaningless
 * "origin". Per-stain derived values are computed for every stain regardless of
 * grouping.
 *
 * This is the single function the UI, sketch generator, and PDF report call to
 * get a consistent, fully-derived picture of a scene. It performs no I/O and
 * mutates nothing, so it is trivially testable and safe to run on every edit.
 */

import type { Bloodstain, Room, StainCalculations } from '@/types';
import { impactAngleDeg } from './angle';
import { areaOfConvergence, type ConvergenceResult, type DirectionalityLine } from './convergence';
import { areaOfOrigin, type AreaOfOriginResult, type OriginInputStain } from './origin';
import { calculateStain } from './stain';

/** The reconstruction results for a single pattern group. */
export interface GroupAnalysis {
  /** Group key ('' for the implicit ungrouped set). */
  key: string;
  /** Display label ("Ungrouped" when the key is empty). */
  label: string;
  /** Ids of every stain assigned to this group. */
  memberStainIds: string[];
  /** Area of convergence for this group, or null if not derivable. */
  convergence: ConvergenceResult | null;
  /** Reconstructed 3D area of origin for this group, or null. */
  origin: AreaOfOriginResult | null;
  /** Members that couldn't contribute (missing angle or directionality). */
  excludedStainIds: string[];
}

export interface SceneAnalysis {
  /** Per-stain derived values, keyed by stain id. */
  stainResults: Record<string, StainCalculations>;
  /** One entry per pattern group present in the scene. */
  groups: GroupAnalysis[];
}

/** Normalize a stain's group key (trimmed; empty means ungrouped). */
export function groupKeyOf(stain: Bloodstain): string {
  return (stain.group ?? '').trim();
}

function groupLabel(key: string): string {
  return key === '' ? 'Ungrouped' : key;
}

/**
 * Analyze an entire scene, grouped by pattern.
 *
 * A stain contributes to its group's convergence/origin reconstruction only
 * when it has a resolvable top-view position, a valid impact angle, and a
 * directionality bearing. Non-contributing members are reported per group in
 * `excludedStainIds`.
 */
export function analyzeScene(stains: Bloodstain[], room?: Room): SceneAnalysis {
  const stainResults: Record<string, StainCalculations> = {};

  // Partition stains by group, preserving first-seen order.
  const order: string[] = [];
  const byGroup = new Map<string, Bloodstain[]>();
  for (const stain of stains) {
    stainResults[stain.id] = calculateStain(stain, room);
    const key = groupKeyOf(stain);
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push(stain);
  }

  const groups: GroupAnalysis[] = order.map((key) => {
    const members = byGroup.get(key)!;
    const lines: DirectionalityLine[] = [];
    const originInputs: OriginInputStain[] = [];
    const excludedStainIds: string[] = [];

    for (const stain of members) {
      const angle = impactAngleDeg(stain.width, stain.length);
      const position = stainResults[stain.id].position;
      const hasBearing = typeof stain.directionality === 'number';

      if (position && angle !== null && hasBearing) {
        const planePosition = { x: position.x, y: position.y };
        lines.push({ position: planePosition, bearingDeg: stain.directionality as number });
        originInputs.push({ id: stain.id, position: planePosition, impactAngleDeg: angle });
      } else {
        excludedStainIds.push(stain.id);
      }
    }

    const convergence = areaOfConvergence(lines);
    const origin = convergence ? areaOfOrigin(originInputs, convergence.point) : null;

    return {
      key,
      label: groupLabel(key),
      memberStainIds: members.map((s) => s.id),
      convergence,
      origin,
      excludedStainIds,
    };
  });

  return { stainResults, groups };
}

/** All group keys → analysis, for quick lookup by a stain's group. */
export function groupOf(analysis: SceneAnalysis, key: string): GroupAnalysis | undefined {
  return analysis.groups.find((g) => g.key === key);
}
