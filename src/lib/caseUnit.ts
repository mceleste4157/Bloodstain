/**
 * Resolve the unit used for a case's room dimensions and wall-relative
 * distances. Stain shape measurements (width/length/diameter) are always in
 * millimeters and never use this.
 *
 * Falls back for older cases that predate `roomUnit`: imperial → feet, metric →
 * centimeters.
 */

import type { Case, LengthUnit } from '@/types';

export function caseRoomUnit(kase: Pick<Case, 'roomUnit' | 'unitSystem'>): LengthUnit {
  return kase.roomUnit ?? (kase.unitSystem === 'imperial' ? 'ft' : 'cm');
}

/** Options offered in the room-unit selector, most common first. */
export const ROOM_UNIT_OPTIONS: Array<{ value: LengthUnit; label: string }> = [
  { value: 'ft', label: 'Feet (ft)' },
  { value: 'in', label: 'Inches (in)' },
  { value: 'cm', label: 'Centimeters (cm)' },
  { value: 'm', label: 'Meters (m)' },
];
