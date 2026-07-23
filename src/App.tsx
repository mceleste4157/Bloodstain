import { useMemo } from 'react';
import { analyzeScene, formatLength } from '@/lib/calculations';
import { TopView } from '@/components/sketch/TopView';
import { WallElevation } from '@/components/sketch/WallElevation';
import { sampleCase } from '@/lib/sample';

/**
 * Demo shell for the calculations + sketch modules.
 *
 * This is intentionally a single page that exercises the two modules built in
 * this section end-to-end: it runs the scene analysis on the sample case and
 * renders the derived numbers alongside the auto-generated Top-View and Wall
 * Elevation sketches. The dashboard, auth, case editor, reports, and 3D view
 * (see docs/ROADMAP.md) will replace this shell in later sections.
 */
export default function App() {
  const kase = sampleCase;
  const analysis = useMemo(
    () => analyzeScene(kase.stains, kase.room),
    [kase.stains, kase.room],
  );

  return (
    <div className="min-h-full bg-surface text-slate-100">
      <header className="border-b border-surface-border bg-surface-raised">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 font-bold">
            BPA
          </div>
          <div>
            <h1 className="text-lg font-semibold">Bloodstain Pattern Analysis Assistant</h1>
            <p className="text-xs text-slate-400">
              Calculations &amp; automatic sketch — demo build
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <CaseSummary />

        <SceneSummary analysis={analysis} />

        <section className="rounded-lg border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Per-stain calculations
          </h2>
          <StainTable analysis={analysis} />
        </section>

        <section className="rounded-lg border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Top view (floor plan)
          </h2>
          <div className="overflow-x-auto">
            {kase.room ? (
              <TopView
                room={kase.room}
                stains={kase.stains}
                analysis={analysis}
                unitSystem={kase.unitSystem}
                width={860}
                height={620}
              />
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-surface-border bg-surface-raised p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Wall elevation — north wall
          </h2>
          <div className="overflow-x-auto">
            {kase.room ? (
              <WallElevation
                room={kase.room}
                stains={kase.stains}
                analysis={analysis}
                unitSystem={kase.unitSystem}
                wall="north"
                width={860}
                height={420}
              />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );

  function CaseSummary() {
    const items: Array<[string, string | undefined]> = [
      ['Case #', kase.caseNumber],
      ['Agency', kase.agency],
      ['Investigator', kase.investigator],
      ['Date', kase.date],
      ['Location', kase.location],
      ['Units', kase.unitSystem],
    ];
    return (
      <section className="grid grid-cols-2 gap-3 rounded-lg border border-surface-border bg-surface-raised p-4 sm:grid-cols-3 md:grid-cols-6">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
            <div className="truncate text-sm font-medium">{value ?? '—'}</div>
          </div>
        ))}
      </section>
    );
  }
}

function SceneSummary({ analysis }: { analysis: ReturnType<typeof analyzeScene> }) {
  const { convergence, origin } = analysis;
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <Stat
        label="Area of convergence"
        value={
          convergence
            ? `(${convergence.point.x.toFixed(0)}, ${convergence.point.y.toFixed(0)}) mm`
            : 'Insufficient data'
        }
        sub={convergence ? `${convergence.lineCount} stains · RMS ${convergence.rmsError.toFixed(0)} mm` : undefined}
      />
      <Stat
        label="Est. origin height"
        value={origin ? formatLength(origin.meanHeight, 'metric') : '—'}
        sub={origin ? `± ${formatLength(origin.heightStdDev, 'metric')} (1σ)` : undefined}
      />
      <Stat
        label="Excluded stains"
        value={String(analysis.excludedStainIds.length)}
        sub={analysis.excludedStainIds.join(', ') || 'none'}
      />
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-brand-300">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

function StainTable({ analysis }: { analysis: ReturnType<typeof analyzeScene> }) {
  const rows = Object.entries(analysis.stainResults);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr className="border-b border-surface-border">
            <th className="py-2 pr-4">Stain</th>
            <th className="py-2 pr-4">W:L ratio</th>
            <th className="py-2 pr-4">Impact angle</th>
            <th className="py-2 pr-4">Position (x, y, z) mm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, r]) => (
            <tr key={id} className="border-b border-surface-border/50">
              <td className="py-2 pr-4 font-medium">{id}</td>
              <td className="py-2 pr-4">{Number.isFinite(r.widthToLengthRatio) ? r.widthToLengthRatio.toFixed(3) : '—'}</td>
              <td className="py-2 pr-4">
                {r.impactAngleDeg === null ? (
                  <span className="text-amber-400">check measurement</span>
                ) : (
                  `${r.impactAngleDeg.toFixed(1)}°`
                )}
              </td>
              <td className="py-2 pr-4 tabular-nums text-slate-300">
                {r.position
                  ? `(${r.position.x.toFixed(0)}, ${r.position.y.toFixed(0)}, ${r.position.z.toFixed(0)})`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
