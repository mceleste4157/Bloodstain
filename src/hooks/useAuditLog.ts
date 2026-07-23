/**
 * Live audit-log entries for a single case, newest first. Subscribes to the
 * current user's entries and filters by case client-side (see audit.ts for why
 * the query is owner-scoped rather than case-scoped).
 */

import { useEffect, useState } from 'react';
import type { AuditLogEntry } from '@/types';
import { subscribeAuditLog } from '@/lib/firebase/audit';
import { useAuth } from '@/contexts/AuthContext';

export function useAuditLog(caseId: string | undefined) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !caseId) {
      setEntries([]);
      return;
    }
    const unsub = subscribeAuditLog(
      user.uid,
      (all) => {
        const forCase = all
          .filter((e) => e.caseId === caseId)
          .sort((a, b) => b.timestamp - a.timestamp);
        setEntries(forCase);
      },
      (err) => setError(err.message),
    );
    return unsub;
  }, [user, caseId]);

  return { entries, error };
}
