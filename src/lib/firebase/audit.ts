/**
 * Audit log.
 *
 * Records meaningful, court-relevant actions (case created/deleted, report
 * generated, photos added/removed) as immutable Firestore documents. This gives
 * a basic chain-of-custody trail. Entries are never updated or deleted (enforced
 * by the security rules).
 *
 * Granular per-keystroke edits are intentionally not logged — the case
 * autosaves constantly, which would drown the log; structural events are what
 * matter for accountability.
 */

import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import type { AuditLogEntry } from '@/types';
import { auth, db } from './config';

const COLLECTION = 'auditLog';

export type AuditAction =
  | 'case.created'
  | 'case.deleted'
  | 'report.generated'
  | 'photo.added'
  | 'photo.deleted';

/** Append an audit entry for the current user. Best-effort (never throws). */
export async function logAudit(
  action: AuditAction,
  caseId: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await addDoc(collection(db, COLLECTION), {
      caseId,
      actorUid: uid,
      action,
      timestamp: Date.now(),
      detail: detail ?? null,
    } satisfies DocumentData);
  } catch (err) {
    console.warn('Audit log write failed:', err);
  }
}

/**
 * Subscribe to the current user's audit entries. Filters on `actorUid` only
 * (automatic single-field index, and required by the read rule); callers filter
 * by case and sort client-side.
 */
export function subscribeAuditLog(
  actorUid: string,
  onData: (entries: AuditLogEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLLECTION), where('actorUid', '==', actorUid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogEntry)),
    (err) => onError?.(err),
  );
}
