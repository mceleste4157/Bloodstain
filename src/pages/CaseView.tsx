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
import { presetOf, SCENE_PRESETS } from '@/lib/bpa/sceneObjects';
import { fitTransform, unproject } from '@/lib/sketch/viewport';
import { caseRoomUnit, ROOM_UNIT_OPTIONS } from '@/lib/caseUnit';
import { canRedo, canUndo, initHistory, pushHistory, redo, undo, type History } from '@/lib/history';
import { deleteCase, updateCase } from '@/lib/firebase/cases';
import { deletePhotoObject, uploadPhoto } from '@/lib/firebase/photos';
import { logAudit } from '@/lib/firebase/audit';
import { useCase } from '@/hooks/useCases';
import { useAuditLog } from '@/hooks/useAuditLog';
import { LengthInput } from '@/components/LengthInput';
import { PhotosPanel } from '@/components/PhotosPanel';
import { RoomFeaturesPanel } from '@/components/RoomFeaturesPanel';
import { TopView } from '@/components/sketch/TopView';
import { WallElevation, type WallId } from '@/components/sketch/WallElevation';
import { Button, Card, Field, Spinner, TextInput } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Heavy (three.js) — only downloaded when the user opens the 3D scene.
const Scene3D = lazy(() => import('@/components/sketch/Scene3D'));

// Canvas sizes (must match the sketch props for drop-coordinate math).
const TOPVIEW_W = 820;
const TOPVIEW_H = 600;
const WALLVIEW_W = 820;
const WALLVIEW_H = 420;
const DND_MIME = 'application/x-bpa-object';
/** Sentinel dragged value for a new bloodstain (vs. a scene-object kind). */
const STAIN_DND = '__stain__';

const clampRange = (v: number, max: number) => Math.max(0, Math.min(max, v));

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

  // Editable working copy with undo/redo history, seeded from the loaded case.
  const [history, setHistory] = useState<History<Case> | null>(null);
  const draft = history?.present ?? null;
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wall, setWall] = useState<WallId>('north');
  const [snap, setSnap] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const floorplanInputRef = useRef<HTMLInputElement>(null);

  // Konva stage refs, used to rasterize the sketches into the PDF report.
  const topViewRef = useRef<Konva.Stage>(null);
  const elevationRef = useRef<Konva.Stage>(null);

  // Seed the draft once the case loads (and when a different case is opened).
  useEffect(() => {
    if (kase && (!history || history.present.id !== kase.id)) {
      setHistory(initHistory(kase));
      setDirty(false);
    }
  }, [kase, history]);

  // Keyboard undo/redo (Cmd/Ctrl+Z, add Shift to redo), except while typing in a
  // field where native input undo should win.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      e.preventDefault();
      setHistory((h) => (h ? (e.shiftKey ? redo(h) : undo(h)) : h));
      setDirty(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Delete/Backspace removes the selected scene item (unless typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!selectedFurnitureId) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      e.preventDefault();
      removeFurniture(selectedFurnitureId);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFurnitureId]);

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
  const undoable = !!history && canUndo(history);
  const redoable = !!history && canRedo(history);

  function doUndo() {
    setHistory((h) => (h ? undo(h) : h));
    setDirty(true);
  }
  function doRedo() {
    setHistory((h) => (h ? redo(h) : h));
    setDirty(true);
  }

  /** Record a new draft state (pushing the previous onto the undo stack). */
  function commit(update: (prev: Case) => Case) {
    setHistory((h) => (h ? pushHistory(h, update(h.present)) : h));
    setDirty(true);
  }

  function patch(updates: Partial<Case>) {
    commit((d) => ({ ...d, ...updates }));
  }

  function patchStain(stainId: string, updates: Partial<Bloodstain>) {
    commit((d) => ({
      ...d,
      stains: d.stains.map((s) => (s.id === stainId ? { ...s, ...updates } : s)),
    }));
  }

  function addStain() {
    commit((d) => {
      const n = d.stains.length + 1;
      // Inherit the previous stain's group so a run of stains for one pattern
      // all land together without re-typing the group each time.
      const lastGroup = d.stains[d.stains.length - 1]?.group;
      // Start blank so derived values (ratio, impact angle) read "check" until
      // the investigator enters real measurements — no misleading angle.
      const stain: Bloodstain = {
        id: `stain-${Date.now()}`,
        stainId: `BS-${String(n).padStart(3, '0')}`,
        surface: 'floor',
        group: lastGroup,
        width: 0,
        length: 0,
      };
      return { ...d, stains: [...d.stains, stain] };
    });
  }

  function removeStain(stainId: string) {
    commit((d) => ({ ...d, stains: d.stains.filter((s) => s.id !== stainId) }));
  }

  /** Reposition a stain from a drag on the top-view plan (x, y in room mm). */
  function moveStain(stainId: string, x: number, y: number) {
    commit((d) => {
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

  /** Add a scene item of `kind` centered at a room point (mm). */
  function addObjectAt(kind: string, roomX: number, roomY: number) {
    const preset = presetOf(kind) ?? SCENE_PRESETS[SCENE_PRESETS.length - 1];
    commit((d) => {
      const room = d.room ?? { width: 4000, length: 3000, height: 2600 };
      const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
      const obj = {
        id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: preset.kind,
        label: preset.label,
        width: preset.width,
        depth: preset.depth,
        position: {
          x: clamp(roomX - preset.width / 2, Math.max(0, room.width - preset.width)),
          y: clamp(roomY - preset.depth / 2, Math.max(0, room.length - preset.depth)),
        },
      };
      return { ...d, room: { ...room, furniture: [...(room.furniture ?? []), obj] } };
    });
  }

  /** Add a new floor bloodstain at a room point (mm), blank until measured. */
  function addStainAt(roomX: number, roomY: number) {
    commit((d) => {
      const n = d.stains.length + 1;
      const lastGroup = d.stains[d.stains.length - 1]?.group;
      const stain: Bloodstain = {
        id: `stain-${Date.now()}`,
        stainId: `BS-${String(n).padStart(3, '0')}`,
        surface: 'floor',
        group: lastGroup,
        width: 0,
        length: 0,
        distanceFromLeftWall: Math.round(roomX),
        distanceFromFrontWall: Math.round(roomY),
        heightAboveFloor: 0,
      };
      return { ...d, stains: [...d.stains, stain] };
    });
  }

  /** Add a stain on a wall at an along-wall distance and height (mm). */
  function addWallStainAt(wallId: WallId, alongWall: number, z: number) {
    commit((d) => {
      const n = d.stains.length + 1;
      const lastGroup = d.stains[d.stains.length - 1]?.group;
      const stain: Bloodstain = {
        id: `stain-${Date.now()}`,
        stainId: `BS-${String(n).padStart(3, '0')}`,
        surface: `${wallId}-wall`,
        group: lastGroup,
        width: 0,
        length: 0,
        heightAboveFloor: Math.round(z),
      };
      const a = Math.round(alongWall);
      if (wallId === 'north') {
        stain.distanceFromLeftWall = a;
        stain.distanceFromFrontWall = 0;
      } else if (wallId === 'south') {
        stain.distanceFromLeftWall = a;
        stain.distanceFromRearWall = 0;
      } else if (wallId === 'west') {
        stain.distanceFromFrontWall = a;
        stain.distanceFromLeftWall = 0;
      } else {
        stain.distanceFromFrontWall = a;
        stain.distanceFromRightWall = 0;
      }
      return { ...d, stains: [...d.stains, stain] };
    });
  }

  /** Handle a chip dropped onto the top-view plan (scene item or bloodstain). */
  function handlePlanDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const kind = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain');
    const room = draft?.room;
    if (!kind || !room) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Account for horizontal scroll of the (overflow-x-auto) plan container.
    const px = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const py = e.clientY - rect.top + e.currentTarget.scrollTop;
    const t = fitTransform(
      { width: room.width, height: room.length },
      { width: TOPVIEW_W, height: TOPVIEW_H },
    );
    const rp = unproject(t, { x: px, y: py });
    if (kind === STAIN_DND) {
      addStainAt(clampRange(rp.x, room.width), clampRange(rp.y, room.length));
    } else {
      addObjectAt(kind, rp.x, rp.y);
    }
  }

  /** Handle a bloodstain chip dropped onto the wall elevation. */
  function handleWallDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const kind = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain');
    const room = draft?.room;
    if (kind !== STAIN_DND || !room) return;
    const extent = wall === 'north' || wall === 'south' ? room.width : room.length;
    const t = fitTransform(
      { width: extent, height: room.height },
      { width: WALLVIEW_W, height: WALLVIEW_H },
    );
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const py = e.clientY - rect.top + e.currentTarget.scrollTop;
    const alongWall = (px - t.offsetX) / t.scale;
    const z = room.height - (py - t.offsetY) / t.scale;
    addWallStainAt(wall, clampRange(alongWall, extent), clampRange(z, room.height));
  }

  /** Resize/rotate a scene item from the plan transformer. */
  function transformFurniture(
    objId: string,
    next: { x: number; y: number; width: number; depth: number; rotation: number },
  ) {
    commit((d) => {
      if (!d.room?.furniture) return d;
      return {
        ...d,
        room: {
          ...d.room,
          furniture: d.room.furniture.map((f) =>
            f.id === objId
              ? {
                  ...f,
                  position: { x: Math.round(next.x), y: Math.round(next.y) },
                  width: Math.round(next.width),
                  depth: Math.round(next.depth),
                  rotation: Math.round(next.rotation),
                }
              : f,
          ),
        },
      };
    });
  }

  /** Upload a floor-plan diagram image and set it as the plan background. */
  async function handleFloorplanUpload(file: File | undefined) {
    if (!file || !id || !draft) return;
    setUploadingPlan(true);
    try {
      const photo = await uploadPhoto(file, draft.ownerUid, id);
      if (photo.url) patch({ floorplan: { storagePath: photo.storagePath, url: photo.url, opacity: 0.85 } });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Floor plan upload failed.');
    } finally {
      setUploadingPlan(false);
      if (floorplanInputRef.current) floorplanInputRef.current.value = '';
    }
  }

  async function removeFloorplan() {
    const fp = draft?.floorplan;
    if (fp) await deletePhotoObject(fp.storagePath);
    patch({ floorplan: undefined });
  }

  /** Remove a scene item from the room. */
  function removeFurniture(objId: string) {
    commit((d) =>
      d.room?.furniture
        ? { ...d, room: { ...d.room, furniture: d.room.furniture.filter((f) => f.id !== objId) } }
        : d,
    );
    setSelectedFurnitureId((cur) => (cur === objId ? null : cur));
  }

  /** Reposition a wall stain by dragging it on the elevation. */
  function moveWallStain(stainId: string, alongWall: number, z: number) {
    commit((d) => ({
      ...d,
      stains: d.stains.map((s) => {
        if (s.id !== stainId) return s;
        const next: Bloodstain = { ...s, heightAboveFloor: Math.round(z) };
        if (wall === 'north' || wall === 'south') next.distanceFromLeftWall = Math.round(alongWall);
        else next.distanceFromFrontWall = Math.round(alongWall);
        return next;
      }),
    }));
  }

  /** Reposition a scene item (furniture/body) from a drag on the plan. */
  function moveFurniture(objId: string, x: number, y: number) {
    commit((d) => {
      if (!d.room?.furniture) return d;
      return {
        ...d,
        room: {
          ...d.room,
          furniture: d.room.furniture.map((f) =>
            f.id === objId ? { ...f, position: { x, y } } : f,
          ),
        },
      };
    });
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
          <Button variant="ghost" onClick={doUndo} disabled={!undoable} title="Undo (Ctrl/Cmd+Z)">
            Undo
          </Button>
          <Button variant="ghost" onClick={doRedo} disabled={!redoable} title="Redo (Ctrl/Cmd+Shift+Z)">
            Redo
          </Button>
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
        {/* Floor-plan diagram upload */}
        <div className="mb-4 border-b border-surface-border pb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Floor plan diagram (optional)
          </h2>
          <input
            ref={floorplanInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFloorplanUpload(e.target.files?.[0])}
          />
          {draft.floorplan ? (
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={draft.floorplan.url}
                alt="Floor plan"
                className="h-16 w-24 rounded border border-surface-border object-cover"
              />
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Opacity
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={draft.floorplan.opacity ?? 0.85}
                  onChange={(e) =>
                    patch({ floorplan: { ...draft.floorplan!, opacity: Number(e.target.value) } })
                  }
                />
              </label>
              <Button variant="secondary" onClick={() => floorplanInputRef.current?.click()}>
                Replace
              </Button>
              <button onClick={() => void removeFloorplan()} className="text-xs text-red-400 hover:text-red-300">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => floorplanInputRef.current?.click()}
                disabled={uploadingPlan}
              >
                {uploadingPlan ? 'Uploading…' : 'Upload floor plan'}
              </Button>
              <span className="text-xs text-slate-500">
                Upload a diagram (e.g. from the property appraiser) to trace stains on — for
                non-rectangular rooms or whole layouts. Set the room size below to roughly match.
              </span>
            </div>
          )}
        </div>

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

        <div className="mt-4 border-t border-surface-border pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Doors, windows &amp; furniture
          </h3>
          <RoomFeaturesPanel
            room={roomOf(draft)}
            unit={roomUnit}
            onChange={(room) => patch({ room })}
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
              <div className="flex items-center gap-3 text-xs text-slate-300">
                {selectedFurnitureId ? (
                  <button
                    onClick={() => removeFurniture(selectedFurnitureId)}
                    className="rounded border border-red-800 px-2 py-1 text-red-300 hover:border-red-500"
                  >
                    Delete selected item
                  </button>
                ) : null}
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
                  Snap to grid
                </label>
              </div>
            </div>
            {/* Drag-and-drop palette: drag a chip onto the plan to place it. */}
            <div className="mb-2">
              <div className="mb-1 text-[11px] text-slate-500">
                Drag onto the plan to place — a bloodstain, or a scene item you then drag into
                position (placement is a reference, not to scale):
              </div>
              <div className="flex flex-wrap gap-1.5">
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_MIME, STAIN_DND);
                    e.dataTransfer.setData('text/plain', STAIN_DND);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="cursor-grab select-none rounded border border-red-800 bg-red-950/40 px-2 py-1 text-xs font-semibold text-red-300 hover:border-red-500 active:cursor-grabbing"
                  title="Drag a bloodstain onto the plan"
                >
                  🩸 Bloodstain
                </div>
                {SCENE_PRESETS.map((preset) => (
                  <div
                    key={preset.kind}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_MIME, preset.kind);
                      e.dataTransfer.setData('text/plain', preset.kind);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    className="cursor-grab select-none rounded border border-surface-border bg-surface px-2 py-1 text-xs text-slate-200 hover:border-brand-500/60 active:cursor-grabbing"
                    title={`Drag "${preset.label}" onto the plan`}
                  >
                    {preset.label}
                  </div>
                ))}
              </div>
            </div>
            <div
              className="inline-block overflow-x-auto"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handlePlanDrop}
            >
              <TopView
                stageRef={topViewRef}
                room={draft.room}
                stains={draft.stains}
                analysis={analysis}
                unit={roomUnit}
                width={TOPVIEW_W}
                height={TOPVIEW_H}
                snapMm={snap ? 25 : 0}
                onStainMove={moveStain}
                onFurnitureMove={moveFurniture}
                onFurnitureTransform={transformFurniture}
                selectedFurnitureId={selectedFurnitureId}
                onSelectFurniture={setSelectedFurnitureId}
                floorplanUrl={draft.floorplan?.url}
                floorplanOpacity={draft.floorplan?.opacity ?? 0.85}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Drag bloodstains and scene items to position them; click an item to resize or rotate
              it with the handles. All changes autosave.
            </p>
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
            <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
              <span>Drag a bloodstain onto the wall at its height:</span>
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_MIME, STAIN_DND);
                  e.dataTransfer.setData('text/plain', STAIN_DND);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="cursor-grab select-none rounded border border-red-800 bg-red-950/40 px-2 py-1 font-semibold text-red-300 hover:border-red-500 active:cursor-grabbing"
                title="Drag a bloodstain onto the wall"
              >
                🩸 Bloodstain
              </div>
            </div>
            <div
              className="inline-block overflow-x-auto"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handleWallDrop}
            >
              <WallElevation
                stageRef={elevationRef}
                room={draft.room}
                stains={draft.stains}
                analysis={analysis}
                unit={roomUnit}
                wall={wall}
                width={WALLVIEW_W}
                height={WALLVIEW_H}
                onWallStainMove={moveWallStain}
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
