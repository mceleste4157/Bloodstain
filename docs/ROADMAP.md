# BPA Assistant — Build Roadmap

The app is being built in manageable sections. This tracks what is done and the
recommended order for the rest. Each section is designed to land independently
on top of the typed data model and pure calculation/sketch core.

## ✅ Section 1 — Calculations & Sketch core (this section)

- Project scaffold: Vite + React + TS + Tailwind, dark law-enforcement theme.
- Full domain model (`src/types`).
- **Calculations module** (pure, 35 unit tests): units & conversion, width:length
  ratio, impact angle, wall-relative → room coordinate mapping with redundant-
  measurement reconciliation, least-squares area of convergence, tangent-method
  area of origin + stringing, scene-level `analyzeScene` orchestration.
- **Sketch module** (5 unit tests + Konva components): fit-transform viewport,
  auto **Top View** (room, walls, doors, windows, furniture, stains,
  directionality lines, convergence/origin markers, scale bar, north arrow) and
  auto **Wall Elevation** (wall to scale, stain heights, origin-height
  reference).
- Demo shell (`App.tsx`) wiring it together on a sample case.

## ✅ Section 2 — Firebase & app frame (done)

- Typed Firebase service layer: `lib/firebase/config.ts` (Auth, Firestore,
  Storage), `auth.ts` (email/password + friendly error mapping), `cases.ts`
  (typed `cases` repository with live `onSnapshot` subscriptions).
- `AuthContext` + auth-gated router: login/sign-up screen, protected app shell,
  sign-out. No data without a signed-in user (CJIS-friendly).
- Case CRUD against Firestore with a per-owner security rule for `cases`;
  hooks `useCases` / `useCase` returning typed `Case` objects.
- App router: **Dashboard** (stats, create, client-side search, live case list)
  and **CaseView** (edit case info + room + stains, live analysis + sketches,
  save/delete). Reuses the Section-1 calculation and sketch modules unchanged.

> **One-time setup:** the `cases` security rule must be deployed before the app
> can read/write cases. CI deploys Hosting only (service-account permissions),
> so run once from an owner login:
> `npx firebase-tools deploy --only firestore:rules`.
> Also ensure Email/Password sign-in is enabled (Authentication → Sign-in
> method) — it already is for the legacy demo.

## Section 3 — Dashboard & case management

- Dashboard: active cases, recently opened, create new, search, statistics,
  recent reports.
- Search by case #, investigator, date, agency, location, victim (Firestore
  composite indexes; extend `firestore.indexes.json`).
- Case information form (all fields in the `Case` type) with validation and
  loading/empty/error states.

## Section 4 — Bloodstain documentation module

- Unlimited stains per case; add/edit/delete with live recomputation via
  `analyzeScene`.
- Form validation surfacing the calculation guards (e.g. width > length →
  "check measurement", axis discrepancy warnings from `axisDiscrepancy`).
- Metric/imperial toggle wired to `unitSystem`.

## Section 5 — Interactive sketch editor

- Drag stains, resize objects, add/edit walls & furniture, snap-to-grid,
  rotate, undo/redo, zoom, pan — all mutating the case model so calculations and
  the other views stay in sync (the `viewport.ts` transform already backs
  screen↔room mapping).
- Measurement tools: tape measure, coordinate entry, laser-distance entry,
  grid system.

## Section 6 — 3D scene

- `three.js` scene: room, stains, trajectory (stringing) lines from
  `areaOfOrigin`, estimated area of origin volume; orbit/zoom/rotate controls.
- Reuses `analyzeScene` output directly — no new math.

## Section 7 — Photo module

- Upload to Firebase Storage; tag stains, draw annotations, measurement/evidence
  markers; link photos to stains (`CasePhoto.linkedStainIds`).

## Section 8 — Reports (jsPDF)

- Court-ready PDF: case info, investigator, photos, stain measurements,
  calculations, sketches (raster export of the Konva stages), 3D image, tables,
  notes, signature page.

## Section 9 — Security hardening & PWA

- Role-based permissions (`UserRole`), audit log (`AuditLogEntry`) writes on
  mutations, tighter Firestore rules, backups, encrypted-storage review, CJIS
  posture (no anonymous access).
- PWA: manifest, service worker, offline cache, home-screen install.

## Section 10 — Future modules (design already accommodates)

AI-assisted classification & photo analysis, automatic stain detection, LiDAR /
FARO / laser-scanner import, 3D room reconstruction, voice notes, barcode/QR
evidence tracking, multi-user collaboration, offline sync. These attach to the
same `Case`/`Bloodstain` model and `analyzeScene` pipeline.

## Notes

- The original plain-HTML Firebase demo remains under `public/` as a reference
  for the Auth/Firestore wiring; Hosting now serves the React build from
  `dist/`. The demo files can be removed once Section 2 lands the auth flow in
  the React app.
