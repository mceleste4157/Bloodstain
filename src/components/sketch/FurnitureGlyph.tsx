/**
 * Plan-view (top-down) icons for scene objects, drawn with Konva so a dragged
 * item reads as what it is — a body silhouette, a bed with a pillow, a chair, a
 * toilet — instead of a plain box.
 *
 * Everything is drawn inside the item's footprint box [0,0]→[w,d] (pixels); the
 * parent Group positions and rotates it. Colours come from the scene-object
 * catalog. Fills are translucent so overlapping stains stay visible.
 */

import { Fragment } from 'react';
import { Circle, Ellipse, Group, Line, Rect, RegularPolygon } from 'react-konva';
import { sceneObjectColor } from '@/lib/bpa/sceneObjects';

/** hex (#rrggbb) → rgba() with the given alpha, for translucent fills. */
function rgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface GlyphProps {
  kind?: string;
  /** Footprint size in pixels. */
  w: number;
  d: number;
}

export function FurnitureGlyph({ kind, w, d }: GlyphProps) {
  const color = sceneObjectColor(kind);
  const fill = rgba(color, 0.18);
  const strong = rgba(color, 0.5);
  const sw = 1.5;

  const outline = (cornerRadius = 2) => (
    <Rect x={0} y={0} width={w} height={d} cornerRadius={cornerRadius} stroke={color} strokeWidth={sw} fill={fill} />
  );

  switch (kind) {
    case 'table':
    case 'counter':
    case 'appliance':
      return (
        <Group>
          {outline(3)}
          {[
            [4, 4],
            [w - 4, 4],
            [4, d - 4],
            [w - 4, d - 4],
          ].map(([x, y], i) => (
            <Circle key={i} x={x} y={y} radius={1.6} fill={color} />
          ))}
        </Group>
      );

    case 'chair':
      return (
        <Group>
          {outline(2)}
          {/* backrest along the rear edge (top) */}
          <Line points={[2, 2, w - 2, 2]} stroke={color} strokeWidth={3} lineCap="round" />
        </Group>
      );

    case 'bed':
      return (
        <Group>
          {outline(3)}
          {/* pillow at the head (top) */}
          <Rect x={w * 0.1} y={d * 0.06} width={w * 0.8} height={d * 0.18} cornerRadius={2} fill={strong} stroke={color} strokeWidth={1} />
          {/* blanket fold line */}
          <Line points={[2, d * 0.42, w - 2, d * 0.42]} stroke={color} strokeWidth={1} dash={[4, 3]} />
        </Group>
      );

    case 'sofa':
      return (
        <Group>
          {outline(4)}
          {/* backrest (top) + arms (sides) */}
          <Rect x={0} y={0} width={w} height={d * 0.22} cornerRadius={3} fill={strong} />
          <Rect x={0} y={0} width={w * 0.12} height={d} cornerRadius={3} fill={strong} />
          <Rect x={w * 0.88} y={0} width={w * 0.12} height={d} cornerRadius={3} fill={strong} />
          {/* seat cushion divisions */}
          <Line points={[w / 2, d * 0.25, w / 2, d]} stroke={color} strokeWidth={1} />
        </Group>
      );

    case 'dresser':
      return (
        <Group>
          {outline(2)}
          {[0.33, 0.66].map((f) => (
            <Line key={f} points={[0, d * f, w, d * f]} stroke={color} strokeWidth={1} />
          ))}
        </Group>
      );

    case 'sink':
      return (
        <Group>
          {outline(2)}
          <Ellipse x={w / 2} y={d / 2} radiusX={w * 0.32} radiusY={d * 0.3} stroke={color} strokeWidth={1.5} />
        </Group>
      );

    case 'toilet':
      return (
        <Group>
          {/* tank at the rear */}
          <Rect x={w * 0.1} y={0} width={w * 0.8} height={d * 0.25} cornerRadius={2} stroke={color} strokeWidth={sw} fill={fill} />
          {/* bowl */}
          <Ellipse x={w / 2} y={d * 0.62} radiusX={w * 0.4} radiusY={d * 0.34} stroke={color} strokeWidth={sw} fill={fill} />
        </Group>
      );

    case 'tv':
      return (
        <Group>
          <Rect x={0} y={0} width={w} height={d} cornerRadius={1} stroke={color} strokeWidth={2} fill={strong} />
        </Group>
      );

    case 'evidence':
      // Small numbered-tent style marker (triangle).
      return (
        <RegularPolygon x={w / 2} y={d / 2} sides={3} radius={Math.max(w, d) * 0.6} fill={color} stroke="#78350f" strokeWidth={1} />
      );

    case 'body': {
      // Top-down human silhouette along the longer axis.
      const alongX = w >= d;
      const len = Math.max(w, d);
      const span = Math.min(w, d);
      const cx = w / 2;
      const cy = d / 2;
      const headR = span * 0.26;
      // Positions expressed along the long axis then mapped to x or y.
      const headCenter = alongX ? { x: headR, y: cy } : { x: cx, y: headR };
      const torso = alongX
        ? { x: cx, y: cy, rx: len * 0.32, ry: span * 0.34 }
        : { x: cx, y: cy, rx: span * 0.34, ry: len * 0.32 };
      const shoulders = alongX
        ? { x: len * 0.32, y: cy, rx: span * 0.12, ry: span * 0.42 }
        : { x: cx, y: len * 0.32, rx: span * 0.42, ry: span * 0.12 };
      return (
        <Group>
          {/* body outline box (faint) */}
          <Rect x={0} y={0} width={w} height={d} cornerRadius={4} stroke={strong} strokeWidth={1} dash={[3, 3]} />
          {/* torso */}
          <Ellipse x={torso.x} y={torso.y} radiusX={torso.rx} radiusY={torso.ry} fill={rgba(color, 0.55)} stroke={color} strokeWidth={1.5} />
          {/* shoulders */}
          <Ellipse x={shoulders.x} y={shoulders.y} radiusX={shoulders.rx} radiusY={shoulders.ry} fill={rgba(color, 0.55)} />
          {/* head */}
          <Circle x={headCenter.x} y={headCenter.y} radius={headR} fill={color} stroke="#7f1d1d" strokeWidth={1} />
        </Group>
      );
    }

    default:
      return (
        <Fragment>
          <Rect x={0} y={0} width={w} height={d} cornerRadius={2} stroke={color} strokeWidth={sw} fill={fill} dash={[4, 3]} />
        </Fragment>
      );
  }
}
