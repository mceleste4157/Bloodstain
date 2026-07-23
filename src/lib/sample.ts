/**
 * A sample case used by the demo view and as a fixture during development.
 * Three floor stains whose directionalities converge near the room center, plus
 * one wall stain to exercise the elevation view. All lengths in millimeters.
 */

import type { Case } from '@/types';

export const sampleCase: Case = {
  id: 'demo-case',
  caseNumber: '2026-BPA-0001',
  agency: 'Demo County Sheriff',
  investigator: 'Det. A. Rivera',
  date: '2026-07-23',
  location: 'Living room, 14 Elm St.',
  victim: { name: 'John Doe' },
  suspect: { name: 'Unknown' },
  notes: 'Sample scene for demonstrating automatic calculations and sketching.',
  unitSystem: 'metric',
  ownerUid: 'demo',
  status: 'active',
  room: {
    width: 4000,
    length: 3000,
    height: 2600,
    doors: [{ id: 'd1', wall: 'south', offset: 1600, width: 900 }],
    windows: [{ id: 'w1', wall: 'north', offset: 2800, width: 1000, sill: 900 }],
    furniture: [
      { id: 'f1', label: 'Sofa', position: { x: 200, y: 200 }, width: 1800, depth: 800 },
      { id: 'f2', label: 'Table', position: { x: 1600, y: 1900 }, width: 900, depth: 600 },
    ],
  },
  stains: [
    {
      id: 's1',
      stainId: 'BS-001',
      surface: 'floor',
      description: 'Elongated spatter, left side.',
      width: 5,
      length: 10, // 30° impact
      directionality: 45,
      distanceFromLeftWall: 1000,
      distanceFromFrontWall: 500,
      heightAboveFloor: 0,
    },
    {
      id: 's2',
      stainId: 'BS-002',
      surface: 'floor',
      description: 'Spatter, right side.',
      width: 6,
      length: 10, // ~37° impact
      directionality: 135,
      distanceFromLeftWall: 3000,
      distanceFromFrontWall: 500,
      heightAboveFloor: 0,
    },
    {
      id: 's3',
      stainId: 'BS-003',
      surface: 'floor',
      description: 'Spatter, rear.',
      width: 7,
      length: 10, // ~44° impact
      directionality: 270,
      distanceFromLeftWall: 2000,
      distanceFromFrontWall: 2500,
      heightAboveFloor: 0,
    },
    {
      id: 's4',
      stainId: 'BS-004',
      surface: 'north-wall',
      description: 'Cast-off on north wall.',
      width: 6,
      length: 12, // 30° impact
      directionality: 20,
      distanceFromLeftWall: 1500,
      heightAboveFloor: 1200,
    },
  ],
};
