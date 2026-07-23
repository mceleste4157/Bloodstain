/**
 * A tiny, generic undo/redo history — pure functions over an immutable
 * { past, present, future } record. Used by the case editor so any edit can be
 * reverted. Kept free of React so the transitions are trivially unit-tested.
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Record a new present. No-op when the value is identical (reference-equal) to
 * the current present. `limit` caps how many undo steps are retained.
 */
export function pushHistory<T>(h: History<T>, next: T, limit = 50): History<T> {
  if (Object.is(next, h.present)) return h;
  const past = [...h.past, h.present];
  return { past: past.slice(-limit), present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  const present = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [present, ...rest] = h.future;
  return { past: [...h.past, h.present], present, future: rest };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}
