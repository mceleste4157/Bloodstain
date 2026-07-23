/**
 * Case view / editor.
 *
 * Loads a case, keeps an editable working copy in local state, and runs the
 * scene analysis live over that copy so calculations and sketches update the
 * instant a measurement changes — before anything is saved. An explicit Save
 * writes the whole case back to Firestore; a dirty indicator shows unsaved work.
 *
 * Numeric measurements are entered in millimeters (the canonical unit) in this
 * section; unit-aware inputs arrive with the dedicated stain-documentation
 * module (docs/ROADMAP.md, Section 4). Derived values and sketch labels already
 * honor the case's metric/imperial setting.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Bloodstain, Case, SurfaceType, UnitSystem } from '@/types';
import { analyzeScene, formatLength } from '@/lib/calculations';
import { deleteCase, updateCase } from '@/lib/firebase/cases';
import { useCase } from '@/hooks/useCases';
import { TopView } from '@/components/sketch/TopView';
import { WallElevation, type WallId } from '@/components/sketch/WallElevation';
import { Button, Card, Field, Spinner, TextInput } from '@/components/ui';

const SURFACES: SurfaceType[] = [
  'floor',
  'ceiling',
  'north-wall',
  'south-wall',
  'east-wall',
  'west-wall',
  'furniture',
  'other',
];

export default function CaseView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { kase, loading, error } = useCase(id);

  // Editable working copy, seeded from the loaded case.
  const [draft, setDraft] = useState<Case | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wall, setWall] = useState<WallId>('north');

  // Seed the draft once the case loads (and when a different case is opened).
  useEffect(() => {
    if (kase && (!draft || draft.id !== kase.id)) {
      setDraft(kase);
      setDirty(false);
    }
  }, [kase, draft]);

  const analysis = useMemo(
    () => (draft ? analyzeScene(draft.stains, draft.room) : null),
    [draft],
  );

  if (loading || !draft) {
    return (
      <Card>
        {error ? (
          <p className="text-sm text-red-400">Could not load case: {error}</p>
        ) : (
          <Spinner label="Loading case…" />
        )}
      </Card>
    );
  }

  function patch(updates: Partial<Case>) {
    setDraft((d) => (d ? { ...d, ...updates } : d));
    setDirty(true);
  }

  function patchStain(stainId: string, updates: Partial<Bloodstain>) {
    setDraft((d) =>
      d
        ? { ...d, stains: d.stains.map((s) => (s.id === stainId ? { ...s, ...updates } : s)) }
        : d,
    );
    setDirty(true);
  }

  function addStain() {
    const n = draft!.stains.length + 1;
    const stain: Bloodstain = {
      id: `stain-${Date.now()}`,
      stainId: `BS-${String(n).padStart(3, '0')}`,
      surface: 'floor',
      width: 5,
      length: 10,
      directionality: 0,
      distanceFromLeftWall: 0,
      distanceFromFrontWall: 0,
      heightAboveFloor: 0,
    };
    patch({ stains: [...draft!.stains, stain] });
  }

  function removeStain(stainId: string) {
    patch({ stains: draft!.stains.filter((s) => s.id !== stainId) });
  }

  async function save() {
    if (!id || !draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateCase(id, draft);
      setDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm(`Delete case ${draft!.caseNumber}? This cannot be undone.`)) return;
    try {
      await deleteCase(id);
      navigate('/');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not delete.');
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header / actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-brand-300">
            ← Dashboard
          </button>
          <h1 className="text-xl font-semibold">{draft.caseNumber || 'Untitled case'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>
      {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}

      {/* Case details */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Case information
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Case number">
            <TextInput value={draft.caseNumber} onChange={(e) => patch({ caseNumber: e.target.value })} />
          </Field>
          <Field label="Agency">
            <TextInput value={draft.agency ?? ''} onChange={(e) => patch({ agency: e.target.value })} />
          </Field>
          <Field label="Investigator">
            <TextInput
              value={draft.investigator ?? ''}
              onChange={(e) => patch({ investigator: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={draft.date ?? ''} onChange={(e) => patch({ date: e.target.value })} />
          </Field>
          <Field label="Location">
            <TextInput value={draft.location ?? ''} onChange={(e) => patch({ location: e.target.value })} />
          </Field>
          <Field label="Units">
            <select
              value={draft.unitSystem}
              onChange={(e) => patch({ unitSystem: e.target.value as UnitSystem })}
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
            >
              <option value="metric">Metric (cm)</option>
              <option value="imperial">Imperial (in)</option>
            </select>
          </Field>
          <Field label="Victim">
            <TextInput
              value={draft.victim?.name ?? ''}
              onChange={(e) => patch({ victim: { ...draft.victim, name: e.target.value } })}
            />
          </Field>
          <Field label="Suspect">
            <TextInput
              value={draft.suspect?.name ?? ''}
              onChange={(e) => patch({ suspect: { ...draft.suspect, name: e.target.value } })}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>
      </Card>

      {/* Room */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Room dimensions (mm)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Width (left→right)"
            value={draft.room?.width}
            onChange={(v) => patch({ room: { ...roomOf(draft), width: v ?? 0 } })}
          />
          <NumberField
            label="Length (front→rear)"
            value={draft.room?.length}
            onChange={(v) => patch({ room: { ...roomOf(draft), length: v ?? 0 } })}
          />
          <NumberField
            label="Height (floor→ceiling)"
            value={draft.room?.height}
            onChange={(v) => patch({ room: { ...roomOf(draft), height: v ?? 0 } })}
          />
        </div>
      </Card>

      {/* Stains */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Bloodstains ({draft.stains.length})
          </h2>
          <Button variant="secondary" onClick={addStain}>
            + Add stain
          </Button>
        </div>

        {draft.stains.length === 0 ? (
          <p className="text-sm text-slate-400">No stains documented yet.</p>
        ) : (
          <div className="space-y-3">
            {draft.stains.map((stain) => {
              const calc = analysis?.stainResults[stain.id];
              return (
                <div key={stain.id} className="rounded-lg border border-surface-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      value={stain.stainId}
                      onChange={(e) => patchStain(stain.id, { stainId: e.target.value })}
                      className="w-28 rounded bg-surface px-2 py-1 text-sm font-semibold text-brand-300 focus:outline-none"
                    />
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>
                        W:L {Number.isFinite(calc?.widthToLengthRatio ?? NaN)
                          ? calc!.widthToLengthRatio.toFixed(3)
                          : '—'}
                      </span>
                      <span>
                        Angle{' '}
                        {calc?.impactAngleDeg == null ? (
                          <span className="text-amber-400">check</span>
                        ) : (
                          `${calc.impactAngleDeg.toFixed(1)}°`
                        )}
                      </span>
                      <button
                        onClick={() => removeStain(stain.id)}
                        className="text-red-400 hover:text-red-300"
                        aria-label={`Remove ${stain.stainId}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    <Field label="Surface">
                      <select
                        value={stain.surface}
                        onChange={(e) => patchStain(stain.id, { surface: e.target.value as SurfaceType })}
                        className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
                      >
                        {SURFACES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <NumberField
                      label="Width (mm)"
                      value={stain.width}
                      onChange={(v) => patchStain(stain.id, { width: v ?? 0 })}
                    />
                    <NumberField
                      label="Length (mm)"
                      value={stain.length}
                      onChange={(v) => patchStain(stain.id, { length: v ?? 0 })}
                    />
                    <NumberField
                      label="Directionality (°)"
                      value={stain.directionality}
                      onChange={(v) => patchStain(stain.id, { directionality: v })}
                    />
                    <NumberField
                      label="From left wall (mm)"
                      value={stain.distanceFromLeftWall}
                      onChange={(v) => patchStain(stain.id, { distanceFromLeftWall: v })}
                    />
                    <NumberField
                      label="From front wall (mm)"
                      value={stain.distanceFromFrontWall}
                      onChange={(v) => patchStain(stain.id, { distanceFromFrontWall: v })}
                    />
                    <NumberField
                      label="Height above floor (mm)"
                      value={stain.heightAboveFloor}
                      onChange={(v) => patchStain(stain.id, { heightAboveFloor: v })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Analysis summary */}
      {analysis ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryStat
            label="Area of convergence"
            value={
              analysis.convergence
                ? `(${analysis.convergence.point.x.toFixed(0)}, ${analysis.convergence.point.y.toFixed(0)}) mm`
                : 'Insufficient data'
            }
            sub={
              analysis.convergence
                ? `${analysis.convergence.lineCount} stains · RMS ${analysis.convergence.rmsError.toFixed(0)} mm`
                : undefined
            }
          />
          <SummaryStat
            label="Est. origin height"
            value={analysis.origin ? formatLength(analysis.origin.meanHeight, draft.unitSystem) : '—'}
            sub={
              analysis.origin
                ? `± ${formatLength(analysis.origin.heightStdDev, draft.unitSystem)} (1σ)`
                : undefined
            }
          />
          <SummaryStat
            label="Excluded stains"
            value={String(analysis.excludedStainIds.length)}
            sub={analysis.excludedStainIds.length ? 'Need angle + directionality' : 'none'}
          />
        </section>
      ) : null}

      {/* Sketches */}
      {draft.room && analysis ? (
        <>
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Top view (floor plan)
            </h2>
            <div className="overflow-x-auto">
              <TopView
                room={draft.room}
                stains={draft.stains}
                analysis={analysis}
                unitSystem={draft.unitSystem}
                width={820}
                height={600}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Wall elevation
              </h2>
              <select
                value={wall}
                onChange={(e) => setWall(e.target.value as WallId)}
                className="rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="north">North wall</option>
                <option value="south">South wall</option>
                <option value="east">East wall</option>
                <option value="west">West wall</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <WallElevation
                room={draft.room}
                stains={draft.stains}
                analysis={analysis}
                unitSystem={draft.unitSystem}
                wall={wall}
                width={820}
                height={420}
              />
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function roomOf(kase: Case) {
  return kase.room ?? { width: 4000, length: 3000, height: 2600 };
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-brand-300">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-400">{sub}</div> : null}
    </Card>
  );
}

/** Numeric input that maps blank → undefined and rejects non-numbers. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <Field label={label}>
      <TextInput
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </Field>
  );
}
