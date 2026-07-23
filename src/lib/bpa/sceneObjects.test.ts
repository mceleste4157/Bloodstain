import { describe, expect, it } from 'vitest';
import { presetOf, sceneObjectColor, sceneObjectHeight, SCENE_PRESETS } from './sceneObjects';

describe('scene object presets', () => {
  it('includes a body marker and common furniture', () => {
    const kinds = SCENE_PRESETS.map((p) => p.kind);
    expect(kinds).toContain('body');
    expect(kinds).toContain('bed');
    expect(kinds).toContain('counter');
  });

  it('resolves a preset by kind', () => {
    expect(presetOf('bed')?.label).toBe('Bed');
    expect(presetOf('nonexistent')).toBeUndefined();
    expect(presetOf(undefined)).toBeUndefined();
  });

  it('colours the body distinctly from generic furniture', () => {
    expect(sceneObjectColor('body')).not.toBe(sceneObjectColor('dresser'));
  });

  it('provides a height for 3D, with a fallback', () => {
    expect(sceneObjectHeight('dresser')).toBeGreaterThan(0);
    expect(sceneObjectHeight(undefined)).toBeGreaterThan(0);
  });
});
