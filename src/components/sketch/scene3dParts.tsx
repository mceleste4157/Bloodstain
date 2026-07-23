/**
 * 3D building blocks for the scene view: solid room walls (with door openings
 * and window panels) and procedural furniture/scene-object models built from
 * three.js primitives so each item is recognizable (a bed looks like a bed, a
 * body like a body) rather than a featureless box.
 *
 * All inputs are in millimeters; everything is scaled to meters (×S) here.
 */

import { Fragment } from 'react';
import type { Furniture, Room, RoomFixture } from '@/types';
import { sceneObjectColor, sceneObjectHeight } from '@/lib/bpa/sceneObjects';

const S = 0.001; // mm → m
const WALL_T = 0.08; // wall thickness (m)
const LEG = '#3b4252';

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

interface Segment {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
}

/** Solid perimeter walls, split around door openings, plus window panels. */
export function Walls({ room }: { room: Room }) {
  const h = room.height * S;
  const doors = room.doors ?? [];
  const windows = room.windows ?? [];

  const segments: Segment[] = [];

  // Horizontal walls (north z=0, south z=l): run along X, gaps for doors.
  for (const [z0, wall] of [
    [0, 'north'],
    [room.length, 'south'],
  ] as const) {
    const gaps = doors
      .filter((d) => d.wall === wall)
      .map((d) => [d.offset, d.offset + d.width] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    for (const [start, end] of solidSpans(0, room.width, gaps)) {
      segments.push({
        cx: ((start + end) / 2) * S,
        cz: z0 * S,
        sx: (end - start) * S,
        sz: WALL_T,
      });
    }
  }

  // Vertical walls (west x=0, east x=width): run along Z (room length).
  for (const [x0, wall] of [
    [0, 'west'],
    [room.width, 'east'],
  ] as const) {
    const gaps = doors
      .filter((d) => d.wall === wall)
      .map((d) => [d.offset, d.offset + d.width] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    for (const [start, end] of solidSpans(0, room.length, gaps)) {
      segments.push({
        cx: x0 * S,
        cz: ((start + end) / 2) * S,
        sx: WALL_T,
        sz: (end - start) * S,
      });
    }
  }

  return (
    <Fragment>
      {segments.map((s, i) => (
        <mesh key={`wall-${i}`} position={[s.cx, h / 2, s.cz]}>
          <boxGeometry args={[s.sx, h, s.sz]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.16} />
        </mesh>
      ))}
      {windows.map((win) => (
        <WindowPanel key={win.id} win={win} room={room} />
      ))}
    </Fragment>
  );
}

/** A translucent glass panel for a window, set into its wall at sill height. */
function WindowPanel({ win, room }: { win: RoomFixture; room: Room }) {
  const winH = (win.height ?? 1000) * S;
  const sill = (win.sill ?? 900) * S;
  const cy = sill + winH / 2;
  const wWidth = win.width * S;
  const common = { color: '#38bdf8', transparent: true, opacity: 0.35 } as const;

  if (win.wall === 'north' || win.wall === 'south') {
    const z0 = (win.wall === 'north' ? 0 : room.length) * S;
    const cx = (win.offset + win.width / 2) * S;
    return (
      <mesh position={[cx, cy, z0]}>
        <boxGeometry args={[wWidth, winH, WALL_T * 0.5]} />
        <meshStandardMaterial {...common} />
      </mesh>
    );
  }
  const x0 = (win.wall === 'west' ? 0 : room.width) * S;
  const cz = (win.offset + win.width / 2) * S;
  return (
    <mesh position={[x0, cy, cz]}>
      <boxGeometry args={[WALL_T * 0.5, winH, wWidth]} />
      <meshStandardMaterial {...common} />
    </mesh>
  );
}

/** Complement of the gap intervals within [lo, hi] → solid spans to render. */
function solidSpans(lo: number, hi: number, gaps: [number, number][]): [number, number][] {
  const spans: [number, number][] = [];
  let cursor = lo;
  for (const [gStart, gEnd] of gaps) {
    const s = Math.max(lo, gStart);
    const e = Math.min(hi, gEnd);
    if (s > cursor) spans.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < hi) spans.push([cursor, hi]);
  return spans;
}

// ---------------------------------------------------------------------------
// Scene-object models
// ---------------------------------------------------------------------------

/** A recognizable procedural model for one furniture / scene object. */
export function SceneObjectMesh({ obj }: { obj: Furniture }) {
  const w = obj.width * S;
  const d = obj.depth * S;
  const h = sceneObjectHeight(obj.kind) * S;
  const color = sceneObjectColor(obj.kind);
  // Group centered on the footprint, resting on the floor.
  const cx = (obj.position.x + obj.width / 2) * S;
  const cz = (obj.position.y + obj.depth / 2) * S;
  const rotY = ((obj.rotation ?? 0) * Math.PI) / 180;

  return (
    <group position={[cx, 0, cz]} rotation={[0, -rotY, 0]}>
      <Model kind={obj.kind} w={w} d={d} h={h} color={color} />
    </group>
  );
}

interface ModelProps {
  kind?: string;
  w: number;
  d: number;
  h: number;
  color: string;
}

function Box({
  args,
  position,
  color,
  opacity = 1,
}: {
  args: [number, number, number];
  position: [number, number, number];
  color: string;
  opacity?: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

/** Four legs at the corners of a w×d footprint, up to height `top`. */
function Legs({ w, d, top }: { w: number; d: number; top: number }) {
  const t = Math.min(w, d) * 0.08 || 0.03;
  const inset = t;
  const y = top / 2;
  const xs = [-w / 2 + inset, w / 2 - inset];
  const zs = [-d / 2 + inset, d / 2 - inset];
  return (
    <Fragment>
      {xs.map((x) =>
        zs.map((z) => (
          <Box key={`${x},${z}`} args={[t, top, t]} position={[x, y, z]} color={LEG} />
        )),
      )}
    </Fragment>
  );
}

function Model({ kind, w, d, h, color }: ModelProps) {
  switch (kind) {
    case 'table':
    case 'counter':
    case 'appliance': {
      const topT = 0.06;
      return (
        <Fragment>
          <Legs w={w} d={d} top={h - topT} />
          <Box args={[w, topT, d]} position={[0, h - topT / 2, 0]} color={color} />
        </Fragment>
      );
    }
    case 'chair': {
      const seatY = h * 0.5;
      return (
        <Fragment>
          <Legs w={w} d={d} top={seatY} />
          <Box args={[w, 0.05, d]} position={[0, seatY, 0]} color={color} />
          {/* backrest along the rear edge */}
          <Box args={[w, h - seatY, 0.05]} position={[0, (h + seatY) / 2, -d / 2 + 0.03]} color={color} />
        </Fragment>
      );
    }
    case 'bed': {
      const frameH = h * 0.35;
      const mattressH = h * 0.35;
      return (
        <Fragment>
          <Box args={[w, frameH, d]} position={[0, frameH / 2, 0]} color={LEG} />
          <Box args={[w * 0.96, mattressH, d * 0.96]} position={[0, frameH + mattressH / 2, 0]} color={color} opacity={0.85} />
          {/* pillow at the head (min-x end) */}
          <Box args={[w * 0.22, mattressH * 0.6, d * 0.8]} position={[-w / 2 + w * 0.14, frameH + mattressH + mattressH * 0.3, 0]} color="#e2e8f0" opacity={0.9} />
        </Fragment>
      );
    }
    case 'sofa': {
      const seatH = h * 0.45;
      const arm = Math.min(w, d) * 0.12;
      return (
        <Fragment>
          <Box args={[w, seatH, d]} position={[0, seatH / 2, 0]} color={color} opacity={0.9} />
          <Box args={[w, h - seatH, d * 0.28]} position={[0, (h + seatH) / 2, -d / 2 + d * 0.14]} color={color} opacity={0.9} />
          <Box args={[arm, h * 0.7, d]} position={[-w / 2 + arm / 2, h * 0.35, 0]} color={color} opacity={0.9} />
          <Box args={[arm, h * 0.7, d]} position={[w / 2 - arm / 2, h * 0.35, 0]} color={color} opacity={0.9} />
        </Fragment>
      );
    }
    case 'dresser': {
      return (
        <Fragment>
          <Box args={[w, h, d]} position={[0, h / 2, 0]} color={color} />
          {/* drawer seams on the front face */}
          {[0.25, 0.5, 0.75].map((f) => (
            <Box key={f} args={[w * 0.9, 0.01, 0.01]} position={[0, h * f, d / 2 + 0.001]} color="#0f172a" />
          ))}
        </Fragment>
      );
    }
    case 'toilet': {
      const tankW = w * 0.9;
      return (
        <Fragment>
          {/* bowl */}
          <mesh position={[0, h * 0.35, d * 0.1]}>
            <cylinderGeometry args={[w * 0.35, w * 0.3, h * 0.6, 20]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {/* tank */}
          <Box args={[tankW, h, d * 0.28]} position={[0, h / 2, -d / 2 + d * 0.14]} color={color} />
        </Fragment>
      );
    }
    case 'sink': {
      const topT = 0.06;
      return (
        <Fragment>
          <Legs w={w} d={d} top={h - topT} />
          <Box args={[w, topT, d]} position={[0, h - topT / 2, 0]} color={color} />
          {/* basin recess */}
          <Box args={[w * 0.5, topT * 1.2, d * 0.5]} position={[0, h - topT, 0]} color="#0f172a" opacity={0.6} />
        </Fragment>
      );
    }
    case 'tv': {
      return (
        <Fragment>
          <Box args={[w, h * 0.5, d]} position={[0, h * 0.25, 0]} color={LEG} />
          {/* screen standing up */}
          <Box args={[w * 0.95, h * 0.5, 0.03]} position={[0, h * 0.75, -d / 2 + 0.05]} color="#0b1220" />
        </Fragment>
      );
    }
    case 'body': {
      // Reclining figure along the longer axis.
      const alongX = w >= d;
      const len = Math.max(w, d);
      const bodyW = Math.min(w, d) * 0.6;
      const torsoH = h * 0.6;
      const headR = bodyW * 0.42;
      const headPos = -len / 2 + headR;
      return (
        <group rotation={[0, alongX ? 0 : Math.PI / 2, 0]}>
          {/* torso */}
          <Box args={[len * 0.55, torsoH, bodyW]} position={[len * 0.03, torsoH / 2, 0]} color={color} opacity={0.9} />
          {/* legs */}
          <Box args={[len * 0.4, torsoH * 0.7, bodyW * 0.4]} position={[len * 0.32, torsoH * 0.35, -bodyW * 0.22]} color={color} opacity={0.9} />
          <Box args={[len * 0.4, torsoH * 0.7, bodyW * 0.4]} position={[len * 0.32, torsoH * 0.35, bodyW * 0.22]} color={color} opacity={0.9} />
          {/* head */}
          <mesh position={[headPos, headR, 0]}>
            <sphereGeometry args={[headR, 16, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    }
    case 'evidence': {
      // A little numbered tent marker (pyramid).
      return (
        <mesh position={[0, h * 0.6, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[Math.max(w, d) * 0.6, h * 1.2, 4]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    }
    default:
      return <Box args={[w, h, d]} position={[0, h / 2, 0]} color={color} opacity={0.6} />;
  }
}
