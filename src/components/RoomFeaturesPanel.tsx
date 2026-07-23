/**
 * Room features editor: doors, windows, and furniture.
 *
 * These already render in the top-view sketch from the room model; this panel
 * lets investigators add and edit them. All spatial values are entered in the
 * case's room unit and stored canonically in millimeters. Changes flow up via
 * onChange so they participate in undo/redo and autosave like any other edit.
 */

import type { Furniture, LengthUnit, Room, RoomFixture } from '@/types';
import { SCENE_PRESETS } from '@/lib/bpa/sceneObjects';
import { LengthInput } from '@/components/LengthInput';
import { Button } from '@/components/ui';

interface Props {
  room: Room;
  unit: LengthUnit;
  onChange: (room: Room) => void;
}

const WALLS: RoomFixture['wall'][] = ['north', 'south', 'east', 'west'];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const selectCls =
  'min-h-[36px] rounded-lg border border-surface-border bg-surface px-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none';

export function RoomFeaturesPanel({ room, unit, onChange }: Props) {
  const doors = room.doors ?? [];
  const windows = room.windows ?? [];
  const furniture = room.furniture ?? [];

  const setDoors = (next: RoomFixture[]) => onChange({ ...room, doors: next });
  const setWindows = (next: RoomFixture[]) => onChange({ ...room, windows: next });
  const setFurniture = (next: Furniture[]) => onChange({ ...room, furniture: next });

  return (
    <div className="space-y-4">
      {/* Doors */}
      <FixtureSection
        title="Doors"
        unit={unit}
        items={doors}
        onChange={setDoors}
        makeNew={() => ({ id: newId('door'), wall: 'south', offset: 0, width: 900 })}
      />

      {/* Windows (with sill height) */}
      <FixtureSection
        title="Windows"
        unit={unit}
        items={windows}
        onChange={setWindows}
        withSill
        makeNew={() => ({ id: newId('win'), wall: 'north', offset: 0, width: 1000, sill: 900 })}
      />

      {/* Scene objects (furniture + body + fixtures) */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Scene items
        </h3>
        {/* Quick-add palette — drops the item at room center to be dragged. */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SCENE_PRESETS.map((preset) => (
            <button
              key={preset.kind}
              onClick={() =>
                setFurniture([
                  ...furniture,
                  {
                    id: newId('obj'),
                    kind: preset.kind,
                    label: preset.label,
                    width: preset.width,
                    depth: preset.depth,
                    position: {
                      x: Math.max(0, room.width / 2 - preset.width / 2),
                      y: Math.max(0, room.length / 2 - preset.depth / 2),
                    },
                  },
                ])
              }
              className="rounded border border-surface-border bg-surface px-2 py-1 text-xs text-slate-200 hover:border-brand-500/60"
            >
              + {preset.label}
            </button>
          ))}
        </div>
        {furniture.length === 0 ? (
          <p className="text-xs text-slate-500">No furniture.</p>
        ) : (
          <div className="space-y-2">
            {furniture.map((f) => (
              <div key={f.id} className="flex flex-wrap items-end gap-2 rounded border border-surface-border p-2">
                <LabeledInput label="Label">
                  <input
                    value={f.label}
                    onChange={(e) => setFurniture(furniture.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                    className="w-28 rounded bg-surface px-2 py-1 text-sm text-slate-100 focus:outline-none"
                  />
                </LabeledInput>
                <LabeledInput label={`X (${unit})`}>
                  <div className="w-24">
                    <LengthInput
                      valueMm={f.position.x}
                      unit={unit}
                      onChangeMm={(v) => setFurniture(furniture.map((x) => (x.id === f.id ? { ...x, position: { ...x.position, x: v ?? 0 } } : x)))}
                    />
                  </div>
                </LabeledInput>
                <LabeledInput label={`Y (${unit})`}>
                  <div className="w-24">
                    <LengthInput
                      valueMm={f.position.y}
                      unit={unit}
                      onChangeMm={(v) => setFurniture(furniture.map((x) => (x.id === f.id ? { ...x, position: { ...x.position, y: v ?? 0 } } : x)))}
                    />
                  </div>
                </LabeledInput>
                <LabeledInput label={`W (${unit})`}>
                  <div className="w-20">
                    <LengthInput
                      valueMm={f.width}
                      unit={unit}
                      onChangeMm={(v) => setFurniture(furniture.map((x) => (x.id === f.id ? { ...x, width: v ?? 0 } : x)))}
                    />
                  </div>
                </LabeledInput>
                <LabeledInput label={`D (${unit})`}>
                  <div className="w-20">
                    <LengthInput
                      valueMm={f.depth}
                      unit={unit}
                      onChangeMm={(v) => setFurniture(furniture.map((x) => (x.id === f.id ? { ...x, depth: v ?? 0 } : x)))}
                    />
                  </div>
                </LabeledInput>
                <button
                  onClick={() => setFurniture(furniture.filter((x) => x.id !== f.id))}
                  className="ml-auto text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FixtureSection({
  title,
  unit,
  items,
  onChange,
  makeNew,
  withSill = false,
}: {
  title: string;
  unit: LengthUnit;
  items: RoomFixture[];
  onChange: (next: RoomFixture[]) => void;
  makeNew: () => RoomFixture;
  withSill?: boolean;
}) {
  const update = (id: string, patch: Partial<RoomFixture>) =>
    onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        <Button variant="secondary" onClick={() => onChange([...items, makeNew()])}>
          + Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">None.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-end gap-2 rounded border border-surface-border p-2">
              <LabeledInput label="Wall">
                <select value={it.wall} onChange={(e) => update(it.id, { wall: e.target.value as RoomFixture['wall'] })} className={selectCls}>
                  {WALLS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </LabeledInput>
              <LabeledInput label={`Offset (${unit})`}>
                <div className="w-24">
                  <LengthInput valueMm={it.offset} unit={unit} onChangeMm={(v) => update(it.id, { offset: v ?? 0 })} />
                </div>
              </LabeledInput>
              <LabeledInput label={`Width (${unit})`}>
                <div className="w-24">
                  <LengthInput valueMm={it.width} unit={unit} onChangeMm={(v) => update(it.id, { width: v ?? 0 })} />
                </div>
              </LabeledInput>
              {withSill ? (
                <LabeledInput label={`Sill (${unit})`}>
                  <div className="w-24">
                    <LengthInput valueMm={it.sill} unit={unit} onChangeMm={(v) => update(it.id, { sill: v })} />
                  </div>
                </LabeledInput>
              ) : null}
              <button onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="ml-auto text-xs text-red-400 hover:text-red-300">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
