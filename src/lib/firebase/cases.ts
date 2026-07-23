/**
 * Case repository — the persistence layer for investigation cases.
 *
 * A whole `Case` (including its room and stain array) is stored as a single
 * Firestore document in the `cases` collection. That keeps reads/writes atomic
 * and the client model identical to the stored model. Every document carries
 * `ownerUid`; the security rules restrict access to the owner (CJIS-friendly:
 * no cross-user or anonymous access).
 *
 * This module is the only place that talks to the `cases` collection, so the
 * data shape and query rules live in exactly one spot.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { Case } from '@/types';
import { db } from './config';

const COLLECTION = 'cases';

/** Recursively drop `undefined` values — Firestore rejects them. */
function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => pruneUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = pruneUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** Converts between the stored document and the typed `Case` model. */
const caseConverter: FirestoreDataConverter<Case> = {
  toFirestore(model: Case): DocumentData {
    // `id` is the document id, not a stored field.
    const { id: _id, ...rest } = model;
    return pruneUndefined(rest);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Case {
    const data = snapshot.data() as Omit<Case, 'id'>;
    return { ...data, id: snapshot.id };
  },
};

function casesCollection() {
  return collection(db, COLLECTION).withConverter(caseConverter);
}

function caseDoc(id: string) {
  return doc(db, COLLECTION, id).withConverter(caseConverter);
}

/** A blank case with sensible defaults, owned by the given user. */
export function makeEmptyCase(ownerUid: string, caseNumber: string): Omit<Case, 'id'> {
  const now = Date.now();
  return {
    caseNumber: caseNumber.trim(),
    unitSystem: 'metric',
    ownerUid,
    status: 'active',
    stains: [],
    room: { width: 4000, length: 3000, height: 2600 },
    createdAt: now,
    updatedAt: now,
  };
}

/** Create a new case document; resolves to the new document id. */
export async function createCase(data: Omit<Case, 'id'>): Promise<string> {
  const ref = await addDoc(casesCollection(), { ...data, id: '' } as Case);
  return ref.id;
}

/** One-shot fetch of a single case, or null if it does not exist. */
export async function getCase(id: string): Promise<Case | null> {
  const snap = await getDoc(caseDoc(id));
  return snap.exists() ? snap.data() : null;
}

/** Patch fields on a case and bump `updatedAt`. */
export async function updateCase(id: string, patch: Partial<Case>): Promise<void> {
  const { id: _ignore, ...rest } = patch;
  await updateDoc(caseDoc(id), pruneUndefined({ ...rest, updatedAt: Date.now() }));
}

export async function deleteCase(id: string): Promise<void> {
  await deleteDoc(caseDoc(id));
}

/**
 * Subscribe to all of a user's cases, newest first. Returns an unsubscribe
 * function; errors are surfaced via `onError`.
 *
 * The query filters on `ownerUid` only (served by Firestore's automatic
 * single-field index) and sorts by `updatedAt` client-side, so no composite
 * index needs to be provisioned. When case volumes make server-side ordering
 * worthwhile, add the composite index and move the sort into the query.
 */
export function subscribeCases(
  ownerUid: string,
  onData: (cases: Case[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(casesCollection(), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const cases = snap.docs.map((d) => d.data());
      cases.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      onData(cases);
    },
    (err) => onError?.(err),
  );
}

/** Subscribe to a single case document. */
export function subscribeCase(
  id: string,
  onData: (kase: Case | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    caseDoc(id),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (err) => onError?.(err),
  );
}
