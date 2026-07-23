# Bloodstain Pattern Analysis Assistant (BPA Assistant)

A modern, responsive web application for forensic investigators to document,
measure, visualize, and report bloodstain evidence at crime scenes. Built to
reduce calculation errors, auto-generate professional sketches, and produce
court-ready documentation — for desktop, tablet, and mobile.

> **Status:** Under construction in manageable sections. **Section 1 —
> Calculations & Automatic Sketch — is complete.** See
> [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next and
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it fits together.

## What works today

- **Forensic calculations** (pure, unit-tested): width-to-length ratio, impact
  angle (`α = arcsin(w/l)`), wall-relative → room coordinate mapping with
  redundant-measurement reconciliation, least-squares **area of convergence**,
  tangent-method **area of origin** with per-stain stringing and an honest
  height-uncertainty (1σ), and unit conversion (metric ⇄ imperial).
- **Automatic sketches** that redraw instantly from measurements: **Top View**
  floor plan (room, walls, doors, windows, furniture, stains, directionality
  lines, convergence & origin markers, scale bar, north arrow) and **Wall
  Elevation** (wall to scale, stain heights, origin-height reference).
- A demo shell (`src/App.tsx`) running the full pipeline on a sample case.

## Tech stack

React + TypeScript · Vite · Tailwind CSS (dark law-enforcement theme) ·
Konva/react-konva · Firebase (Hosting/Auth/Firestore/Storage) · Vitest.
Planned: three.js (3D), jsPDF (reports), PWA.

## Develop

```bash
npm install
npm run dev        # start the dev server
npm test           # run the calculation + sketch unit tests (40 tests)
npm run typecheck  # type-check without emitting
npm run build      # production build → dist/
```

## Deploy (Firebase Hosting)

Hosting serves the production build from `dist/`:

```bash
npm run build
npx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
```

`firestore.rules` already enforces authenticated, per-owner access; the data
model carries `ownerUid`, roles, and an audit-log type so the security modules
(role-based permissions, audit log, CJIS posture) slot in without schema
changes.

## Project layout

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). In short: pure, tested
forensic math and sketch geometry in `src/lib`, a shared typed data model in
`src/types`, and thin React/Konva rendering in `src/components`.

The original plain-HTML Firebase demo remains under `public/` as a reference
for the Auth/Firestore wiring and is superseded by the React app once Section 2
lands.
