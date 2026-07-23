/**
 * Calculations / methodology page.
 *
 * A transparent, court-defensible view of exactly how every derived figure was
 * produced: the formula, the numbers substituted into it, and the result — for
 * each stain, the area of convergence, and the area of origin. Recomputed live
 * from the same analysis the rest of the app uses, so it can never disagree with
 * the sketches or the report.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { analyzeScene } from '@/lib/calculations';
import { buildMethodology, type MethodologySection } from '@/lib/bpa/methodology';
import { useCase } from '@/hooks/useCases';
import { Card, Spinner } from '@/components/ui';

export default function CalculationsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { kase, loading, error } = useCase(id);

  const sections = useMemo<MethodologySection[]>(
    () => (kase ? buildMethodology(kase, analyzeScene(kase.stains, kase.room)) : []),
    [kase],
  );

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading calculations…" />
      </Card>
    );
  }
  if (error || !kase) {
    return (
      <Card>
        <p className="text-sm text-red-400">{error || 'Case not found.'}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate(`/cases/${id}`)}
          className="text-sm text-slate-400 hover:text-brand-300"
        >
          ← Back to case
        </button>
        <h1 className="text-xl font-semibold">Calculation methodology</h1>
        <p className="text-sm text-slate-400">
          {kase.caseNumber} — every derived value, shown with its formula and inputs.
        </p>
      </div>

      {sections.map((section) => (
        <Card key={section.title}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-300">
            {section.title}
          </h2>
          {section.intro ? <p className="mt-1 text-sm text-slate-400">{section.intro}</p> : null}

          <div className="mt-3 space-y-3">
            {section.lines.map((line, i) => (
              <div key={i} className="rounded-md border border-surface-border/60 p-3">
                <div className="text-sm font-medium text-slate-200">{line.label}</div>
                {line.formula ? (
                  <div className="mt-1 font-mono text-xs text-slate-400">{line.formula}</div>
                ) : null}
                {line.substitution ? (
                  <div className="mt-1 font-mono text-xs text-slate-300">= {line.substitution}</div>
                ) : null}
                {line.result ? (
                  <div className="mt-1 font-mono text-sm font-semibold text-brand-200">
                    = {line.result}
                  </div>
                ) : null}
                {line.note ? <div className="mt-1 text-xs text-slate-500">{line.note}</div> : null}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
