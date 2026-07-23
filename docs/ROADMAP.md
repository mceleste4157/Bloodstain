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

## 🟡 Section 5 — Interactive sketch editor (partial)

- ✅ Drag stains on the top view with snap-to-grid; drops convert back to room
  coordinates and update wall distances live (`viewport.unproject`/`snapPoint`).
- ⬜ Resize objects, add/edit walls & furniture, rotate, undo/redo, zoom/pan.
- ⬜ Measurement tools: tape measure, coordinate entry, laser-distance entry.

## ✅ Section 6 — 3D scene (done)

- `three.js` (react-three-fiber + drei) scene: room, stains, and per-group
  trajectory (stringing) lines to the reconstructed area of origin; orbit/zoom/
  pan. Reuses `analyzeScene` — no new math. Lazy-loaded behind a toggle.

## 🟡 Section 7 — Photo module (upload/link done)

- ✅ Upload photos to Firebase Storage (per-owner path + rules), thumbnails,
  captions, link photos to stains (`CasePhoto.linkedStainIds`), delete, and
  embed photos in the PDF report.
- ⬜ On-photo annotations / measurement & evidence markers.

## ✅ Section 8 — Reports (jsPDF) (done)

- Court-ready PDF: case info, measurements, pattern breakdown, calculated
  results, per-stain stringing, embedded sketches (raster export of the Konva
  stages), calculation-methodology appendix, and a signature page. Lazy-loaded.
- ⬜ Still to add: evidence photos and the 3D image (pending those modules).

## 🟡 Section 9 — Security hardening & PWA (PWA + audit log done)

- ✅ PWA: manifest, service worker (autoUpdate), offline shell, home-screen
  install, app icons.
- ✅ Immutable audit log (`auditLog` collection + rules): records case
  created/deleted, report generated, and photo added/deleted; per-case Activity
  log shown in the case view.
- ⬜ Role-based permissions (`UserRole`), backups, encrypted-storage review.

## ✅ BPA domain features (added beyond the original plan)

- **Pattern classification** taxonomy (passive / spatter / transfer / altered,
  OSAC-aligned) on every stain, in the editor and the report.
- **Calculation methodology page** and PDF appendix — every derived value shown
  with its formula, substituted numbers, and result (court-defensible).
- **Decoupled units**: stain sizes always mm; room/distances in ft/in/cm/m.
- **In-app version badge** for deploy confirmation; **auto-deploy** via GitHub
  Actions.

## Section 10 — Future modules (design already accommodates)

AI-assisted classification & photo analysis, automatic stain detection, LiDAR /
FARO / laser-scanner import, 3D room reconstruction, voice notes, barcode/QR
evidence tracking, multi-user collaboration, offline sync. These attach to the
same `Case`/`Bloodstain` model and `analyzeScene` pipeline.

## Notes

- The original plain-HTML Firebase demo (formerly under `public/`) has been
  removed; Hosting serves the React build from `dist/`, and PWA assets live in
  `public-pwa/`.
- CI deploys Hosting only; the Firestore `cases` rule must be published once
  (Console → Firestore → Rules, or `firebase deploy --only firestore:rules`).
