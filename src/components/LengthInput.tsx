/**
 * Unit-aware length input.
 *
 * Investigators type in an explicit display unit (ft/in/cm/m for room and
 * distance measurements) while the app stores every value canonically in
 * millimeters. This component owns a small text buffer so typing stays smooth,
 * converts on each edit, and re-syncs when the unit changes so the shown number
 * tracks the stored value without clobbering in-progress typing.
 *
 * Stain shape measurements (width/length/diameter) are always in millimeters
 * and use a plain input, not this component.
 */

import { useEffect, useRef, useState } from 'react';
import type { LengthUnit } from '@/types';
import { fromMm, toMm } from '@/lib/calculations';
import { TextInput } from '@/components/ui';

interface LengthInputProps {
  /** Canonical value in millimeters, or undefined when empty. */
  valueMm: number | undefined;
  /** Display/entry unit. */
  unit: LengthUnit;
  onChangeMm: (mm: number | undefined) => void;
  /** Decimal places to show in the display unit. */
  precision?: number;
  placeholder?: string;
  id?: string;
}

function mmToText(valueMm: number | undefined, unit: LengthUnit, precision: number): string {
  if (valueMm === undefined || Number.isNaN(valueMm)) return '';
  const converted = fromMm(valueMm, unit);
  // Trim trailing zeros so "10.00" shows as "10".
  return String(Number(converted.toFixed(precision)));
}

export function LengthInput({
  valueMm,
  unit,
  onChangeMm,
  precision = 2,
  placeholder,
  id,
}: LengthInputProps) {
  const [text, setText] = useState(() => mmToText(valueMm, unit, precision));
  const lastUnit = useRef(unit);

  // Re-sync the text buffer when the unit changes, or when the stored value
  // changes from outside while this field isn't the one being edited.
  useEffect(() => {
    if (lastUnit.current !== unit) {
      lastUnit.current = unit;
      setText(mmToText(valueMm, unit, precision));
      return;
    }
    const current = text.trim() === '' ? undefined : toMm(Number(text), unit);
    const differs =
      (current === undefined) !== (valueMm === undefined) ||
      (current !== undefined && valueMm !== undefined && Math.abs(current - valueMm) > 1e-6);
    if (differs) setText(mmToText(valueMm, unit, precision));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMm, unit]);

  function handleChange(raw: string) {
    setText(raw);
    if (raw.trim() === '') {
      onChangeMm(undefined);
      return;
    }
    const n = Number(raw);
    if (!Number.isNaN(n)) onChangeMm(toMm(n, unit));
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
