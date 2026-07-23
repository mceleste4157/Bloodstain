/**
 * Wall Elevation sketch.
 *
 * A straight-on view of one wall: the wall rectangle to scale, every stain on
 * that wall plotted at its horizontal position and height above the floor, with
 * height leader lines and labels, plus a reference line at the reconstructed
 * area-of-origin height. Like the top view it is a pure function of its props
 * and redraws instantly on any measurement change.
 *
 * Coordinate convention: the horizontal axis runs along the wall; the vertical
 * axis is height, drawn with the floor at the bottom (screen y is flipped).
 */

import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { Bloodstain, LengthUnit, Room } from '@/types';
import type { SceneAnalysis } from '@/lib/calculations';
import { formatInUnit } from '@/lib/calculations';
import { groupColor, sketchFont, sketchTheme } from '@/lib/sketch/theme';
import { fitTransform } from '@/lib/sketch/viewport';

export type WallId = 'north' | 'south' | 'east' | 'west';

export interface WallElevationProps {
  room: Room;
  stains: Bloodstain[];
  analysis: SceneAnalysis;
  unit: LengthUnit;
  wall: WallId;
  width?: number;
  height?: number;
  /** Ref to the underlying Konva stage, e.g. for PDF raster export. */
  stageRef?: React.Ref<Konva.Stage>;
}

/** Width of the wall being viewed (its horizontal extent). */
function wallExtent(room: Room, wall: WallId): number {
  return wall === 'north' || wall === 'south' ? room.width : room.length;
}

const WALL_SURFACE: Record<WallId, string> = {
  north: 'north-wall',
  south: 'south-wall',
  east: 'east-wall',
  west: 'west-wall',
};

export function WallElevation({
  room,
  stains,
  analysis,
  unit,
  wall,
  width = 800,
  height = 480,
  stageRef,
}: WallElevationProps) {
  const extent = wallExtent(room, wall);
  const t = fitTransform({ width: extent, height: room.height }, { width, height });

  // Horizontal (along-wall) → canvas x.
  const px = (alongWall: number) => alongWall * t.scale + t.offsetX;
  // Height (z, floor at 0) → canvas y, flipped so the floor sits at the bottom.
  const py = (z: number) => t.offsetY + (room.height - z) * t.scale;

  const wallStains = stains.filter((s) => s.surface === WALL_SURFACE[wall]);

  return (
    <Stage ref={stageRef} width={width} height={height} style={{ background: sketchTheme.background }}>
      <Layer listening={false}>
        {/* Wall rectangle */}
        <Rect
          x={px(0)}
          y={py(room.height)}
          width={extent * t.scale}
          height={room.height * t.scale}
          stroke={sketchTheme.wall}
          strokeWidth={3}
          fill={sketchTheme.wallFill}
        />

        {/* Floor label */}
        <Text
          x={px(0)}
          y={py(0) + 6}
          text="Floor"
          fontSize={11}
          fontFamily={sketchFont}
          fill={sketchTheme.text}
        />

        {/* Area-of-origin height reference line, one per group with a result */}
        {analysis.groups.map((group, gi) => {
          if (!group.origin) return null;
          const h = group.origin.meanHeight;
          const color = groupColor(gi);
          const multi = analysis.groups.filter((g) => g.origin).length > 1;
          const label = multi
            ? `${group.label} origin ≈ ${formatInUnit(h, unit)}`
            : `Area of origin ≈ ${formatInUnit(h, unit)}`;
          return (
            <Group key={`origin-${group.key}`}>
              <Line points={[px(0), py(h), px(extent), py(h)]} stroke={color} strokeWidth={1.5} dash={[8, 5]} />
              <Text
                x={px(0) + 6}
                y={py(h) - 16}
                text={label}
                fontSize={11}
                fontFamily={sketchFont}
                fill={color}
              />
            </Group>
          );
        })}

        {/* Stains on this wall */}
        {wallStains.map((stain) => {
          const pos = analysis.stainResults[stain.id]?.position;
          if (!pos) return null;
          const alongWall = wall === 'north' || wall === 'south' ? pos.x : pos.y;
          const z = pos.z;
          const cx = px(alongWall);
          const cy = py(z);
          return (
            <Group key={`el-${stain.id}`}>
              {/* Height leader line down to the floor */}
              <Line points={[cx, cy, cx, py(0)]} stroke={sketchTheme.measurement} strokeWidth={1} dash={[3, 3]} />
              {/* Stain marker */}
              <Rect
                x={cx - 5}
                y={cy - 5}
                width={10}
                height={10}
                rotation={45}
                offsetX={0}
                offsetY={0}
                fill={sketchTheme.stain}
                stroke={sketchTheme.stainStroke}
                strokeWidth={1}
              />
              <Text
                x={cx + 8}
                y={cy - 6}
                text={`${stain.stainId}  ${formatInUnit(z, unit)}`}
                fontSize={11}
                fontStyle="bold"
                fontFamily={sketchFont}
                fill={sketchTheme.stainLabel}
              />
            </Group>
          );
        })}

        {/* Dimension label: wall width and height */}
        <Text
          x={px(0)}
          y={py(room.height) - 18}
          text={`${formatInUnit(extent, unit, 0)} wide × ${formatInUnit(room.height, unit, 0)} high`}
          fontSize={11}
          fontFamily={sketchFont}
          fill={sketchTheme.text}
        />
      </Layer>
    </Stage>
  );
}
