/**
 * Unit handling for the BPA Assistant.
 *
 * Design rule: every measurement is stored and computed in a single canonical
 * unit — millimeters (mm). Conversion happens only at the UI boundary when a
 * value is displayed or read from an input. This guarantees the forensic math
 * is never contaminated by mixed units, which is a classic source of error in
 * hand calculations.
 */

import type { LengthUnit, UnitSystem } from '@/types';

/** Millimeters per one of each supported unit. */
const MM_PER_UNIT: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

/** Convert a value expressed in `from` units into millimeters. */
export function toMm(value: number, from: LengthUnit): number {
  return value * MM_PER_UNIT[from];
}

/** Convert a value in millimeters into the requested unit. */
export function fromMm(valueMm: number, to: LengthUnit): number {
  return valueMm / MM_PER_UNIT[to];
}

/** Convert directly between any two length units. */
export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  return fromMm(toMm(value, from), to);
}

/** The default display unit for each measurement system. */
export function displayUnit(system: UnitSystem): LengthUnit {
  return system === 'metric' ? 'cm' : 'in';
}

/**
 * Format a canonical (mm) value in an explicit length unit, e.g. "12.3 ft".
 * Used where the display unit is chosen directly (room / distance units) rather
 * than derived from a metric/imperial system.
 */
export function formatInUnit(valueMm: number, unit: LengthUnit, fractionDigits = 1): string {
  return `${fromMm(valueMm, unit).toFixed(fractionDigits)} ${unit}`;
}

/**
 * Format a canonical (mm) value for display in the given system, rounding to a
 * sensible precision and appending the unit label. Used by the sketch labels
 * and report tables.
 */
export function formatLength(
  valueMm: number,
  system: UnitSystem,
  fractionDigits = 1,
): string {
  const unit = displayUnit(system);
  const converted = fromMm(valueMm, unit);
  return `${converted.toFixed(fractionDigits)} ${unit}`;
}

// --- Angle helpers (used throughout the trig-heavy calculations) ---

export const DEG_PER_RAD = 180 / Math.PI;

export function toRadians(deg: number): number {
  return deg / DEG_PER_RAD;
}

export function toDegrees(rad: number): number {
  return rad * DEG_PER_RAD;
}
