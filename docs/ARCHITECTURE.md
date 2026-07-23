# BPA Assistant — Architecture

Bloodstain Pattern Analysis Assistant is a React + TypeScript Progressive Web
App for forensic bloodstain documentation, measurement, visualization, and
reporting. This document describes the structure that is in place today and the
seams the remaining modules plug into.

## Principles

1. **Canonical units.** Every measurement is stored and computed in
   millimeters. Conversion to metric/imperial happens only at the UI boundary
   (`src/lib/calculations/units.ts`). Mixed units never reach the math — the
   single biggest source of manual-calculation error.
2. **Derived values are never persisted as truth.** Ratios, angles,
   convergence, and origin are recomputed from raw measurements on every change
   (`analyzeScene`). A corrected measurement can never leave a stale number in a
   report.
3. **Pure core, thin edges.** All forensic math and sketch geometry are pure,
   unit-tested functions with no React or Firebase dependency. The visual and
   persistence layers are thin wrappers over that core, which keeps the science
   verifiable and portable (e.g. reusable server-side for PDF generation).
4. **Typed contract everywhere.** `src/types/index.ts` is the single source of
   truth for the data model, shared by calculations, sketches, Firestore, and
   reports.

## Layout

```
src/
  types/                     Domain model (Case, Bloodstain, Room, …)
  lib/
    calculations/            Forensic math (pure, fully unit-tested)
      units.ts               Unit system + length/angle conversion
      angle.ts               Width:length ratio, impact angle
      coordinates.ts         Wall-relative → room (x,y,z), distances
      convergence.ts         Least-squares area of convergence
      origin.ts              Tangent-method area of origin + stringing
      stain.ts               Per-stain derived values
      analysis.ts            Scene-level orchestration (analyzeScene)
      index.ts               Public barrel
    sketch/                  Sketch geometry (pure, tested)
      viewport.ts            Room-mm → canvas-px fit transform, scale bar
      theme.ts               Shared visual constants
    sample.ts                Demo/fixture case
  components/
    sketch/
      TopView.tsx            Auto floor-plan (react-konva)
      WallElevation.tsx      Auto wall elevation (react-konva)
  App.tsx                    Demo shell wiring calculations + sketches
  main.tsx                   Entry point
```

## The calculation pipeline

`analyzeScene(stains, room)` is the one function the UI, sketches, and reports
all call:

1. For each stain compute width:length ratio, impact angle
   `α = arcsin(width/length)`, and its `(x, y, z)` room position from the
   wall-relative measurements.
2. Build a directionality line per usable stain (needs a resolvable position, a
   valid impact angle, and a directionality bearing).
3. Solve the least-squares **area of convergence** on the top-view plane
   (normal equations from the perpendicular-projection matrices).
4. Reconstruct the 3D **area of origin** by the tangent method
   `z = d·tan(α)` per stain, reporting the mean height and its standard
   deviation as an honest uncertainty measure, plus per-stain stringing.

Stains that can't contribute are returned in `excludedStainIds` so the UI can
explain a reconstruction that used fewer stains than were documented.

## Sketch generation

Sketches are pure functions of `(room, stains, analysis, unitSystem)`, so they
redraw instantly on any change — satisfying the "automatic sketch updates"
requirement without imperative redraw code. `viewport.ts` computes an
aspect-preserving fit transform from room millimeters to canvas pixels; the
Konva components are declarative renderers over it. The same transform layer
will back the interactive editing tools (drag/resize/snap) and PDF raster
export.

## Rendering & platform

- **React 18 + TypeScript**, built with **Vite**.
- **Tailwind CSS**, dark law-enforcement theme with a blue accent
  (`tailwind.config.js`), large touch targets, responsive layout.
- **Konva / react-konva** for 2D sketching; **three.js** planned for the 3D
  scene (see roadmap).
- Production build (`npm run build`) emits to `dist/`, which **Firebase
  Hosting** serves (`firebase.json`).

## Testing

`npm test` runs Vitest over the pure core. The forensic math and sketch
geometry are covered with known-answer tests (e.g. 30°/45°/90° impact angles,
concurrent-line convergence, tangent-method heights, fit-transform projection).
UI/Konva components are validated by the production build and typecheck; visual
regression and interaction tests come with the editor module.

## Security & persistence (contract in place, wiring pending)

`firestore.rules` already enforces authenticated, per-owner access. The data
model includes `ownerUid`, roles (`UserRole`), and an `AuditLogEntry` type so
role-based permissions, audit logging, and CJIS-friendly (no anonymous access)
architecture can be implemented without reshaping the schema. See the roadmap
for sequencing.
