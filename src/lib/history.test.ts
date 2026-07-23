import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, initHistory, pushHistory, redo, undo } from './history';

describe('history', () => {
  it('starts empty', () => {
    const h = initHistory('a');
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('pushes and undoes/redoes', () => {
    let h = initHistory('a');
    h = pushHistory(h, 'b');
    h = pushHistory(h, 'c');
    expect(h.present).toBe('c');
    expect(canUndo(h)).toBe(true);

    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);

    h = redo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
  });

  it('clears the redo stack on a new push', () => {
    let h = initHistory('a');
    h = pushHistory(h, 'b');
    h = undo(h); // present a, future [b]
    h = pushHistory(h, 'c'); // new branch
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('ignores an identical push', () => {
    const h = initHistory('a');
    expect(pushHistory(h, 'a')).toBe(h);
  });

  it('caps the retained history', () => {
    let h = initHistory(0);
    for (let i = 1; i <= 60; i++) h = pushHistory(h, i, 10);
    expect(h.present).toBe(60);
    expect(h.past.length).toBe(10);
  });

  it('undo/redo at the ends are no-ops', () => {
    const h = initHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
