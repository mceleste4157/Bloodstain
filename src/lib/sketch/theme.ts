/**
 * Visual constants for the sketch generator.
 *
 * Centralized so the top-view, elevation, and (future) 3D views share one
 * consistent, court-presentable style — and so the whole look can be retuned
 * in a single place.
 */
export const sketchTheme = {
  background: '#0b1220',
  grid: '#1f2a3a',
  gridMajor: '#2b3a4f',
  wall: '#cbd5e1',
  wallFill: 'rgba(148, 163, 184, 0.04)',
  fixture: '#38bdf8',
  furniture: '#475569',
  furnitureLabel: '#94a3b8',
  stain: '#dc2626',
  stainStroke: '#7f1d1d',
  stainLabel: '#fecaca',
  directionality: 'rgba(96, 165, 250, 0.7)',
  convergence: '#f59e0b',
  origin: '#22c55e',
  measurement: '#60a5fa',
  scaleBar: '#e2e8f0',
  northArrow: '#e2e8f0',
  text: '#e2e8f0',
} as const;

export const sketchFont = 'ui-sans-serif, system-ui, sans-serif';
