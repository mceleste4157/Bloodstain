/**
 * Dashboard — the landing page after sign-in.
 *
 * Shows quick statistics, a create-case control, a search box, and the user's
 * cases (newest first). Data streams live from Firestore via `useCases`, so a
 * case created here or edited elsewhere appears without a manual refresh.
 *
 * Search is currently client-side across the loaded cases; when case volumes
 * grow this becomes a Firestore query (see docs/ROADMAP.md, Section 3).
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Case } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useCases } from '@/hooks/useCases';
import { createCase, makeEmptyCase } from '@/lib/firebase/cases';
import { logAudit } from '@/lib/firebase/audit';
import { Button, Card, Spinner, TextInput } from '@/components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const { cases, loading, error } = useCases();
  const navigate = useNavigate();

  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const activeCount = cases.filter((c) => c.status !== 'archived').length;
  const stainCount = cases.reduce((sum, c) => sum + (c.stains?.length ?? 0), 0);

  const filtered = useMemo(() => filterCases(cases, search), [cases, search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const number = newCaseNumber.trim();
    if (!number) {
      setCreateError('Enter a case number.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createCase(makeEmptyCase(user.uid, number));
      void logAudit('case.created', id, { caseNumber: number });
      setNewCaseNumber('');
      navigate(`/cases/${id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the case.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active cases" value={activeCount} />
        <StatCard label="Total cases" value={cases.length} />
        <StatCard label="Documented stains" value={stainCount} />
        <StatCard label="Reports" value={0} hint="Coming soon" />
      </section>

      {/* Create + search */}
      <section className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Create new case
          </h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <TextInput
              value={newCaseNumber}
              onChange={(e) => setNewCaseNumber(e.target.value)}
              placeholder="Case number, e.g. 2026-BPA-0002"
              aria-label="New case number"
            />
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </form>
          {createError ? <p className="mt-2 text-sm text-red-400">{createError}</p> : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Search cases
          </h2>
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Case #, investigator, agency, location, victim…"
            aria-label="Search cases"
          />
        </Card>
      </section>

      {/* Case list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          {search ? `Results (${filtered.length})` : 'Recent cases'}
        </h2>

        {loading ? (
          <Card>
            <Spinner label="Loading cases…" />
          </Card>
        ) : error ? (
          <Card>
            <p className="text-sm text-red-400">Could not load cases: {error}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">
              {cases.length === 0
                ? 'No cases yet. Create your first case above.'
                : 'No cases match your search.'}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <CaseCard key={c.id} kase={c} onOpen={() => navigate(`/cases/${c.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-brand-300">{value}</div>
      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
    </Card>
  );
}

function CaseCard({ kase, onOpen }: { kase: Case; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="rounded-lg border border-surface-border bg-surface-raised p-4 text-left transition-colors hover:border-brand-500/60"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{kase.caseNumber}</span>
        {kase.status === 'archived' ? (
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
            Archived
          </span>
        ) : null}
      </div>
      <div className="mt-1 truncate text-sm text-slate-400">
        {kase.location || 'No location'}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{kase.investigator || 'Unassigned'}</span>
        <span>{kase.stains?.length ?? 0} stains</span>
      </div>
    </button>
  );
}

/** Case-insensitive match across the searchable case fields. */
function filterCases(cases: Case[], search: string): Case[] {
  const q = search.trim().toLowerCase();
  if (!q) return cases;
  return cases.filter((c) => {
    const haystack = [
      c.caseNumber,
      c.investigator,
      c.agency,
      c.location,
      c.victim?.name,
      c.date,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
