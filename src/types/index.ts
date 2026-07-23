/**
 * Domain model for the Bloodstain Pattern Analysis Assistant.
 *
 * These types are the single source of truth shared across every module:
 * calculations, the sketch generator, Firestore persistence, PDF reports, and
 * the (future) dashboard. Keeping them centralized means a change to the data
 * shape propagates everywhere with the help of the TypeScript compiler.
 *
 * Only the calculation- and sketch-relevant types are exercised in this build
 * section; the case/photo/audit types are defined now so the remaining modules
 * have a stable contract to build against.
 */

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Measurement systems the app supports. All internal math is unit-agnostic. */
export type UnitSystem = 'metric' | 'imperial';

/** Concrete length units used for storage and conversion. */
export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** A 2D point on a plane (top-view floor plan or a wall elevation). */
export interface Point2D {
  x: number;
  y: number;
}

/** A 3D point in room coordinates (origin at the front-left-floor corner). */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// ---------------------------------------------------------------------------
// Room / scene
// ---------------------------------------------------------------------------

/**
 * Which of the room's six bounding surfaces a stain sits on. Determines how the
 * wall-relative distance measurements map into room (x, y, z) coordinates.
 */
export type SurfaceType =
  | 'floor'
  | 'ceiling'
  | 'north-wall'
  | 'south-wall'
  | 'east-wall'
  | 'west-wall'
  | 'furniture'
  | 'other';

/**
 * Room dimensions. All values are stored in a single canonical unit
 * (millimeters) regardless of the UI's display unit — conversion happens only
 * at the presentation boundary. `width` runs left→right (x), `length` runs
 * front→rear (y), `height` runs floor→ceiling (z).
 */
export interface Room {
  width: number;
  length: number;
  height: number;
  /** Optional fixtures rendered by the sketch generator. */
  doors?: RoomFixture[];
  windows?: RoomFixture[];
  furniture?: Furniture[];
}

export interface RoomFixture {
  id: string;
  wall: 'north' | 'south' | 'east' | 'west';
  /** Distance from the wall's start corner to the fixture's near edge. */
  offset: number;
  width: number;
  height?: number;
  /** Sill height above floor (windows). */
  sill?: number;
}

export interface Furniture {
  id: string;
  label: string;
  /** Top-view footprint position (front-left corner of the item). */
  position: Point2D;
  width: number;
  depth: number;
  rotation?: number; // degrees, clockwise
}

// ---------------------------------------------------------------------------
// Bloodstains
// ---------------------------------------------------------------------------

/**
 * A single documented bloodstain. Raw measurements are entered by the
 * investigator; derived values (ratio, impact angle, coordinates) are computed
 * by the calculations module and are never persisted as the source of truth —
 * they are recomputed so a corrected measurement can never leave a stale
 * calculation behind.
 */
export interface Bloodstain {
  id: string;
  stainId: string; // human-facing label, e.g. "BS-001"
  surface: SurfaceType;
  /** Pattern classification value from the BPA taxonomy (see lib/bpa/patterns). */
  patternType?: string;
  description?: string;

  // --- Ellipse measurements (canonical unit: mm) ---
  /** Minor axis of the elliptical stain. */
  width: number;
  /** Major axis of the elliptical stain. */
  length: number;
  /** Optional measured diameter for near-circular passive drops. */
  diameter?: number;

  /**
   * Directionality: the compass-style bearing (degrees) of the stain's long
   * axis pointing back toward the blood source, measured on the stain's plane.
   * 0° = +x (east / right), increasing counter-clockwise, matching standard
   * math convention used by the calculations module.
   */
  directionality?: number;

  // --- Wall-relative position measurements (canonical unit: mm) ---
  heightAboveFloor?: number;
  distanceFromLeftWall?: number;
  distanceFromRightWall?: number;
  distanceFromFrontWall?: number;
  distanceFromRearWall?: number;
  distanceFromCeiling?: number;

  notes?: string;
  photoIds?: string[];

  createdAt?: number;
  updatedAt?: number;
}

/** Values derived from a single stain's raw measurements. */
export interface StainCalculations {
  widthToLengthRatio: number;
  /** Angle of impact in degrees, or null when measurements are invalid. */
  impactAngleDeg: number | null;
  /** Resolved (x, y, z) position in room coordinates, when derivable. */
  position: Point3D | null;
}

// ---------------------------------------------------------------------------
// Case
// ---------------------------------------------------------------------------

export interface Party {
  name?: string;
  notes?: string;
}

export interface CasePhoto {
  id: string;
  storagePath: string;
  caption?: string;
  linkedStainIds?: string[];
  createdAt?: number;
}

/** A full investigation case — the top-level Firestore document. */
export interface Case {
  id: string;
  caseNumber: string;
  agency?: string;
  investigator?: string;
  date?: string; // ISO date
  location?: string;
  victim?: Party;
  suspect?: Party;
  notes?: string;

  unitSystem: UnitSystem;
  room?: Room;
  stains: Bloodstain[];
  photos?: CasePhoto[];

  ownerUid: string;
  createdAt?: number;
  updatedAt?: number;
  status?: 'active' | 'archived';
}

// ---------------------------------------------------------------------------
// Security / audit (contract for a future module)
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'investigator' | 'viewer';

export interface AuditLogEntry {
  id: string;
  caseId: string;
  actorUid: string;
  action: string;
  timestamp: number;
  detail?: Record<string, unknown>;
}
