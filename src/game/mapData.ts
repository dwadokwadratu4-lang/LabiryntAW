export interface TownNode {
  id: number;
  name: string;
  shortName: string;
  x: number;
  z: number;
  plaqueOffset: [number, number];
  isBorderExit?: boolean;
}

export interface RoadSegment {
  id: string;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  fromNode?: number;
  toNode?: number;
  kind: 'primary' | 'secondary';
  halfWidth: number;
}

export const BOARD_WIDTH = 25.6;
export const BOARD_DEPTH = 26.8;
export const WALL_HEIGHT = 0.56;
export const BEVEL_WIDTH = 0.16;
export const PLAZA_RADIUS = 0.92;
export const HOLE_RADIUS = 0.36;
export const BALL_RADIUS = 0.33;

// Zbiornik Racibórz Dolny (integrally unified with the Odra River channel)
export const ZBIORNIK_CENTER: [number, number] = [4.0, 6.4];
export const ZBIORNIK_RX = 2.25;
export const ZBIORNIK_RZ = 3.75;

export const TOWN_NODES: TownNode[] = [
  {
    id: 1,
    name: 'Kuźnia Raciborska',
    shortName: 'Kuźnia Rac.',
    x: 0.0,
    z: -7.2,
    plaqueOffset: [1.75, -1.22],
  },
  {
    id: 2,
    name: 'Rudy',
    shortName: 'Rudy',
    x: 6.7,
    z: -7.2,
    plaqueOffset: [1.9, -0.45],
  },
  {
    id: 3,
    name: 'Nędza',
    shortName: 'Nędza',
    x: 0.0,
    z: -3.6,
    plaqueOffset: [1.75, -0.78],
  },
  {
    id: 4,
    name: 'Rudnik',
    shortName: 'Rudnik',
    x: -3.4,
    z: -3.6,
    plaqueOffset: [0.0, -1.38],
  },
  {
    id: 5,
    name: 'Modzurów',
    shortName: 'Modzurów',
    x: -6.4,
    z: -7.2,
    plaqueOffset: [-0.2, -1.4],
  },
  {
    id: 6,
    name: 'Pawłów',
    shortName: 'Pawłów',
    x: -6.4,
    z: -3.6,
    plaqueOffset: [1.45, -1.25],
  },
  {
    id: 7,
    name: 'Pietrowice Wielkie',
    shortName: 'Pietrowice W.',
    x: -6.4,
    z: 0.0,
    plaqueOffset: [-1.4, 1.48],
  },
  {
    id: 8,
    name: 'Krzanowice',
    shortName: 'Krzanowice',
    x: -3.2,
    z: 3.85,
    plaqueOffset: [-1.5, 1.38],
  },
  {
    id: 9,
    name: 'Racibórz',
    shortName: 'Racibórz',
    x: 0.0,
    z: 0.0,
    plaqueOffset: [2.15, 1.08],
  },
  {
    id: 10,
    name: 'Kornowac',
    shortName: 'Kornowac',
    x: 6.2,
    z: 0.0,
    plaqueOffset: [0.2, -1.38],
  },
  {
    id: 11,
    name: 'Tworków',
    shortName: 'Tworków',
    x: 0.0,
    z: 3.3,
    plaqueOffset: [-1.45, -1.05],
  },
  {
    id: 12,
    name: 'Krzyżanowice',
    shortName: 'Krzyżanowice',
    x: 0.0,
    z: 6.7,
    plaqueOffset: [-1.62, -0.82],
  },
  {
    id: 13,
    name: 'Chałupki',
    shortName: 'Chałupki',
    x: 0.0,
    z: 9.8,
    plaqueOffset: [-2.05, 0.1],
  },
  {
    id: 14,
    name: 'Granica PL/CZ (zach.)',
    shortName: 'Granica PL/CZ',
    x: -10.0,
    z: 5.2,
    plaqueOffset: [0.3, -1.4],
    isBorderExit: true,
  },
  {
    id: 15,
    name: 'Granica PL/CZ (płd.)',
    shortName: 'Granica PL/CZ',
    x: 0.0,
    z: 11.9,
    plaqueOffset: [2.15, 0.25],
    isBorderExit: true,
  },
  {
    id: 16,
    name: 'kier. Kędzierzyn-Koźle',
    shortName: 'kier. K-Koźle',
    x: -10.0,
    z: -9.6,
    plaqueOffset: [2.6, -0.25],
    isBorderExit: true,
  },
  {
    id: 17,
    name: 'kier. Gliwice',
    shortName: 'kier. Gliwice',
    x: 6.7,
    z: -9.8,
    plaqueOffset: [2.55, -0.15],
    isBorderExit: true,
  },
  {
    id: 18,
    name: 'kier. Rybnik',
    shortName: 'kier. Rybnik',
    x: 10.2,
    z: 0.0,
    plaqueOffset: [-0.25, 1.4],
    isBorderExit: true,
  },
  {
    id: 19,
    name: 'kier. Głubczyce',
    shortName: 'kier. Głubczyce',
    x: -10.3,
    z: 0.0,
    plaqueOffset: [0.1, 1.35],
    isBorderExit: true,
  },
];

export const NODE_MAP = new Map<number, TownNode>(
  TOWN_NODES.map((n) => [n.id, n])
);

const WP_6_7_WEST: [number, number] = [-8.5, -1.8];
const WP_7_8_9_14: [number, number] = [-4.8, 1.25];
const WP_2_SOUTH: [number, number] = [6.7, -3.2];
const WP_9_NORTH: [number, number] = [0.0, -1.7];
const WP_SW_LOOP: [number, number] = [-2.9, 8.2];

export const WAYPOINTS: [number, number][] = [
  WP_6_7_WEST,
  WP_7_8_9_14,
  WP_2_SOUTH,
  WP_9_NORTH,
  WP_SW_LOOP,
];

function nodeSeg(
  id: string,
  aId: number,
  bId: number,
  kind: 'primary' | 'secondary'
): RoadSegment {
  const a = NODE_MAP.get(aId)!;
  const b = NODE_MAP.get(bId)!;
  return {
    id,
    ax: a.x,
    az: a.z,
    bx: b.x,
    bz: b.z,
    fromNode: aId,
    toNode: bId,
    kind,
    halfWidth: kind === 'primary' ? 0.62 : 0.45,
  };
}

function pointSeg(
  id: string,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  kind: 'primary' | 'secondary',
  fromNode?: number,
  toNode?: number
): RoadSegment {
  return {
    id,
    ax,
    az,
    bx,
    bz,
    fromNode,
    toNode,
    kind,
    halfWidth: kind === 'primary' ? 0.62 : 0.45,
  };
}

const n2 = NODE_MAP.get(2)!;
const n3 = NODE_MAP.get(3)!;
const n6 = NODE_MAP.get(6)!;
const n7 = NODE_MAP.get(7)!;
const n8 = NODE_MAP.get(8)!;
const n9 = NODE_MAP.get(9)!;
const n11 = NODE_MAP.get(11)!;
const n12 = NODE_MAP.get(12)!;
const n14 = NODE_MAP.get(14)!;

export const ROAD_SEGMENTS: RoadSegment[] = [
  // Top-left diagonal: 16 - 5 - 4 - 9
  nodeSeg('16-5', 16, 5, 'primary'),
  nodeSeg('5-4', 5, 4, 'primary'),
  nodeSeg('4-9', 4, 9, 'primary'),

  // West chain: 5 - 6 - 7 + lateral loop 6 - WP_6_7_WEST - 7 + ONLY exit 7 - 19 (kier. Głubczyce)
  nodeSeg('5-6', 5, 6, 'primary'),
  nodeSeg('6-7', 6, 7, 'primary'),
  nodeSeg('7-19', 7, 19, 'primary'),
  pointSeg('6-w67', n6.x, n6.z, WP_6_7_WEST[0], WP_6_7_WEST[1], 'primary', 6, undefined),
  pointSeg('w67-7', WP_6_7_WEST[0], WP_6_7_WEST[1], n7.x, n7.z, 'primary', undefined, 7),

  // South-west hub: 7 - WP - 8, 14 - WP - 9, 8 - 9, 8 - 11
  pointSeg('7-w78', n7.x, n7.z, WP_7_8_9_14[0], WP_7_8_9_14[1], 'primary', 7, undefined),
  pointSeg('w78-8', WP_7_8_9_14[0], WP_7_8_9_14[1], n8.x, n8.z, 'primary', undefined, 8),
  pointSeg('14-w78', n14.x, n14.z, WP_7_8_9_14[0], WP_7_8_9_14[1], 'primary', 14, undefined),
  pointSeg('w78-9', WP_7_8_9_14[0], WP_7_8_9_14[1], n9.x, n9.z, 'primary', undefined, 9),
  nodeSeg('8-9', 8, 9, 'primary'),
  nodeSeg('8-11', 8, 11, 'primary'),

  // North-east: 1 - 2, 17 - 2, 2 - WP_2_SOUTH - WP_9_NORTH
  nodeSeg('1-2', 1, 2, 'primary'),
  nodeSeg('17-2', 17, 2, 'primary'),
  pointSeg('2-w2s', n2.x, n2.z, WP_2_SOUTH[0], WP_2_SOUTH[1], 'primary', 2, undefined),
  pointSeg('w2s-w9n', WP_2_SOUTH[0], WP_2_SOUTH[1], WP_9_NORTH[0], WP_9_NORTH[1], 'primary'),

  // Central North-South spine: 1 - 3 - WP_9_NORTH - 9 - 11 - 12 - 13 - 15
  nodeSeg('1-3', 1, 3, 'primary'),
  pointSeg('3-w9n', n3.x, n3.z, WP_9_NORTH[0], WP_9_NORTH[1], 'primary', 3, undefined),
  pointSeg('w9n-9', WP_9_NORTH[0], WP_9_NORTH[1], n9.x, n9.z, 'primary', undefined, 9),
  nodeSeg('9-11', 9, 11, 'primary'),
  nodeSeg('11-12', 11, 12, 'primary'),
  nodeSeg('12-13', 12, 13, 'primary'),
  nodeSeg('13-15', 13, 15, 'primary'),

  // East axis: 9 - 10 - 18
  nodeSeg('9-10', 9, 10, 'primary'),
  nodeSeg('10-18', 10, 18, 'primary'),

  // Secondary county connections (dashed)
  nodeSeg('4-3', 4, 3, 'secondary'),
  pointSeg('11-wsw', n11.x, n11.z, WP_SW_LOOP[0], WP_SW_LOOP[1], 'secondary', 11, undefined),
  pointSeg('wsw-12', WP_SW_LOOP[0], WP_SW_LOOP[1], n12.x, n12.z, 'secondary', undefined, 12),
];

// Decorative dashed border stubs from the diagram
export const DECORATIVE_DASHED_STUBS: Array<[number, number, number, number]> = [
  [0.0, -7.2, 0.0, -10.8],
  [-3.4, -3.6, -6.0, -10.6],
  [-8.5, -1.8, -11.2, -3.4],
  [-3.2, 3.85, -11.0, 8.2],
  [-2.9, 8.2, -11.0, 11.4],
  [-2.9, 8.2, -5.2, 11.6],
  [6.7, -7.2, 11.2, -7.2],
  [6.7, -3.2, 11.2, -3.2],
];

// Stylized contour of Powiat Raciborski
export const COUNTY_POLYGON: [number, number][] = [
  [-11.3, -10.9],
  [-5.2, -10.3],
  [0.2, -10.9],
  [8.6, -11.1],
  [10.8, -7.8],
  [9.6, -3.4],
  [11.4, -1.8],
  [11.4, 1.7],
  [9.4, 3.4],
  [9.2, 8.6],
  [6.5, 11.4],
  [2.2, 12.6],
  [-1.8, 12.6],
  [-4.6, 10.6],
  [-11.1, 10.6],
  [-11.3, 4.6],
  [-11.6, 1.6],
  [-11.6, -2.0],
  [-10.4, -5.4],
  [-9.5, -7.5],
];

// Corrected Odra River path: flows south->north directly through Zbiornik Racibórz Dolny,
// then passes west of 9 Racibórz, 3 Nędza, and 1 Kuźnia Raciborska.
export const ODRA_RIVER_POINTS: [number, number][] = [
  [2.3, 12.9],
  [3.35, 10.6],
  [3.95, 8.4],
  [3.95, 6.2],
  [3.3, 3.6],
  [1.95, 2.35],
  [0.0, 1.85],
  [-1.48, 1.78],
  [-1.56, 0.41],
  [-1.52, -0.55],
  [-1.55, -1.64],
  [-1.65, -3.6],
  [-1.75, -5.8],
  [-1.82, -8.2],
  [-1.72, -10.8],
  [-1.62, -12.9],
];

export interface RiverBridge {
  x: number;
  z: number;
  angleY: number;
  length: number;
  width: number;
}

export const RIVER_BRIDGES: RiverBridge[] = [
  // Crossing 9 - 11
  {
    x: 0.0,
    z: 1.85,
    angleY: -Math.PI / 2,
    length: 1.75,
    width: 1.28,
  },
  // Crossing 8 - 9
  {
    x: -1.48,
    z: 1.78,
    angleY: -Math.atan2(-3.85, 3.2),
    length: 1.8,
    width: 1.28,
  },
  // Crossing WP_7_8_9_14 - 9
  {
    x: -1.56,
    z: 0.41,
    angleY: -Math.atan2(-1.25, 4.8),
    length: 1.75,
    width: 1.28,
  },
  // Crossing 4 - 9
  {
    x: -1.55,
    z: -1.64,
    angleY: -Math.atan2(3.6, 3.4),
    length: 1.8,
    width: 1.28,
  },
  // Crossing 4 - 3 (secondary county road)
  {
    x: -1.65,
    z: -3.6,
    angleY: 0,
    length: 1.75,
    width: 1.05,
  },
];

export function distToSegmentSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const c1 = wx * vx + wz * vz;
  if (c1 <= 0) return wx * wx + wz * wz;
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) {
    const dx = px - bx;
    const dz = pz - bz;
    return dx * dx + dz * dz;
  }
  const t = c1 / c2;
  const projX = ax + t * vx;
  const projZ = az + t * vz;
  const dx = px - projX;
  const dz = pz - projZ;
  return dx * dx + dz * dz;
}

export function evaluateGrooveSDF(x: number, z: number): number {
  let minD = 999;

  for (let i = 0; i < ROAD_SEGMENTS.length; i++) {
    const s = ROAD_SEGMENTS[i];
    const d = Math.sqrt(distToSegmentSq(x, z, s.ax, s.az, s.bx, s.bz)) - s.halfWidth;
    if (d < minD) minD = d;
  }

  for (let i = 0; i < TOWN_NODES.length; i++) {
    const n = TOWN_NODES[i];
    const d = Math.hypot(x - n.x, z - n.z) - PLAZA_RADIUS;
    if (d < minD) minD = d;
  }

  for (let i = 0; i < WAYPOINTS.length; i++) {
    const [wx, wz] = WAYPOINTS[i];
    const d = Math.hypot(x - wx, z - wz) - 0.68;
    if (d < minD) minD = d;
  }

  return minD;
}

export function evaluateGrooveGradient(x: number, z: number): [number, number] {
  const eps = 0.012;
  const dx = evaluateGrooveSDF(x + eps, z) - evaluateGrooveSDF(x - eps, z);
  const dz = evaluateGrooveSDF(x, z + eps) - evaluateGrooveSDF(x, z - eps);
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}

export function evaluateCountyPolygonSDF(px: number, pz: number): number {
  const poly = COUNTY_POLYGON;
  let d2 = Infinity;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    const segD2 = distToSegmentSq(px, pz, xj, zj, xi, zi);
    if (segD2 < d2) d2 = segD2;
    const intersect =
      zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  const d = Math.sqrt(d2);
  return inside ? -d : d;
}

export function evaluateOdraRiverDist(px: number, pz: number): number {
  let minD2 = Infinity;
  for (let i = 0; i < ODRA_RIVER_POINTS.length - 1; i++) {
    const [ax, az] = ODRA_RIVER_POINTS[i];
    const [bx, bz] = ODRA_RIVER_POINTS[i + 1];
    const d2 = distToSegmentSq(px, pz, ax, az, bx, bz);
    if (d2 < minD2) minD2 = d2;
  }
  return Math.sqrt(minD2);
}

export function evaluateZbiornikSDF(px: number, pz: number): number {
  const nx = (px - ZBIORNIK_CENTER[0]) / ZBIORNIK_RX;
  const nz = (pz - ZBIORNIK_CENTER[1]) / ZBIORNIK_RZ;
  const r = Math.hypot(nx, nz);
  return (r - 1.0) * Math.min(ZBIORNIK_RX, ZBIORNIK_RZ);
}

/**
 * Checks whether (x, z) is inside the Lasy Rudzkie forest zone (NE & E: 1, 2, 3, 10, 17, 18)
 */
export function isInLasyRudzkieZone(x: number, z: number): boolean {
  return x >= -1.0 && z <= 1.6 && x <= 10.8 && z >= -10.8;
}

// Compute BFS hop distance between any two town nodes
const adjacency = new Map<number, Set<number>>();
for (const n of TOWN_NODES) adjacency.set(n.id, new Set());
for (const s of ROAD_SEGMENTS) {
  if (s.fromNode && s.toNode) {
    adjacency.get(s.fromNode)!.add(s.toNode);
    adjacency.get(s.toNode)!.add(s.fromNode);
  }
}
const addEdge = (a: number, b: number) => {
  adjacency.get(a)!.add(b);
  adjacency.get(b)!.add(a);
};
addEdge(6, 7);
addEdge(7, 8);
addEdge(14, 8);
addEdge(14, 9);
addEdge(7, 9);
addEdge(2, 3);
addEdge(2, 9);
addEdge(3, 9);
addEdge(11, 12);

export function getHopDistance(startId: number, endId: number): number {
  if (startId === endId) return 0;
  const visited = new Set<number>([startId]);
  const queue: [number, number][] = [[startId, 0]];
  while (queue.length > 0) {
    const [curr, dist] = queue.shift()!;
    for (const next of adjacency.get(curr) ?? []) {
      if (next === endId) return dist + 1;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, dist + 1]);
      }
    }
  }
  return 99;
}

export function pickRandomRoute(excludeStart?: number): { startId: number; targetId: number } {
  const candidates = TOWN_NODES.map((n) => n.id);
  for (let attempt = 0; attempt < 60; attempt++) {
    const startId = candidates[Math.floor(Math.random() * candidates.length)];
    if (excludeStart && startId === excludeStart && attempt < 20) continue;
    const targetId = candidates[Math.floor(Math.random() * candidates.length)];
    const hops = getHopDistance(startId, targetId);
    if (hops >= 2 && hops <= 6) {
      return { startId, targetId };
    }
  }
  return { startId: 1, targetId: 13 };
}

export interface CourierMission {
  ballKey: 'gold' | 'silver' | 'copper';
  label: string;
  startId: number;
  targetId: number;
  colorHex: number;
  uiColor: string;
}

export function pickThreeCourierRoutes(): CourierMission[] {
  const pool = [...TOWN_NODES.map((n) => n.id)].sort(() => Math.random() - 0.5);
  const starts = [pool[0], pool[1], pool[2]];
  const targets = [pool[3], pool[4], pool[5]];

  for (let i = 0; i < 3; i++) {
    if (getHopDistance(starts[i], targets[i]) < 2) {
      targets[i] = pool[(i + 6) % pool.length];
    }
  }

  return [
    {
      ballKey: 'gold',
      label: 'Złota',
      startId: starts[0],
      targetId: targets[0],
      colorHex: 0xf4c430,
      uiColor: '#eab308',
    },
    {
      ballKey: 'silver',
      label: 'Srebrna',
      startId: starts[1],
      targetId: targets[1],
      colorHex: 0xd8e2ec,
      uiColor: '#94a3b8',
    },
    {
      ballKey: 'copper',
      label: 'Miedziana',
      startId: starts[2],
      targetId: targets[2],
      colorHex: 0xd97736,
      uiColor: '#ea580c',
    },
  ];
}
