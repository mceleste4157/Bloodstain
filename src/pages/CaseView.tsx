/**
 * Case view / editor.
 *
 * Loads a case, keeps an editable working copy in local state, and runs the
 * scene analysis live over that copy so calculations and sketches update the
 * instant a measurement changes — before anything is saved. An explicit Save
 * writes the whole case back to Firestore; a dirty indicator shows unsaved work.
 *
 * Stain shape measurements (width/length/diameter) are entered in millimeters;
 * room dimensions and wall-relative distances are entered in the case's chosen
 * room unit (ft/in/cm/m) and stored canonically in millimeters. Live validation
 * flags impossible or inconsistent measurements as they're typed.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type Konva from 'konva';
import type { Bloodstain, Case, LengthUnit, Room, StainCalculations, SurfaceType } from '@/types';
import { analyzeScene, axisDiscrepancy, formatInUnit } from '@/lib/calculations';
import { PATTERN_GROUPS } from '@/lib/bpa/patterns';
import { caseRoomUnit, ROOM_UNIT_OPTIONS } from '@/lib/caseUnit';
import { deleteCase, updateCase } from '@/lib/firebase/cases';
import { logAudit } from '@/lib/firebase/audit';
import { useCase } from '@/hooks/useCases';
import { useAuditLog } from '@/hooks/useAuditLog';
import { LengthInput } from '@/components/LengthInput';
import { PhotosPanel } from '@/components/PhotosPanel';
import { TopView } from '@/components/sketch/TopView';
import { WallElevation, type WallId } from '@/components/sketch/WallElevation';
import { Button, Card, Field, Spinner, TextInput } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Heavy (three.js) — only downloaded when the user opens the 3D scene.
const Scene3D = lazy(() => import('@/components/sketch/Scene3D'));

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
  const { entries: auditEntries } = useAuditLog(id);

  // Editable working copy, seeded from the loaded case.
  const [draft, setDraft] = useState<Case | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wall, setWall] = useState<WallId>('north');
  const [editSketch, setEditSketch] = useState(false);
  const [snap, setSnap] = useState(true);
  const [show3D, setShow3D] = useState(false);

  // Konva stage refs, used to rasterize the sketches into the PDF report.
  const topViewRef = useRef<Konva.Stage>(null);
  const elevationRef = useRef<Konva.Stage>(null);

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

  // Debounced autosave: persist ~900ms after the last edit. Each edit reschedules
  // the timer, so a burst of typing results in a single write.
  useEffect(() => {
    if (!dirty || saving || !id || !draft) return;
    const handle = setTimeout(() => void save(), 900);
    return () => clearTimeout(handle);
    // `save` is intentionally excluded; it is re-created each render and the
    // effect already re-runs on every dependency that changes the save payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, id, draft]);

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

  const roomUnit = caseRoomUnit(draft);
  const groupNames = Array.from(
    new Set(draft.stains.map((s) => (s.group ?? '').trim()).filter(Boolean)),
  );

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
    // Inherit the previous stain's group so a run of stains for one pattern all
    // land together without re-typing the group each time.
    const lastGroup = draft!.stains[draft!.stains.length - 1]?.group;
    // Start blank so derived values (ratio, impact angle) read "check" until the
    // investigator enters real measurements — no misleading placeholder angle.
    const stain: Bloodstain = {
      id: `stain-${Date.now()}`,
      stainId: `BS-${String(n).padStart(3, '0')}`,
      surface: 'floor',
      group: lastGroup,
      width: 0,
      length: 0,
    };
    patch({ stains: [...draft!.stains, stain] });
  }

  function removeStain(stainId: string) {
    patch({ stains: draft!.stains.filter((s) => s.id !== stainId) });
  }

  /** Reposition a stain from a drag on the top-view plan (x, y in room mm). */
  function moveStain(stainId: string, x: number, y: number) {
    setDraft((d) => {
      if (!d) return d;
      const width = d.room?.width;
      const length = d.room?.length;
      return {
        ...d,
        stains: d.stains.map((s) => {
          if (s.id !== stainId) return s;
          const next: Bloodstain = { ...s, distanceFromLeftWall: x, distanceFromFrontWall: y };
          // Keep any far-wall measurements consistent so no discrepancy warning
          // appears just from dragging.
          if (typeof s.distanceFromRightWall === 'number' && typeof width === 'number') {
            next.distanceFromRightWall = width - x;
          }
          if (typeof s.distanceFromRearWall === 'number' && typeof length === 'number') {
            next.distanceFromRearWall = length - y;
          }
          return next;
        }),
      };
    });
    setDirty(true);
  }

  async function save() {
    if (!id || !draft) return;
    setSaving(true);
    setSaveError(null);
    // Optimistically clear the dirty flag; edits made during the async write set
    // it true again and trigger a follow-up autosave. Restore it on failure.
    setDirty(false);
    try {
      await updateCase(id, draft);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save.');
      setDirty(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm(`Delete case ${draft!.caseNumber}? This cannot be undone.`)) return;
    try {
      void logAudit('case.deleted', id, { caseNumber: draft!.caseNumber });
      await deleteCase(id);
      navigate('/');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not delete.');
    }
  }

  async function handleReport() {
    if (!draft || !analysis) return;
    // Rasterize the currently-rendered sketches (2× for print sharpness).
    const topView = topViewRef.current?.toDataURL({ pixelRatio: 2 });
    const elevation = elevationRef.current?.toDataURL({ pixelRatio: 2 });

    // Fetch evidence photos as data URLs so they can be embedded in the PDF.
    const labelOf = new Map(draft.stains.map((s) => [s.id, s.stainId]));
    const { urlToDataUrl } = await import('@/lib/firebase/photos');
    const photos = (
      await Promise.all(
        (draft.photos ?? []).map(async (p) => {
          if (!p.url) return null;
          try {
            return {
              dataUrl: await urlToDataUrl(p.url),
              caption: p.caption,
              linkedLabels: (p.linkedStainIds ?? []).map((id) => labelOf.get(id) ?? id),
            };
          } catch {
            return null;
          }
        }),
      )
    ).filter((p): p is NonNullable<typeof p> => p !== null);

    // Lazy-load the PDF library so it stays out of the initial bundle.
    const { downloadReport } = await import('@/lib/report/generateReport');
    downloadReport(draft, analysis, {
      topView,
      elevation,
      elevationLabel: `Wall elevation — ${wall} wall`,
      photos,
    });
    if (id) void logAudit('report.generated', id, { photos: photos.length });
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
          <SaveStatus saving={saving} dirty={dirty} error={saveError} onRetry={save} />
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/cases/${id}/calculations`)}>
            Show calculations
          </Button>
          <Button variant="secondary" onClick={handleReport}>
            Generate PDF
          </Button>
        </div>
      </div>

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
          <Field label="Room / distance units" htmlFor="roomUnit" hint="Stain sizes are always in mm.">
            <select
              id="roomUnit"
              value={roomUnit}
              onChange={(e) => patch({ roomUnit: e.target.value as LengthUnit })}
              className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
            >
              {ROOM_UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
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
          Room dimensions ({roomUnit})
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={`Width, left→right (${roomUnit})`}>
            <LengthInput
              valueMm={draft.room?.width}
              unit={roomUnit}
              onChangeMm={(v) => patch({ room: { ...roomOf(draft), width: v ?? 0 } })}
            />
          </Field>
          <Field label={`Length, front→rear (${roomUnit})`}>
            <LengthInput
              valueMm={draft.room?.length}
              unit={roomUnit}
              onChangeMm={(v) => patch({ room: { ...roomOf(draft), length: v ?? 0 } })}
            />
          </Field>
          <Field label={`Height, floor→ceiling (${roomUnit})`}>
            <LengthInput
              valueMm={draft.room?.height}
              unit={roomUnit}
              onChangeMm={(v) => patch({ room: { ...roomOf(draft), height: v ?? 0 } })}
            />
          </Field>
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

        {/* Existing group names offered as autocomplete when assigning a group. */}
        <datalist id="stain-groups">
          {groupNames.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

        {draft.stains.length === 0 ? (
          <p className="text-sm text-slate-400">
            No stains documented yet. Add stains and assign them to the same group to reconstruct a
            pattern's area of convergence and origin.
          </p>
        ) : (
          <div className="space-y-3">
            {draft.stains.map((stain) => (
              <StainEditor
                key={stain.id}
                stain={stain}
                roomUnit={roomUnit}
                room={draft.room}
                calc={analysis?.stainResults[stain.id]}
                onChange={(u) => patchStain(stain.id, u)}
                onRemove={() => removeStain(stain.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Evidence photos */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Evidence photos
        </h2>
        <PhotosPanel
          photos={draft.photos ?? []}
          stains={draft.stains}
          ownerUid={draft.ownerUid}
          caseId={id ?? ''}
          onChange={(photos) => patch({ photos })}
        />
      </Card>

      {/* Analysis summary — one card per pattern group */}
      {analysis ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Reconstruction by pattern group
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.groups.map((group) => (
              <Card key={group.key || 'ungrouped'}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand-300">{group.label}</span>
                  <span className="text-xs text-slate-500">{group.memberStainIds.length} stains</span>
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Area of convergence</dt>
                    <dd className="tabular-nums">
                      {group.convergence
                        ? `(${group.convergence.point.x.toFixed(0)}, ${group.convergence.point.y.toFixed(0)}) mm`
                        : 'Insufficient data'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Est. origin height</dt>
                    <dd className="tabular-nums">
                      {group.origin
                        ? `${formatInUnit(group.origin.meanHeight, roomUnit)} ± ${formatInUnit(group.origin.heightStdDev, roomUnit)}`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">RMS / excluded</dt>
                    <dd className="tabular-nums text-slate-400">
                      {group.convergence ? `${group.convergence.rmsError.toFixed(0)} mm` : '—'} ·{' '}
                      {group.excludedStainIds.length} excl.
                    </dd>
                  </div>
                </dl>
                {group.convergence === null && group.memberStainIds.length < 2 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Add at least two stains (with impact angle + directionality) to this group to
                    reconstruct convergence and origin.
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* Sketches */}
      {draft.room && analysis ? (
        <>
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Top view (floor plan)
              </h2>
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editSketch}
                    onChange={(e) => setEditSketch(e.target.checked)}
                  />
                  Edit (drag stains)
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={snap}
                    disabled={!editSketch}
                    onChange={(e) => setSnap(e.target.checked)}
                  />
                  Snap to grid
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <TopView
                stageRef={topViewRef}
                room={draft.room}
                stains={draft.stains}
                analysis={analysis}
                unit={roomUnit}
                width={820}
                height={600}
                editable={editSketch}
                snapMm={snap ? 25 : 0}
                onStainMove={moveStain}
              />
            </div>
            {editSketch ? (
              <p className="mt-2 text-xs text-slate-500">
                Drag a stain to reposition it; its wall distances update live and autosave.
              </p>
            ) : null}
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
                stageRef={elevationRef}
                room={draft.room}
                stains={draft.stains}
                analysis={analysis}
                unit={roomUnit}
                wall={wall}
                width={820}
                height={420}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                3D scene
              </h2>
              <Button variant="secondary" onClick={() => setShow3D((v) => !v)}>
                {show3D ? 'Hide 3D' : 'Show 3D scene'}
              </Button>
            </div>
            {show3D ? (
              <ErrorBoundary
                fallback={
                  <p className="text-sm text-red-400">
                    The 3D view couldn't be displayed (WebGL may be unavailable on this device). The
                    2D sketches above show the same reconstruction.
                  </p>
                }
              >
                <Suspense
                  fallback={
                    <div className="flex h-[460px] items-center justify-center">
                      <Spinner label="Loading 3D…" />
                    </div>
                  }
                >
                  <Scene3D room={draft.room} stains={draft.stains} analysis={analysis} />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <p className="text-sm text-slate-400">
                An interactive 3D view of the room, stains, and each group's trajectory lines and
                area of origin. Drag to orbit, scroll to zoom.
              </p>
            )}
          </Card>
        </>
      ) : null}

      {/* Activity log (chain of custody) */}
      {auditEntries.length > 0 ? (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Activity log
          </h2>
          <ul className="space-y-1 text-sm">
            {auditEntries.slice(0, 20).map((e) => (
              <li key={e.id} className="flex justify-between gap-3 border-b border-surface-border/40 py-1">
                <span className="text-slate-200">{auditActionLabel(e.action)}</span>
                <span className="text-xs text-slate-500">
                  {new Date(e.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function roomOf(kase: Case) {
  return kase.room ?? { width: 4000, length: 3000, height: 2600 };
}

/** Human label for an audit action code. */
function auditActionLabel(action: string): string {
  switch (action) {
    case 'case.created':
      return 'Case created';
    case 'case.deleted':
      return 'Case deleted';
    case 'report.generated':
      return 'PDF report generated';
    case 'photo.added':
      return 'Evidence photo added';
    case 'photo.deleted':
      return 'Evidence photo deleted';
    default:
      return action;
  }
}

/** Compact autosave status: saving / saved / unsaved, plus retry on error. */
function SaveStatus({
  saving,
  dirty,
  error,
  onRetry,
}: {
  saving: boolean;
  dirty: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <button
        onClick={onRetry}
        className="text-xs text-red-400 hover:text-red-300"
        title={error}
      >
        ⚠ Save failed — retry
      </button>
    );
  }
  const label = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved';
  const dot = saving ? 'bg-amber-400' : dirty ? 'bg-slate-500' : 'bg-emerald-500';
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}


/** Discrepancy above which a redundant-measurement mismatch is flagged (mm). */
const DISCREPANCY_THRESHOLD_MM = 10;

/**
 * Editor for a single bloodstain: all documentation fields with unit-aware
 * inputs plus live validation warnings for physically impossible or mutually
 * inconsistent measurements.
 */
function StainEditor({
  stain,
  roomUnit,
  room,
  calc,
  onChange,
  onRemove,
}: {
  stain: Bloodstain;
  roomUnit: LengthUnit;
  room?: Room;
  calc?: StainCalculations;
  onChange: (updates: Partial<Bloodstain>) => void;
  onRemove: () => void;
}) {
  const warnings = stainWarnings(stain, room, roomUnit);

  function confirmRemove() {
    if (confirm(`Remove stain ${stain.stainId}? This cannot be undone.`)) onRemove();
  }

  return (
    <div className="rounded-lg border border-surface-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            value={stain.stainId}
            onChange={(e) => onChange({ stainId: e.target.value })}
            className="w-24 rounded bg-surface px-2 py-1 text-sm font-semibold text-brand-300 focus:outline-none"
            aria-label="Stain ID"
          />
          <input
            value={stain.group ?? ''}
            list="stain-groups"
            onChange={(e) => onChange({ group: e.target.value || undefined })}
            placeholder="Group / pattern"
            className="w-36 rounded bg-surface px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
            aria-label="Pattern group"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            W:L{' '}
            {Number.isFinite(calc?.widthToLengthRatio ?? NaN)
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
            onClick={confirmRemove}
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
            onChange={(e) => onChange({ surface: e.target.value as SurfaceType })}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
          >
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pattern type">
          <select
            value={stain.patternType ?? ''}
            onChange={(e) => onChange({ patternType: e.target.value || undefined })}
            className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface px-2 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
          >
            <option value="">— unclassified —</option>
            {PATTERN_GROUPS.map((group) => (
              <optgroup key={group.category} label={group.label}>
                {group.types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <MmField
          label="Width (mm)"
          value={stain.width}
          onChange={(v) => onChange({ width: v ?? 0 })}
        />
        <MmField
          label="Length (mm)"
          value={stain.length}
          onChange={(v) => onChange({ length: v ?? 0 })}
        />
        <MmField
          label="Diameter (mm)"
          value={stain.diameter}
          onChange={(v) => onChange({ diameter: v })}
        />
        <DegreeField
          label="Directionality (°)"
          value={stain.directionality}
          onChange={(v) => onChange({ directionality: v })}
          hint="Bearing the tail points back toward the source. 0°=right, 90°=up, CCW."
        />
        <Field label={`From left wall (${roomUnit})`}>
          <LengthInput
            valueMm={stain.distanceFromLeftWall}
            unit={roomUnit}
            onChangeMm={(v) => onChange({ distanceFromLeftWall: v })}
          />
        </Field>
        <Field label={`From right wall (${roomUnit})`}>
          <LengthInput
            valueMm={stain.distanceFromRightWall}
            unit={roomUnit}
            onChangeMm={(v) => onChange({ distanceFromRightWall: v })}
          />
        </Field>
        <Field label={`From front wall (${roomUnit})`}>
          <LengthInput
            valueMm={stain.distanceFromFrontWall}
            unit={roomUnit}
            onChangeMm={(v) => onChange({ distanceFromFrontWall: v })}
          />
        </Field>
        <Field label={`From rear wall (${roomUnit})`}>
          <LengthInput
            valueMm={stain.distanceFromRearWall}
            unit={roomUnit}
            onChangeMm={(v) => onChange({ distanceFromRearWall: v })}
          />
        </Field>
        <Field label={`Height above floor (${roomUnit})`}>
          <LengthInput
            valueMm={stain.heightAboveFloor}
            unit={roomUnit}
            onChangeMm={(v) => onChange({ heightAboveFloor: v })}
          />
        </Field>
        <Field label={`From ceiling (${roomUnit})`}>
          <LengthInput
            valueMm={stain.distanceFromCeiling}
            unit={roomUnit}
            onChangeMm={(v) => onChange({ distanceFromCeiling: v })}
          />
        </Field>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="Description">
          <TextInput
            value={stain.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>
        <Field label="Notes">
          <TextInput
            value={stain.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </Field>
      </div>

      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="rounded bg-amber-950/50 px-2 py-1 text-xs text-amber-300">
              ⚠ {w}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Validation messages for a stain's measurements: physically impossible shape
 * and redundant-measurement mismatches (a near-wall + far-wall distance that
 * don't agree with the room span, catching transcription errors).
 */
function stainWarnings(stain: Bloodstain, room: Room | undefined, unit: LengthUnit): string[] {
  const out: string[] = [];

  if (stain.width > 0 && stain.length > 0 && stain.width > stain.length) {
    out.push('Width exceeds length — the impact angle cannot be computed. Re-check the axes.');
  }

  const checks: Array<[string, number | null]> = [
    ['left/right wall', axisDiscrepancy(stain.distanceFromLeftWall, stain.distanceFromRightWall, room?.width)],
    ['front/rear wall', axisDiscrepancy(stain.distanceFromFrontWall, stain.distanceFromRearWall, room?.length)],
    ['floor/ceiling', axisDiscrepancy(stain.heightAboveFloor, stain.distanceFromCeiling, room?.height)],
  ];
  for (const [name, discrepancy] of checks) {
    if (discrepancy !== null && discrepancy > DISCREPANCY_THRESHOLD_MM) {
      out.push(`${name} measurements disagree by ${formatInUnit(discrepancy, unit)} — check the room size or the distances.`);
    }
  }

  return out;
}

/** A plain millimeter number input (blank → undefined). Stain sizes are mm. */
function MmField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return <DegreeField label={label} value={value} onChange={onChange} />;
}

/** Numeric input for raw values not subject to unit conversion (mm, degrees). */
function DegreeField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
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
