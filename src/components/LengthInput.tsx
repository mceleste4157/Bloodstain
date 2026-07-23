/**
 * Unit-aware length input.
 *
 * Investigators type in the case's display unit (cm or in) while the app stores
 * every measurement canonically in millimeters. This component owns a small
 * text buffer so typing stays smooth, converts on each edit, and re-syncs when
 * the unit system changes (e.g. the user flips metric↔imperial) so the shown
 * number tracks the stored value without clobbering in-progress typing.
 */

import { useEffect, useRef, useState } from 'react';
import type { UnitSystem } from '@/types';
import { displayUnit, fromMm, toMm } from '@/lib/calculations';
import { TextInput } from '@/components/ui';

interface LengthInputProps {
  /** Canonical value in millimeters, or undefined when empty. */
  valueMm: number | undefined;
  unitSystem: UnitSystem;
  onChangeMm: (mm: number | undefined) => void;
  /** Decimal places to show in the display unit. */
  precision?: number;
  placeholder?: string;
  id?: string;
}

function mmToText(valueMm: number | undefined, system: UnitSystem, precision: number): string {
  if (valueMm === undefined || Number.isNaN(valueMm)) return '';
  const converted = fromMm(valueMm, displayUnit(system));
  // Trim trailing zeros so "10.00" shows as "10".
  return String(Number(converted.toFixed(precision)));
}

export function LengthInput({
  valueMm,
  unitSystem,
  onChangeMm,
  precision = 2,
  placeholder,
  id,
}: LengthInputProps) {
  const [text, setText] = useState(() => mmToText(valueMm, unitSystem, precision));
  const lastUnit = useRef(unitSystem);

  // Re-sync the text buffer when the unit system changes, or when the stored
  // value changes from outside while this field isn't the one being edited.
  useEffect(() => {
    if (lastUnit.current !== unitSystem) {
      lastUnit.current = unitSystem;
      setText(mmToText(valueMm, unitSystem, precision));
      return;
    }
    // Only overwrite the buffer if the external value no longer matches what
    // the current text represents (avoids fighting the user mid-keystroke).
    const current = text.trim() === '' ? undefined : toMm(Number(text), displayUnit(unitSystem));
    const differs =
      (current === undefined) !== (valueMm === undefined) ||
      (current !== undefined && valueMm !== undefined && Math.abs(current - valueMm) > 1e-6);
    if (differs) setText(mmToText(valueMm, unitSystem, precision));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMm, unitSystem]);

  function handleChange(raw: string) {
    setText(raw);
    if (raw.trim() === '') {
      onChangeMm(undefined);
      return;
    }
    const n = Number(raw);
    if (!Number.isNaN(n)) onChangeMm(toMm(n, displayUnit(unitSystem)));
  }

  return (
    <TextInput
      id={id}
      type="number"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}
