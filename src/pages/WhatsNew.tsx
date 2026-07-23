/**
 * "What's New" — the in-app changelog.
 *
 * Reads src/generated/changelog.json, which is regenerated from the git history
 * on every build (see scripts/gen-changelog.mjs). Because a deploy happens on
 * every push, this list stays in sync with the repository automatically — each
 * change appears here without any manual edits.
 */

import { Link } from 'react-router-dom';
import rawChangelog from '@/generated/changelog.json';
import { APP_VERSION } from '@/version';
import { Card } from '@/components/ui';

interface ChangelogEntry {
  hash: string;
  date: string;
  version: string | null;
  subject: string;
}

const REPO = 'mceleste4157/Bloodstain';
const entries = rawChangelog as ChangelogEntry[];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function WhatsNew() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/" className="text-sm text-slate-400 hover:text-brand-300">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">What's new</h1>
        <p className="text-sm text-slate-400">
          Currently running <span className="font-mono text-brand-300">v{APP_VERSION}</span>. This
          list updates automatically from the repository on every deploy.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">No changelog entries available.</p>
        </Card>
      ) : (
        <Card>
          <ol className="space-y-4">
            {entries.map((e) => (
              <li key={e.hash} className="border-b border-surface-border/50 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  {e.version ? (
                    <span className="rounded bg-brand-600/20 px-1.5 py-0.5 text-xs font-semibold text-brand-300">
                      v{e.version}
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-500">{formatDate(e.date)}</span>
                  <a
                    href={`https://github.com/${REPO}/commit/${e.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto font-mono text-xs text-slate-500 hover:text-brand-300"
                  >
                    {e.hash}
                  </a>
                </div>
                <p className="mt-1 text-sm text-slate-200">{e.subject}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
