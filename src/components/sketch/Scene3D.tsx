/**
 * 3D scene view.
 *
 * Renders the room, documented stains, and — per pattern group — the
 * reconstructed area of origin with trajectory (stringing) lines running from
 * each contributing stain back to that origin. It consumes the same
 * `analyzeScene` output as the 2D sketches, so the three views always agree; no
 * new geometry math lives here.
 *
 * Heavy (three.js), so this module is loaded lazily by the case view.
 *
 * Coordinate mapping: room millimeters → three.js meters (×0.001). Room x→X,
 * room height(z)→Y (up), room depth(y)→Z.
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Line, OrbitControls } from '@react-three/drei';
import type { Bloodstain, Point3D, Room } from '@/types';
import type { SceneAnalysis } from '@/lib/calculations';
import { groupColor, sketchTheme } from '@/lib/sketch/theme';

const S = 0.001; // mm → m

type Vec3 = [number, number, number];

/** Room point (mm) → three.js coordinates (height is Y-up). */
function toThree(p: Point3D): Vec3 {
  return [p.x * S, p.z * S, p.y * S];
}

export interface Scene3DProps {
  room: Room;
  stains: Bloodstain[];
  analysis: SceneAnalysis;
  height?: number;
}

export default function Scene3D({ room, stains, analysis, height = 460 }: Scene3DProps) {
  const w = room.width * S;
  const h = room.height * S;
  const l = room.length * S;
  const center: Vec3 = [w / 2, h / 2, l / 2];
  const camera: Vec3 = [w * 1.4, h * 1.8, l * 2.0];

  return (
    <div style={{ height, background: sketchTheme.background, borderRadius: 8 }}>
      <Canvas camera={{ position: camera, fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[w * 2, h * 3, l * 2]} intensity={0.8} />

          {/* Floor grid for spatial reference */}
          <Grid
            position={[w / 2, 0, l / 2]}
            args={[Math.max(w, l) * 1.4, Math.max(w, l) * 1.4]}
            cellColor={sketchTheme.grid}
            sectionColor={sketchTheme.gridMajor}
            infiniteGrid={false}
          />

          {/* Room bounding box (wireframe) */}
          <mesh position={center}>
            <boxGeometry args={[w, h, l]} />
            <meshBasicMaterial color={sketchTheme.wall} wireframe transparent opacity={0.25} />
          </mesh>

          {/* Stains */}
          {stains.map((stain) => {
            const pos = analysis.stainResults[stain.id]?.position;
            if (!pos) return null;
            return (
              <mesh key={stain.id} position={toThree(pos)}>
                <sphereGeometry args={[Math.max(w, l, h) * 0.012, 12, 12]} />
                <meshStandardMaterial color={sketchTheme.stain} />
              </mesh>
            );
          })}

          {/* Per-group trajectories + area of origin */}
          {analysis.groups.map((group, gi) => {
            if (!group.origin) return null;
            const color = groupColor(gi);
            const origin = toThree(group.origin.origin);
            const excluded = new Set(group.excludedStainIds);
            return (
              <group key={group.key || 'ungrouped'}>
                {group.memberStainIds.map((id) => {
                  if (excluded.has(id)) return null;
                  const pos = analysis.stainResults[id]?.position;
                  if (!pos) return null;
                  return (
                    <Line
                      key={`traj-${id}`}
                      points={[toThree(pos), origin]}
                      color={color}
                      lineWidth={1.5}
                      dashed
                      dashSize={0.05}
                      gapSize={0.03}
                    />
                  );
                })}
                {/* Area of origin marker */}
                <mesh position={origin}>
                  <sphereGeometry args={[Math.max(w, l, h) * 0.02, 16, 16]} />
                  <meshStandardMaterial color={sketchTheme.origin} emissive={color} emissiveIntensity={0.3} />
                </mesh>
              </group>
            );
          })}

          <OrbitControls target={center} enablePan makeDefault />
        </Suspense>
      </Canvas>
    </div>
  );
}
