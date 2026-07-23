/**
 * Scene-object presets — common items placed in a crime-scene layout (furniture,
 * fixtures, and a body marker) shown in relationship to the bloodstains.
 *
 * Each preset carries a sensible default footprint (mm) and a category used for
 * colouring and 3D height. Objects are stored in the room's `furniture` array
 * with an optional `kind` identifying the preset.
 */

export interface ScenePreset {
  kind: string;
  label: string;
  /** Default footprint in millimeters. */
  width: number;
  depth: number;
  /** Approximate height (mm) for the 3D view. */
  height: number;
}

export const SCENE_PRESETS: ScenePreset[] = [
  { kind: 'body', label: 'Body', width: 1800, depth: 500, height: 300 },
  { kind: 'bed', label: 'Bed', width: 1500, depth: 2000, height: 600 },
  { kind: 'dresser', label: 'Dresser', width: 1200, depth: 500, height: 900 },
  { kind: 'chair', label: 'Chair', width: 500, depth: 500, height: 900 },
  { kind: 'table', label: 'Table', width: 1200, depth: 800, height: 750 },
  { kind: 'sofa', label: 'Sofa', width: 2000, depth: 900, height: 800 },
  { kind: 'counter', label: 'Kitchen counter', width: 2400, depth: 650, height: 900 },
  { kind: 'appliance', label: 'Appliance', width: 600, depth: 650, height: 900 },
  { kind: 'sink', label: 'Sink', width: 600, depth: 600, height: 900 },
  { kind: 'toilet', label: 'Toilet', width: 400, depth: 700, height: 400 },
  { kind: 'tv', label: 'TV / stand', width: 1400, depth: 400, height: 500 },
  { kind: 'evidence', label: 'Evidence', width: 300, depth: 300, height: 100 },
  { kind: 'other', label: 'Item', width: 800, depth: 500, height: 500 },
];

const PRESET_INDEX: Record<string, ScenePreset> = Object.fromEntries(
  SCENE_PRESETS.map((p) => [p.kind, p]),
);

export function presetOf(kind: string | undefined): ScenePreset | undefined {
  return kind ? PRESET_INDEX[kind] : undefined;
}

/** Top-view / 3D fill colour for a scene object by kind. */
export function sceneObjectColor(kind: string | undefined): string {
  switch (kind) {
    case 'body':
      return '#b91c1c'; // red — the victim
    case 'evidence':
      return '#f59e0b'; // amber
    case 'bed':
    case 'sofa':
      return '#3f6212'; // muted green (soft furnishings)
    case 'counter':
    case 'appliance':
    case 'sink':
    case 'toilet':
      return '#0e7490'; // teal (fixtures)
    default:
      return '#475569'; // slate (generic furniture)
  }
}

/** Approximate 3D height (mm) for a scene object. */
export function sceneObjectHeight(kind: string | undefined): number {
  return presetOf(kind)?.height ?? 500;
}
