/**
 * Top-View (floor plan) sketch.
 *
 * Automatically renders a court-presentable plan of the scene directly from the
 * case's measurements and the derived scene analysis — no manual drawing
 * required. Because it is a pure function of its props, the sketch updates
 * instantly whenever a measurement, the room, or the analysis changes.
 *
 * Layers, back to front:
 *   grid → room outline/walls → fixtures → furniture → directionality lines →
 *   stains + labels → convergence & area-of-origin markers → scale bar + north.
 */

import { Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { Bloodstain, Point2D, Room, UnitSystem } from '@/types';
import type { SceneAnalysis } from '@/lib/calculations';
import { formatLength } from '@/lib/calculations';
import { sketchFont, sketchTheme } from '@/lib/sketch/theme';
import {
  fitTransform,
  niceScaleBarMm,
  project,
  scaleLength,
  type ViewTransform,
} from '@/lib/sketch/viewport';

export interface TopViewProps {
  room: Room;
  stains: Bloodstain[];
  analysis: SceneAnalysis;
  unitSystem: UnitSystem;
  width?: number;
  height?: number;
  /** Grid spacing in mm; omit to hide the grid. */
  gridMm?: number;
  /** Ref to the underlying Konva stage, e.g. for PDF raster export. */
  stageRef?: React.Ref<Konva.Stage>;
}

export function TopView({
  room,
  stains,
  analysis,
  unitSystem,
  width = 800,
  height = 600,
  gridMm = 500,
  stageRef,
}: TopViewProps) {
  // Top view: x = room width (horizontal), y = room length (vertical).
  const t = fitTransform({ width: room.width, height: room.length }, { width, height });

  return (
    <Stage ref={stageRef} width={width} height={height} style={{ background: sketchTheme.background }}>
      <Layer listening={false}>
        {gridMm ? <Grid room={room} t={t} spacingMm={gridMm} /> : null}
        <RoomOutline room={room} t={t} />
        <Fixtures room={room} t={t} />
        <FurnitureItems room={room} t={t} />
        <DirectionalityLines stains={stains} analysis={analysis} t={t} />
        <Stains stains={stains} analysis={analysis} t={t} />
        <ConvergenceAndOrigin analysis={analysis} unitSystem={unitSystem} t={t} />
        <ScaleBar t={t} unitSystem={unitSystem} canvasHeight={height} />
        <NorthArrow canvasWidth={width} />
      </Layer>
    </Stage>
  );
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

function Grid({ room, t, spacingMm }: { room: Room; t: ViewTransform; spacingMm: number }) {
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= room.width + 1e-6; x += spacingMm) {
    const a = project(t, { x, y: 0 });
    const b = project(t, { x, y: room.length });
    lines.push(
      <Line key={`gx${x}`} points={[a.x, a.y, b.x, b.y]} stroke={sketchTheme.grid} strokeWidth={1} />,
    );
  }
  for (let y = 0; y <= room.length + 1e-6; y += spacingMm) {
    const a = project(t, { x: 0, y });
    const b = project(t, { x: room.width, y });
    lines.push(
      <Line key={`gy${y}`} points={[a.x, a.y, b.x, b.y]} stroke={sketchTheme.grid} strokeWidth={1} />,
    );
  }
  return <Group>{lines}</Group>;
}

function RoomOutline({ room, t }: { room: Room; t: ViewTransform }) {
  const origin = project(t, { x: 0, y: 0 });
  return (
    <Rect
      x={origin.x}
      y={origin.y}
      width={scaleLength(t, room.width)}
      height={scaleLength(t, room.length)}
      stroke={sketchTheme.wall}
      strokeWidth={3}
      fill={sketchTheme.wallFill}
    />
  );
}

function Fixtures({ room, t }: { room: Room; t: ViewTransform }) {
  const segments: React.ReactNode[] = [];

  const pushFixture = (
    key: string,
    wall: 'north' | 'south' | 'east' | 'west',
    offset: number,
    len: number,
    color: string,
  ) => {
    let a: Point2D;
    let b: Point2D;
    switch (wall) {
      case 'north': // top edge, y = 0
        a = { x: offset, y: 0 };
        b = { x: offset + len, y: 0 };
        break;
      case 'south': // bottom edge, y = length
        a = { x: offset, y: room.length };
        b = { x: offset + len, y: room.length };
        break;
      case 'west': // left edge, x = 0
        a = { x: 0, y: offset };
        b = { x: 0, y: offset + len };
        break;
      case 'east': // right edge, x = width
        a = { x: room.width, y: offset };
        b = { x: room.width, y: offset + len };
        break;
    }
    const pa = project(t, a);
    const pb = project(t, b);
    segments.push(
      <Line key={key} points={[pa.x, pa.y, pb.x, pb.y]} stroke={color} strokeWidth={6} lineCap="round" />,
    );
  };

  (room.doors ?? []).forEach((d) =>
    pushFixture(`door-${d.id}`, d.wall, d.offset, d.width, sketchTheme.fixture),
  );
  (room.windows ?? []).forEach((w) =>
    pushFixture(`win-${w.id}`, w.wall, w.offset, w.width, sketchTheme.fixture),
  );

  return <Group>{segments}</Group>;
}

function FurnitureItems({ room, t }: { room: Room; t: ViewTransform }) {
  return (
    <Group>
      {(room.furniture ?? []).map((f) => {
        const p = project(t, f.position);
        return (
          <Group key={f.id}>
            <Rect
              x={p.x}
              y={p.y}
              width={scaleLength(t, f.width)}
              height={scaleLength(t, f.depth)}
              rotation={f.rotation ?? 0}
              stroke={sketchTheme.furniture}
              strokeWidth={1.5}
              dash={[4, 3]}
            />
            <Text
              x={p.x + 4}
              y={p.y + 4}
              text={f.label}
              fontSize={11}
              fontFamily={sketchFont}
              fill={sketchTheme.furnitureLabel}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function DirectionalityLines({
  stains,
  analysis,
  t,
}: {
  stains: Bloodstain[];
  analysis: SceneAnalysis;
  t: ViewTransform;
}) {
  const convergence = analysis.convergence?.point;
  if (!convergence) return null;
  const cp = project(t, convergence);

  return (
    <Group>
      {stains.map((stain) => {
        const pos = analysis.stainResults[stain.id]?.position;
        if (!pos || analysis.excludedStainIds.includes(stain.id)) return null;
        const sp = project(t, { x: pos.x, y: pos.y });
        return (
          <Line
            key={`dir-${stain.id}`}
            points={[sp.x, sp.y, cp.x, cp.y]}
            stroke={sketchTheme.directionality}
            strokeWidth={1.5}
            dash={[6, 4]}
          />
        );
      })}
    </Group>
  );
}

function Stains({
  stains,
  analysis,
  t,
}: {
  stains: Bloodstain[];
  analysis: SceneAnalysis;
  t: ViewTransform;
}) {
  return (
    <Group>
      {stains.map((stain) => {
        const pos = analysis.stainResults[stain.id]?.position;
        if (!pos) return null;
        const p = project(t, { x: pos.x, y: pos.y });
        // Schematic glyph: an ellipse whose elongation echoes the stain's
        // width-to-length ratio, oriented along its directionality. Drawn at a
        // fixed pixel size so real (tiny) stains stay visible on the plan.
        const ratio = analysis.stainResults[stain.id]?.widthToLengthRatio;
        const rX = 9;
        const rY = Number.isFinite(ratio) ? Math.max(2.5, 9 * (ratio as number)) : 6;
        return (
          <Group key={`stain-${stain.id}`}>
            <Ellipse
              x={p.x}
              y={p.y}
              radiusX={rX}
              radiusY={rY}
              rotation={-(stain.directionality ?? 0)}
              fill={sketchTheme.stain}
              stroke={sketchTheme.stainStroke}
              strokeWidth={1}
            />
            <Text
              x={p.x + 11}
              y={p.y - 6}
              text={stain.stainId}
              fontSize={11}
              fontStyle="bold"
              fontFamily={sketchFont}
              fill={sketchTheme.stainLabel}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function ConvergenceAndOrigin({
  analysis,
  unitSystem,
  t,
}: {
  analysis: SceneAnalysis;
  unitSystem: UnitSystem;
  t: ViewTransform;
}) {
  const convergence = analysis.convergence?.point;
  if (!convergence) return null;
  const cp = project(t, convergence);
  const heightLabel = analysis.origin
    ? `Origin ≈ ${formatLength(analysis.origin.meanHeight, unitSystem)} high`
    : null;

  return (
    <Group>
      {/* Area of convergence crosshair */}
      <Line points={[cp.x - 10, cp.y, cp.x + 10, cp.y]} stroke={sketchTheme.convergence} strokeWidth={2} />
      <Line points={[cp.x, cp.y - 10, cp.x, cp.y + 10]} stroke={sketchTheme.convergence} strokeWidth={2} />
      <Circle x={cp.x} y={cp.y} radius={13} stroke={sketchTheme.convergence} strokeWidth={1.5} dash={[3, 3]} />
      {/* Area of origin ring (its x,y projects onto the convergence point) */}
      {analysis.origin ? (
        <Circle x={cp.x} y={cp.y} radius={18} stroke={sketchTheme.origin} strokeWidth={1.5} />
      ) : null}
      <Text
        x={cp.x + 16}
        y={cp.y + 12}
        text={heightLabel ? `Area of convergence\n${heightLabel}` : 'Area of convergence'}
        fontSize={11}
        fontFamily={sketchFont}
        fill={sketchTheme.text}
      />
    </Group>
  );
}

function ScaleBar({
  t,
  unitSystem,
  canvasHeight,
}: {
  t: ViewTransform;
  unitSystem: UnitSystem;
  canvasHeight: number;
}) {
  const barMm = niceScaleBarMm(t);
  const barPx = scaleLength(t, barMm);
  const x = 24;
  const y = canvasHeight - 28;
  return (
    <Group>
      <Line points={[x, y, x + barPx, y]} stroke={sketchTheme.scaleBar} strokeWidth={3} />
      <Line points={[x, y - 5, x, y + 5]} stroke={sketchTheme.scaleBar} strokeWidth={3} />
      <Line points={[x + barPx, y - 5, x + barPx, y + 5]} stroke={sketchTheme.scaleBar} strokeWidth={3} />
      <Text
        x={x}
        y={y - 20}
        text={formatLength(barMm, unitSystem, 0)}
        fontSize={11}
        fontFamily={sketchFont}
        fill={sketchTheme.scaleBar}
      />
    </Group>
  );
}

function NorthArrow({ canvasWidth }: { canvasWidth: number }) {
  const x = canvasWidth - 34;
  const y = 40;
  return (
    <Group>
      <Line points={[x, y + 16, x, y - 16]} stroke={sketchTheme.northArrow} strokeWidth={2} />
      <Line points={[x - 6, y - 8, x, y - 16, x + 6, y - 8]} stroke={sketchTheme.northArrow} strokeWidth={2} />
      <Text
        x={x - 4}
        y={y - 34}
        text="N"
        fontSize={13}
        fontStyle="bold"
        fontFamily={sketchFont}
        fill={sketchTheme.northArrow}
      />
    </Group>
  );
}
