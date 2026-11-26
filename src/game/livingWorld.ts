import * as THREE from 'three';
import {
  BALL_RADIUS,
  ROAD_SEGMENTS,
  TOWN_NODES,
  ZBIORNIK_CENTER,
  evaluateCountyPolygonSDF,
  evaluateGrooveSDF,
  evaluateOdraRiverDist,
  evaluateZbiornikSDF,
  isInLasyRudzkieZone,
} from './mapData';
import { sampleBoardHeight } from './boardBuilder';
import { soundEngine } from './soundEngine';

export interface InteractableHit {
  type: 'yacht' | 'car' | 'animal';
  index: number;
}

export interface LivingWorldController {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  update: (
    dt: number,
    elapsed: number,
    balls: Array<{ x: number; z: number; vx: number; vz: number; state: string }>
  ) => void;
  handleTap: (hit: InteractableHit) => void;
  dispose: () => void;
}

// Zamek Piastowski moved to upper-left of 9 Racibórz, right along the Odra riverbank
const CASTLE_POS: [number, number] = [-2.42, -0.52];
const ABBEY_POS: [number, number] = [4.95, -5.65];

function isClearOfPlaquesAndLandmarks(x: number, z: number): boolean {
  if (Math.hypot(x - CASTLE_POS[0], z - CASTLE_POS[1]) < 1.35) return false;
  if (Math.hypot(x - ABBEY_POS[0], z - ABBEY_POS[1]) < 1.25) return false;
  for (const n of TOWN_NODES) {
    const px = n.x + n.plaqueOffset[0];
    const pz = n.z + n.plaqueOffset[1];
    if (Math.abs(x - px) < 1.45 && Math.abs(z - pz) < 0.65) return false;
  }
  if (Math.abs(x - ZBIORNIK_CENTER[0]) < 1.8 && Math.abs(z - ZBIORNIK_CENTER[1]) < 0.7) {
    return false;
  }
  return true;
}

function buildLasyRudzkie(disposables: Array<{ dispose: () => void }>): THREE.Group {
  const forestGroup = new THREE.Group();

  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  interface TreeSpot {
    x: number;
    y: number;
    z: number;
    scale: number;
    kind: 'spruce' | 'broadleaf';
  }
  const spots: TreeSpot[] = [];

  for (let i = 0; i < 1900 && spots.length < 135; i++) {
    const x = -1.0 + rand() * 11.7;
    const z = -10.7 + rand() * 12.2;
    if (!isInLasyRudzkieZone(x, z)) continue;
    if (evaluateCountyPolygonSDF(x, z) > -0.45) continue;
    if (evaluateGrooveSDF(x, z) < 0.44) continue;
    if (evaluateOdraRiverDist(x, z) < 0.78) continue;
    if (evaluateZbiornikSDF(x, z) < 0.5) continue;
    if (!isClearOfPlaquesAndLandmarks(x, z)) continue;

    let tooClose = false;
    for (const s of spots) {
      if (Math.hypot(x - s.x, z - s.z) < 0.54) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const y = sampleBoardHeight(x, z);
    spots.push({
      x,
      y,
      z,
      scale: 0.85 + rand() * 0.34,
      kind: rand() < 0.72 ? 'spruce' : 'broadleaf',
    });
  }

  const spruces = spots.filter((s) => s.kind === 'spruce');
  const broadleafs = spots.filter((s) => s.kind === 'broadleaf');

  const trunkGeo = new THREE.CylinderGeometry(0.055, 0.085, 0.34, 7);
  trunkGeo.translate(0, 0.17, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4f301b, roughness: 0.88 });

  const cone1Geo = new THREE.ConeGeometry(0.28, 0.56, 7);
  cone1Geo.translate(0, 0.5, 0);
  const cone2Geo = new THREE.ConeGeometry(0.21, 0.46, 7);
  cone2Geo.translate(0, 0.76, 0);
  const spruceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    flatShading: true,
  });

  const crownGeo = new THREE.DodecahedronGeometry(0.27, 0);
  crownGeo.translate(0, 0.52, 0);
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    flatShading: true,
  });

  disposables.push(trunkGeo, trunkMat, cone1Geo, cone2Geo, spruceMat, crownGeo, crownMat);

  const allTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  allTrunks.castShadow = true;
  allTrunks.receiveShadow = true;

  const spruceLower = new THREE.InstancedMesh(cone1Geo, spruceMat, Math.max(1, spruces.length));
  const spruceUpper = new THREE.InstancedMesh(cone2Geo, spruceMat, Math.max(1, spruces.length));
  spruceLower.castShadow = true;
  spruceLower.receiveShadow = true;
  spruceUpper.castShadow = true;
  spruceUpper.receiveShadow = true;

  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, Math.max(1, broadleafs.length));
  crowns.castShadow = true;
  crowns.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  spots.forEach((s, idx) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    allTrunks.setMatrixAt(idx, dummy.matrix);
  });
  allTrunks.instanceMatrix.needsUpdate = true;
  allTrunks.computeBoundingSphere();
  forestGroup.add(allTrunks);

  const spruceColors = [0x245932, 0x2c6b3b, 0x1e4d2b, 0x337542];
  spruces.forEach((s, idx) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, (idx * 1.7) % (Math.PI * 2), 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    spruceLower.setMatrixAt(idx, dummy.matrix);
    spruceUpper.setMatrixAt(idx, dummy.matrix);
    color.setHex(spruceColors[idx % spruceColors.length]);
    spruceLower.setColorAt(idx, color);
    spruceUpper.setColorAt(idx, color.clone().offsetHSL(0, 0, 0.04));
  });
  spruceLower.instanceMatrix.needsUpdate = true;
  spruceUpper.instanceMatrix.needsUpdate = true;
  if (spruceLower.instanceColor) spruceLower.instanceColor.needsUpdate = true;
  if (spruceUpper.instanceColor) spruceUpper.instanceColor.needsUpdate = true;
  spruceLower.computeBoundingSphere();
  spruceUpper.computeBoundingSphere();
  if (spruces.length > 0) forestGroup.add(spruceLower, spruceUpper);

  const leafColors = [0x4c8a36, 0x5c9a3d, 0x3e782d, 0x6ea644];
  broadleafs.forEach((s, idx) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, (idx * 2.1) % (Math.PI * 2), 0);
    dummy.scale.set(s.scale, s.scale * 1.05, s.scale);
    dummy.updateMatrix();
    crowns.setMatrixAt(idx, dummy.matrix);
    color.setHex(leafColors[idx % leafColors.length]);
    crowns.setColorAt(idx, color);
  });
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  crowns.computeBoundingSphere();
  if (broadleafs.length > 0) forestGroup.add(crowns);

  return forestGroup;
}

function buildLandmarks(disposables: Array<{ dispose: () => void }>): THREE.Group {
  const landmarks = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa69d8e, roughness: 0.85 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc8, roughness: 0.75 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xab4834, roughness: 0.65 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x4f2b16, roughness: 0.72 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x9c3020, roughness: 0.56 });
  const shingleMat = new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.78 });
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4c430,
    metalness: 0.92,
    roughness: 0.2,
  });
  disposables.push(stoneMat, plasterMat, brickMat, timberMat, roofMat, shingleMat, goldMat);

  // 1. Urokliwy Zamek Piastowski po LEWEJ stronie u góry od 9 Racibórz (tuż nad Odrą)
  const castle = new THREE.Group();
  const cy = sampleBoardHeight(CASTLE_POS[0], CASTLE_POS[1]);
  castle.position.set(CASTLE_POS[0], cy, CASTLE_POS[1]);
  castle.rotation.y = -0.22;

  // Stone terrace base
  const cBaseGeo = new THREE.BoxGeometry(1.04, 0.14, 0.82);
  const cBase = new THREE.Mesh(cBaseGeo, stoneMat);
  cBase.position.y = 0.07;
  cBase.castShadow = true;
  cBase.receiveShadow = true;

  // Defensive castle courtyard walls
  const wallNSGeo = new THREE.BoxGeometry(0.96, 0.28, 0.08);
  const wallN = new THREE.Mesh(wallNSGeo, brickMat);
  wallN.position.set(0, 0.24, -0.34);
  wallN.castShadow = true;

  const wallS = new THREE.Mesh(wallNSGeo, brickMat);
  wallS.position.set(0, 0.24, 0.34);
  wallS.castShadow = true;

  const wallWGeo = new THREE.BoxGeometry(0.08, 0.28, 0.76);
  const wallW = new THREE.Mesh(wallWGeo, brickMat);
  wallW.position.set(-0.44, 0.24, 0);
  wallW.castShadow = true;

  // Main Piast Palace wing (Dom Książęcy)
  const wingGeo = new THREE.BoxGeometry(0.56, 0.42, 0.34);
  const wing = new THREE.Mesh(wingGeo, plasterMat);
  wing.position.set(-0.08, 0.35, -0.14);
  wing.castShadow = true;
  wing.receiveShadow = true;

  const wingRoofShape = new THREE.Shape();
  wingRoofShape.moveTo(-0.2, 0);
  wingRoofShape.lineTo(0.2, 0);
  wingRoofShape.lineTo(0, 0.22);
  wingRoofShape.closePath();
  const wingRoofGeo = new THREE.ExtrudeGeometry(wingRoofShape, { depth: 0.6, bevelEnabled: false });
  wingRoofGeo.rotateY(Math.PI / 2);
  wingRoofGeo.translate(-0.38, 0.56, -0.14);
  const wingRoof = new THREE.Mesh(wingRoofGeo, roofMat);
  wingRoof.castShadow = true;

  // Gatehouse facing Odra River on the east side
  const gateGeo = new THREE.BoxGeometry(0.22, 0.44, 0.26);
  const gate = new THREE.Mesh(gateGeo, brickMat);
  gate.position.set(0.36, 0.34, 0.14);
  gate.castShadow = true;

  const gateRoofGeo = new THREE.ConeGeometry(0.2, 0.24, 4);
  gateRoofGeo.rotateY(Math.PI / 4);
  const gateRoof = new THREE.Mesh(gateRoofGeo, roofMat);
  gateRoof.position.set(0.36, 0.68, 0.14);
  gateRoof.castShadow = true;

  // Corner castle tower / keep
  const cTowerGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.72, 10);
  const cTower = new THREE.Mesh(cTowerGeo, brickMat);
  cTower.position.set(0.3, 0.5, -0.2);
  cTower.castShadow = true;

  const cTurretGeo = new THREE.ConeGeometry(0.2, 0.36, 10);
  const cTurret = new THREE.Mesh(cTurretGeo, roofMat);
  cTurret.position.set(0.3, 1.04, -0.2);
  cTurret.castShadow = true;

  const cSpireGeo = new THREE.CylinderGeometry(0.012, 0.02, 0.16, 8);
  const cSpire = new THREE.Mesh(cSpireGeo, goldMat);
  cSpire.position.set(0.3, 1.28, -0.2);

  castle.add(
    cBase,
    wallN,
    wallS,
    wallW,
    wing,
    wingRoof,
    gate,
    gateRoof,
    cTower,
    cTurret,
    cSpire
  );
  landmarks.add(castle);
  disposables.push(
    cBaseGeo,
    wallNSGeo,
    wallWGeo,
    wingGeo,
    wingRoofGeo,
    gateGeo,
    gateRoofGeo,
    cTowerGeo,
    cTurretGeo,
    cSpireGeo
  );

  // 2. Zabytkowy drewniany kościółek / Opactwo przy węźle 2 Rudy
  const abbey = new THREE.Group();
  const ay = sampleBoardHeight(ABBEY_POS[0], ABBEY_POS[1]);
  abbey.position.set(ABBEY_POS[0], ay, ABBEY_POS[1]);

  const aFoundGeo = new THREE.BoxGeometry(0.92, 0.12, 0.58);
  const aFound = new THREE.Mesh(aFoundGeo, stoneMat);
  aFound.position.y = 0.06;
  aFound.castShadow = true;
  aFound.receiveShadow = true;

  const aNaveGeo = new THREE.BoxGeometry(0.76, 0.38, 0.46);
  const aNave = new THREE.Mesh(aNaveGeo, timberMat);
  aNave.position.set(0.06, 0.31, 0);
  aNave.castShadow = true;
  aNave.receiveShadow = true;

  const aRoofShape = new THREE.Shape();
  aRoofShape.moveTo(-0.27, 0);
  aRoofShape.lineTo(0.27, 0);
  aRoofShape.lineTo(0, 0.28);
  aRoofShape.closePath();
  const aRoofGeo = new THREE.ExtrudeGeometry(aRoofShape, { depth: 0.8, bevelEnabled: false });
  aRoofGeo.rotateY(Math.PI / 2);
  aRoofGeo.translate(-0.34, 0.5, 0);
  const aRoof = new THREE.Mesh(aRoofGeo, shingleMat);
  aRoof.castShadow = true;

  const aTowerGeo = new THREE.BoxGeometry(0.28, 0.72, 0.28);
  const aTower = new THREE.Mesh(aTowerGeo, timberMat);
  aTower.position.set(-0.32, 0.48, 0);
  aTower.castShadow = true;

  const aSteepleGeo = new THREE.ConeGeometry(0.22, 0.42, 4);
  aSteepleGeo.rotateY(Math.PI / 4);
  const aSteeple = new THREE.Mesh(aSteepleGeo, shingleMat);
  aSteeple.position.set(-0.32, 1.04, 0);
  aSteeple.castShadow = true;

  const aCrossVGeo = new THREE.BoxGeometry(0.03, 0.16, 0.03);
  const aCrossHGeo = new THREE.BoxGeometry(0.1, 0.03, 0.03);
  const aCrossV = new THREE.Mesh(aCrossVGeo, goldMat);
  aCrossV.position.set(-0.32, 1.3, 0);
  const aCrossH = new THREE.Mesh(aCrossHGeo, goldMat);
  aCrossH.position.set(-0.32, 1.33, 0);

  abbey.add(aFound, aNave, aRoof, aTower, aSteeple, aCrossV, aCrossH);
  landmarks.add(abbey);
  disposables.push(
    aFoundGeo,
    aNaveGeo,
    aRoofGeo,
    aTowerGeo,
    aSteepleGeo,
    aCrossVGeo,
    aCrossHGeo
  );

  return landmarks;
}

// Unified water cruise routes across Odra River and Zbiornik Racibórz Dolny
const YACHT_PATHS: Array<Array<[number, number]>> = [
  [
    [ZBIORNIK_CENTER[0] - 1.1, ZBIORNIK_CENTER[1] - 1.8],
    [ZBIORNIK_CENTER[0] + 1.2, ZBIORNIK_CENTER[1] - 1.1],
    [ZBIORNIK_CENTER[0] + 1.2, ZBIORNIK_CENTER[1] + 1.9],
    [ZBIORNIK_CENTER[0] - 0.8, ZBIORNIK_CENTER[1] + 2.2],
    [ZBIORNIK_CENTER[0] - 1.3, ZBIORNIK_CENTER[1] + 0.3],
  ],
  [
    [2.5, 11.7],
    [3.4, 9.6],
    [3.9, 6.2],
    [3.2, 3.6],
    [1.95, 2.35],
    [0.0, 1.85],
    [-1.48, 1.78],
    [0.0, 1.85],
    [1.95, 2.35],
    [3.4, 4.2],
    [3.8, 8.2],
  ],
  [
    [-1.53, -0.5],
    [-1.58, -2.6],
    [-1.7, -5.4],
    [-1.82, -8.8],
    [-1.72, -10.8],
    [-1.82, -8.8],
    [-1.7, -5.4],
    [-1.58, -2.6],
  ],
];

interface YachtEntity {
  group: THREE.Group;
  pathIdx: number;
  waypointIdx: number;
  t: number;
  speed: number;
  state: 'sailing' | 'sinking' | 'respawning';
  timer: number;
  baseY: number;
}

function createYachtGroup(
  index: number,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xb47b44, roughness: 0.55 });
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
  disposables.push(hullMat, deckMat, sailMat, mastMat);

  const hullGeo = new THREE.BoxGeometry(0.24, 0.12, 0.56);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 0.06;
  hull.castShadow = true;

  const bowGeo = new THREE.ConeGeometry(0.12, 0.22, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateX(Math.PI / 2);
  const bow = new THREE.Mesh(bowGeo, hullMat);
  bow.position.set(0, 0.06, 0.36);

  const cabinGeo = new THREE.BoxGeometry(0.16, 0.08, 0.24);
  const cabin = new THREE.Mesh(cabinGeo, deckMat);
  cabin.position.set(0, 0.15, -0.05);

  const mastGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.68, 8);
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 0.44, 0.04);

  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(0, 0.52);
  sailShape.lineTo(0.28, 0.05);
  sailShape.closePath();
  const sailGeo = new THREE.ShapeGeometry(sailShape);
  sailGeo.rotateY(Math.PI / 2);
  const mainSail = new THREE.Mesh(sailGeo, sailMat);
  mainSail.position.set(0, 0.2, 0.03);
  mainSail.castShadow = true;

  const jibShape = new THREE.Shape();
  jibShape.moveTo(0, 0);
  jibShape.lineTo(0, 0.42);
  jibShape.lineTo(-0.2, 0.02);
  jibShape.closePath();
  const jibGeo = new THREE.ShapeGeometry(jibShape);
  jibGeo.rotateY(Math.PI / 2);
  const jibSail = new THREE.Mesh(jibGeo, sailMat);
  jibSail.position.set(0, 0.18, 0.08);

  const hitGeo = new THREE.SphereGeometry(0.45, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = 0.25;
  hitMesh.userData.interactable = { type: 'yacht', index } as InteractableHit;

  g.add(hull, bow, cabin, mast, mainSail, jibSail, hitMesh);
  disposables.push(hullGeo, bowGeo, cabinGeo, mastGeo, sailGeo, jibGeo, hitGeo, hitMat);
  return g;
}

// Road waypoints for cars & blue TIR (graph nodes + diagram junction points)
const CAR_GRAPH_POINTS: Record<string, [number, number]> = {};
for (const n of TOWN_NODES) {
  CAR_GRAPH_POINTS[`n${n.id}`] = [n.x, n.z];
}
CAR_GRAPH_POINTS['w67'] = [-8.5, -1.8];
CAR_GRAPH_POINTS['w78'] = [-4.8, 1.25];
CAR_GRAPH_POINTS['w2s'] = [6.7, -3.2];
CAR_GRAPH_POINTS['w9n'] = [0.0, -1.7];
CAR_GRAPH_POINTS['wsw'] = [-2.9, 8.2];

const CAR_ADJACENCY: Record<string, string[]> = {};
for (const k of Object.keys(CAR_GRAPH_POINTS)) CAR_ADJACENCY[k] = [];
const linkKeys = (a: string, b: string) => {
  CAR_ADJACENCY[a].push(b);
  CAR_ADJACENCY[b].push(a);
};
for (const s of ROAD_SEGMENTS) {
  let ka = '';
  let kb = '';
  for (const [k, [px, pz]] of Object.entries(CAR_GRAPH_POINTS)) {
    if (Math.hypot(px - s.ax, pz - s.az) < 0.15) ka = k;
    if (Math.hypot(px - s.bx, pz - s.bz) < 0.15) kb = k;
  }
  if (ka && kb) linkKeys(ka, kb);
}

interface CarEntity {
  group: THREE.Group;
  fromKey: string;
  toKey: string;
  t: number;
  speed: number;
  x: number;
  z: number;
  pauseTimer: number;
  hornCooldown: number;
  blockedTimer: number;
}

function createCarGroup(
  index: number,
  bodyColor: number,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.3,
    metalness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  disposables.push(bodyMat, glassMat, tireMat, headMat);

  const chassisGeo = new THREE.BoxGeometry(0.32, 0.14, 0.58);
  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.position.y = 0.11;
  chassis.castShadow = true;

  const cabinGeo = new THREE.BoxGeometry(0.26, 0.12, 0.3);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.23, -0.02);
  cabin.castShadow = true;

  const roofGeo = new THREE.BoxGeometry(0.24, 0.03, 0.24);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(0, 0.295, -0.02);

  const wheelGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelCoords: [number, number][] = [
    [-0.16, 0.17],
    [0.16, 0.17],
    [-0.16, -0.17],
    [0.16, -0.17],
  ];
  for (const [wx, wz] of wheelCoords) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(wx, 0.065, wz);
    g.add(w);
  }

  const lightGeo = new THREE.BoxGeometry(0.07, 0.04, 0.03);
  const hl1 = new THREE.Mesh(lightGeo, headMat);
  hl1.position.set(-0.09, 0.11, 0.29);
  const hl2 = new THREE.Mesh(lightGeo, headMat);
  hl2.position.set(0.09, 0.11, 0.29);

  const hitGeo = new THREE.SphereGeometry(0.45, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = 0.2;
  hitMesh.userData.interactable = { type: 'car', index } as InteractableHit;

  g.add(chassis, cabin, roof, hl1, hl2, hitMesh);
  disposables.push(chassisGeo, cabinGeo, roofGeo, wheelGeo, lightGeo, hitGeo, hitMat);
  return g;
}

/**
 * Rear door texture for the Modzurów blue semi-truck (TIR):
 * intense blue doors with a clear red forklift silhouette emblem!
 */
function createTirRearDoorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Intense blue rear doors
  ctx.fillStyle = '#0f4cbd';
  ctx.fillRect(0, 0, 128, 128);

  // Door seam & silver latches
  ctx.strokeStyle = '#092d75';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 120);
  ctx.beginPath();
  ctx.moveTo(64, 6);
  ctx.lineTo(64, 122);
  ctx.stroke();

  // Bright red forklift symbol / patch in center-back
  ctx.fillStyle = '#ef4444';
  // Forklift body
  ctx.fillRect(28, 66, 44, 28);
  // Cab roof frame
  ctx.fillRect(36, 40, 26, 8);
  ctx.fillRect(36, 42, 7, 26);
  ctx.fillRect(56, 42, 7, 26);
  // Mast & forks on the right side
  ctx.fillRect(76, 30, 8, 66);
  ctx.fillRect(84, 84, 24, 7);
  ctx.fillRect(84, 70, 16, 6);
  // Wheels
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(38, 96, 10, 0, Math.PI * 2);
  ctx.arc(64, 96, 10, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const TIR_ROUTES: string[][] = [
  ['n5', 'n4', 'n9', 'n11', 'n12', 'n13', 'n15'], // Modzurów -> Chałupki -> Granica PL/CZ (płd.)
  ['n5', 'n6', 'n7', 'w78', 'n14'], // Modzurów -> Pietrowice -> Granica PL/CZ (zach.)
  ['n5', 'n4', 'n9', 'w78', 'n14'], // Modzurów -> Rudnik -> Racibórz -> Granica PL/CZ (zach.)
];

interface TirEntity {
  group: THREE.Group;
  routeIdx: number;
  segIdx: number;
  dir: 1 | -1;
  t: number;
  speed: number;
  x: number;
  z: number;
  pauseTimer: number;
  respawnTimer: number;
  hornCooldown: number;
  blockedTimer: number;
}

function createTirGroup(
  index: number,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();

  const blueCabMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.28,
    metalness: 0.35,
  });
  const blueTrailerMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.35,
    metalness: 0.2,
  });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const rearDoorTex = createTirRearDoorTexture();
  const rearDoorMat = new THREE.MeshStandardMaterial({
    map: rearDoorTex,
    roughness: 0.4,
  });
  disposables.push(blueCabMat, blueTrailerMat, glassMat, tireMat, headMat, rearDoorTex, rearDoorMat);

  // Tractor cab (front, +Z)
  const cabGeo = new THREE.BoxGeometry(0.36, 0.3, 0.34);
  const cab = new THREE.Mesh(cabGeo, blueCabMat);
  cab.position.set(0, 0.21, 0.38);
  cab.castShadow = true;

  const windGeo = new THREE.BoxGeometry(0.32, 0.11, 0.04);
  const wind = new THREE.Mesh(windGeo, glassMat);
  wind.position.set(0, 0.26, 0.545);

  const hlGeo = new THREE.BoxGeometry(0.08, 0.045, 0.03);
  const hl1 = new THREE.Mesh(hlGeo, headMat);
  hl1.position.set(-0.11, 0.11, 0.555);
  const hl2 = new THREE.Mesh(hlGeo, headMat);
  hl2.position.set(0.11, 0.11, 0.555);

  // Semi-trailer (-Z rear, with custom rear door material at index 5 (-Z face))
  const trailerGeo = new THREE.BoxGeometry(0.38, 0.36, 0.82);
  const trailer = new THREE.Mesh(trailerGeo, [
    blueTrailerMat, // +X
    blueTrailerMat, // -X
    blueTrailerMat, // +Y
    blueTrailerMat, // -Y
    blueTrailerMat, // +Z (front)
    rearDoorMat, // -Z (rear doors with red forklift icon!)
  ]);
  trailer.position.set(0, 0.25, -0.22);
  trailer.castShadow = true;

  // Red roof/side accent badge so the forklift motif is recognizable even from above
  const topMarkMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const topMarkGeo = new THREE.BoxGeometry(0.18, 0.02, 0.12);
  const topMark = new THREE.Mesh(topMarkGeo, topMarkMat);
  topMark.position.set(0, 0.435, -0.52);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.055, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wCoords: [number, number][] = [
    [-0.18, 0.42],
    [0.18, 0.42],
    [-0.18, -0.1],
    [0.18, -0.1],
    [-0.18, -0.46],
    [0.18, -0.46],
  ];
  for (const [wx, wz] of wCoords) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(wx, 0.07, wz);
    g.add(w);
  }

  const hitGeo = new THREE.SphereGeometry(0.58, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = 0.24;
  hitMesh.userData.interactable = { type: 'car', index } as InteractableHit;

  g.add(cab, wind, hl1, hl2, trailer, topMark, hitMesh);
  disposables.push(
    cabGeo,
    windGeo,
    hlGeo,
    trailerGeo,
    topMarkMat,
    topMarkGeo,
    wheelGeo,
    hitGeo,
    hitMat
  );
  return g;
}

interface AnimalEntity {
  group: THREE.Group;
  kind: 'deer' | 'sheep';
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  fleeing: boolean;
  hopPhase: number;
  waitTimer: number;
}

function createAnimalGroup(
  index: number,
  kind: 'deer' | 'sheep',
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'deer') {
    const furMat = new THREE.MeshStandardMaterial({ color: 0xb97a45, roughness: 0.8 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x291a10, roughness: 0.8 });
    disposables.push(furMat, tailMat, darkMat);

    const bodyGeo = new THREE.BoxGeometry(0.18, 0.17, 0.36);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.position.y = 0.22;
    body.castShadow = true;

    const neckGeo = new THREE.BoxGeometry(0.09, 0.18, 0.1);
    const neck = new THREE.Mesh(neckGeo, furMat);
    neck.position.set(0, 0.34, 0.14);
    neck.rotation.x = 0.25;
    neck.castShadow = true;

    const headGeo = new THREE.BoxGeometry(0.1, 0.1, 0.16);
    const head = new THREE.Mesh(headGeo, furMat);
    head.position.set(0, 0.43, 0.2);

    const earGeo = new THREE.ConeGeometry(0.03, 0.08, 4);
    const earL = new THREE.Mesh(earGeo, furMat);
    earL.position.set(-0.045, 0.5, 0.17);
    const earR = new THREE.Mesh(earGeo, furMat);
    earR.position.set(0.045, 0.5, 0.17);

    const tailGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(0, 0.26, -0.19);

    const legGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.16, 6);
    const legCoords: [number, number][] = [
      [-0.06, 0.12],
      [0.06, 0.12],
      [-0.06, -0.12],
      [0.06, -0.12],
    ];
    for (const [lx, lz] of legCoords) {
      const leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(lx, 0.08, lz);
      g.add(leg);
    }

    g.add(body, neck, head, earL, earR, tail);
    disposables.push(bodyGeo, neckGeo, headGeo, earGeo, tailGeo, legGeo);
  } else {
    const woolMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92 });
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x27201a, roughness: 0.8 });
    disposables.push(woolMat, faceMat);

    const woolGeo = new THREE.DodecahedronGeometry(0.18, 1);
    woolGeo.scale(0.95, 0.85, 1.2);
    const wool = new THREE.Mesh(woolGeo, woolMat);
    wool.position.y = 0.21;
    wool.castShadow = true;

    const headGeo = new THREE.SphereGeometry(0.085, 8, 8);
    const head = new THREE.Mesh(headGeo, faceMat);
    head.position.set(0, 0.24, 0.2);

    const earGeo = new THREE.BoxGeometry(0.06, 0.03, 0.04);
    const earL = new THREE.Mesh(earGeo, faceMat);
    earL.position.set(-0.08, 0.26, 0.18);
    const earR = new THREE.Mesh(earGeo, faceMat);
    earR.position.set(0.08, 0.26, 0.18);

    const legGeo = new THREE.CylinderGeometry(0.022, 0.02, 0.12, 6);
    const legCoords: [number, number][] = [
      [-0.07, 0.11],
      [0.07, 0.11],
      [-0.07, -0.11],
      [0.07, -0.11],
    ];
    for (const [lx, lz] of legCoords) {
      const leg = new THREE.Mesh(legGeo, faceMat);
      leg.position.set(lx, 0.06, lz);
      g.add(leg);
    }

    g.add(wool, head, earL, earR);
    disposables.push(woolGeo, headGeo, earGeo, legGeo);
  }

  const hitGeo = new THREE.SphereGeometry(0.42, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = 0.24;
  hitMesh.userData.interactable = { type: 'animal', index } as InteractableHit;
  g.add(hitMesh);
  disposables.push(hitGeo, hitMat);

  return g;
}

interface GooseBird {
  wingL: THREE.Group;
  wingR: THREE.Group;
  phaseOffset: number;
}

function createGeeseFlock(disposables: Array<{ dispose: () => void }>): {
  group: THREE.Group;
  birds: GooseBird[];
} {
  const flockGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4b4237, roughness: 0.75 });
  const neckMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.7 });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x5c5144,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  disposables.push(bodyMat, neckMat, cheekMat, wingMat);

  const bodyGeo = new THREE.ConeGeometry(0.075, 0.34, 7);
  bodyGeo.rotateX(Math.PI / 2);
  const neckGeo = new THREE.CylinderGeometry(0.025, 0.032, 0.22, 6);
  neckGeo.rotateX(Math.PI / 2);
  const cheekGeo = new THREE.SphereGeometry(0.036, 6, 6);
  const wingGeo = new THREE.BoxGeometry(0.32, 0.015, 0.14);

  disposables.push(bodyGeo, neckGeo, cheekGeo, wingGeo);

  // V-formation offsets (7 wild geese)
  const vOffsets: Array<[number, number, number]> = [
    [0, 0, 0],
    [-0.58, 0.04, -0.55],
    [0.58, 0.03, -0.55],
    [-1.14, 0.08, -1.12],
    [1.14, 0.07, -1.12],
    [-1.68, 0.12, -1.72],
    [1.68, 0.1, -1.72],
  ];

  const birds: GooseBird[] = vOffsets.map(([ox, oy, oz], idx) => {
    const bird = new THREE.Group();
    bird.position.set(ox, oy, oz);

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;

    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.set(0, 0.02, 0.22);
    neck.castShadow = true;

    const cheek = new THREE.Mesh(cheekGeo, cheekMat);
    cheek.position.set(0, 0.03, 0.31);

    const wingL = new THREE.Group();
    const wMeshL = new THREE.Mesh(wingGeo, wingMat);
    wMeshL.position.set(-0.18, 0, 0.02);
    wMeshL.castShadow = true;
    wingL.add(wMeshL);

    const wingR = new THREE.Group();
    const wMeshR = new THREE.Mesh(wingGeo, wingMat);
    wMeshR.position.set(0.18, 0, 0.02);
    wMeshR.castShadow = true;
    wingR.add(wMeshR);

    bird.add(body, neck, cheek, wingL, wingR);
    flockGroup.add(bird);

    return { wingL, wingR, phaseOffset: idx * 0.65 };
  });

  return { group: flockGroup, birds };
}

function createParamotorGroup(disposables: Array<{ dispose: () => void }>): {
  group: THREE.Group;
  propeller: THREE.Mesh;
} {
  const g = new THREE.Group();

  const canopyColors = [0xf97316, 0xfacc15, 0x0ea5e9, 0xfacc15, 0xf97316];
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.3 });
  const pilotMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
  const propMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
  disposables.push(lineMat, frameMat, pilotMat, propMat);

  // Curved arched paraglider wing made of 5 colorful panels
  const panelGeo = new THREE.BoxGeometry(0.42, 0.055, 0.62);
  disposables.push(panelGeo);
  for (let i = 0; i < 5; i++) {
    const offsetIdx = i - 2;
    const pMat = new THREE.MeshStandardMaterial({
      color: canopyColors[i],
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    disposables.push(pMat);
    const panel = new THREE.Mesh(panelGeo, pMat);
    const ang = offsetIdx * 0.24;
    panel.position.set(Math.sin(ang) * 1.45, Math.cos(ang) * 0.92 - 0.1, 0);
    panel.rotation.z = -ang;
    panel.castShadow = true;
    g.add(panel);
  }

  // Suspension lines
  const riserGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.95, 4);
  disposables.push(riserGeo);
  const riserCoords: Array<[number, number]> = [
    [-0.42, 0.2],
    [0.42, -0.2],
  ];
  for (const [rx, rzAngle] of riserCoords) {
    const riser = new THREE.Mesh(riserGeo, lineMat);
    riser.position.set(rx * 0.65, 0.34, 0);
    riser.rotation.z = rzAngle;
    g.add(riser);
  }

  // Pilot & motor harness suspended below wing
  const pilotGeo = new THREE.BoxGeometry(0.18, 0.28, 0.22);
  const pilot = new THREE.Mesh(pilotGeo, pilotMat);
  pilot.position.set(0, -0.1, 0.04);
  pilot.castShadow = true;

  const cageGeo = new THREE.TorusGeometry(0.18, 0.015, 6, 16);
  const cage = new THREE.Mesh(cageGeo, frameMat);
  cage.position.set(0, -0.08, -0.12);

  const propGeo = new THREE.BoxGeometry(0.3, 0.04, 0.015);
  const propeller = new THREE.Mesh(propGeo, propMat);
  propeller.position.set(0, -0.08, -0.14);

  g.add(pilot, cage, propeller);
  disposables.push(pilotGeo, cageGeo, propGeo);

  return { group: g, propeller };
}

export function buildLivingWorld(): LivingWorldController {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const interactables: THREE.Object3D[] = [];

  // 1. Lasy Rudzkie + Zamek Piastowski & Opactwo Rudy
  group.add(buildLasyRudzkie(disposables));
  group.add(buildLandmarks(disposables));

  // 2. 3 Interactive White Sailboats on unified Odra + Zbiornik
  const yachts: YachtEntity[] = YACHT_PATHS.map((path, idx) => {
    const yg = createYachtGroup(idx, disposables);
    const baseY = -0.015;
    const [sx, sz] = path[0];
    yg.position.set(sx, baseY, sz);
    group.add(yg);
    interactables.push(yg);
    return {
      group: yg,
      pathIdx: idx,
      waypointIdx: 0,
      t: 0,
      speed: 0.72 + idx * 0.12,
      state: 'sailing',
      timer: 0,
      baseY,
    };
  });

  // 3. 2 Small Colorful Cars driving along road grooves + 2s anti-deadlock reversal
  const carConfigs = [
    { color: 0xdc2626, start: 'n3', next: 'n1' },
    { color: 0x2563eb, start: 'n11', next: 'n12' },
  ];
  const cars: CarEntity[] = carConfigs.map((cfg, idx) => {
    const cg = createCarGroup(idx, cfg.color, disposables);
    const [sx, sz] = CAR_GRAPH_POINTS[cfg.start];
    cg.position.set(sx, 0.0, sz);
    group.add(cg);
    interactables.push(cg);
    return {
      group: cg,
      fromKey: cfg.start,
      toKey: cfg.next,
      t: 0.2 + idx * 0.35,
      speed: 1.55 + idx * 0.18,
      x: sx,
      z: sz,
      pauseTimer: 0,
      hornCooldown: 0,
      blockedTimer: 0,
    };
  });

  // 4. Intense Blue Semi-Truck (TIR z Modzurowa z czerwonym wózkiem widłowym z tyłu)
  const tirGroup = createTirGroup(99, disposables);
  const startTirPt = CAR_GRAPH_POINTS['n5'];
  tirGroup.position.set(startTirPt[0], 0.0, startTirPt[1]);
  group.add(tirGroup);
  interactables.push(tirGroup);

  const tir: TirEntity = {
    group: tirGroup,
    routeIdx: 0,
    segIdx: 0,
    dir: 1,
    t: 0.1,
    speed: 1.38,
    x: startTirPt[0],
    z: startTirPt[1],
    pauseTimer: 0,
    respawnTimer: 0,
    hornCooldown: 0,
    blockedTimer: 0,
  };

  // 5. Deer & White Sheep roaming meadows & forest edges
  const animalSeeds: Array<{ kind: 'deer' | 'sheep'; hx: number; hz: number }> = [
    { kind: 'deer', hx: 4.5, hz: -3.9 },
    { kind: 'deer', hx: 8.6, hz: -3.2 },
    { kind: 'deer', hx: -4.8, hz: -5.4 },
    { kind: 'deer', hx: 1.8, hz: -8.6 },
    { kind: 'sheep', hx: -4.6, hz: 5.4 },
    { kind: 'sheep', hx: -8.2, hz: 2.2 },
    { kind: 'sheep', hx: -2.0, hz: 5.5 },
    { kind: 'sheep', hx: -8.2, hz: -5.6 },
  ];

  const animals: AnimalEntity[] = animalSeeds.map((seed, idx) => {
    const ag = createAnimalGroup(idx, seed.kind, disposables);
    const hy = sampleBoardHeight(seed.hx, seed.hz);
    ag.position.set(seed.hx, hy, seed.hz);
    group.add(ag);
    interactables.push(ag);
    return {
      group: ag,
      kind: seed.kind,
      homeX: seed.hx,
      homeZ: seed.hz,
      x: seed.hx,
      z: seed.hz,
      targetX: seed.hx,
      targetZ: seed.hz,
      fleeing: false,
      hopPhase: Math.random() * Math.PI * 2,
      waitTimer: Math.random() * 1.5,
    };
  });

  // 6. Klucz dzikich gęsi (rezerwat Łężczok)
  const geese = createGeeseFlock(disposables);
  geese.group.visible = false;
  group.add(geese.group);
  let geeseTimer = 14.0; // first flyover at 4s (triggers when >= 18s)
  let geeseActive = false;
  let geeseProgress = 0;
  let geeseStart: [number, number] = [13.5, 6.0];
  let geeseEnd: [number, number] = [-14.0, -9.5];

  // 7. Paralotnia z napędem
  const paramotor = createParamotorGroup(disposables);
  paramotor.group.visible = false;
  group.add(paramotor.group);
  let paraTimer = 13.0; // first flight around 11s
  let paraActive = false;
  let paraProgress = 0;

  const pickNextAnimalTarget = (a: AnimalEntity, preferSafeField: boolean) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = preferSafeField ? 0.5 + Math.random() * 0.9 : 0.7 + Math.random() * 1.85;
      const nx = a.homeX + Math.cos(ang) * rad;
      const nz = a.homeZ + Math.sin(ang) * rad;
      if (evaluateCountyPolygonSDF(nx, nz) > -0.5) continue;
      if (evaluateOdraRiverDist(nx, nz) < 0.78) continue;
      if (evaluateZbiornikSDF(nx, nz) < 0.45) continue;
      if (preferSafeField && evaluateGrooveSDF(nx, nz) < 0.35) continue;
      let nearHole = false;
      for (const n of TOWN_NODES) {
        if (Math.hypot(nx - n.x, nz - n.z) < 0.85) {
          nearHole = true;
          break;
        }
      }
      if (nearHole) continue;
      a.targetX = nx;
      a.targetZ = nz;
      return;
    }
    a.targetX = a.homeX;
    a.targetZ = a.homeZ;
  };

  const handleTap = (hit: InteractableHit) => {
    if (hit.type === 'yacht') {
      const y = yachts[hit.index];
      if (y && y.state === 'sailing') {
        y.state = 'sinking';
        y.timer = 0;
        soundEngine.playWaterBubbles();
      }
    } else if (hit.type === 'car') {
      if (hit.index === 99) {
        soundEngine.playCarHorn();
        tir.hornCooldown = 1.0;
      } else {
        const c = cars[hit.index];
        if (c) {
          soundEngine.playCarHorn();
          c.hornCooldown = 1.0;
        }
      }
    } else if (hit.type === 'animal') {
      const a = animals[hit.index];
      if (a) {
        soundEngine.playMagicChime();
        a.fleeing = true;
        a.waitTimer = 0;
        pickNextAnimalTarget(a, true);
      }
    }
  };

  const update = (
    dt: number,
    elapsed: number,
    balls: Array<{ x: number; z: number; vx: number; vz: number; state: string }>
  ) => {
    // 1. Update Yachts
    for (const y of yachts) {
      const path = YACHT_PATHS[y.pathIdx];
      if (y.state === 'sailing') {
        const curr = path[y.waypointIdx];
        const nextIdx = (y.waypointIdx + 1) % path.length;
        const next = path[nextIdx];
        const segLen = Math.max(0.1, Math.hypot(next[0] - curr[0], next[1] - curr[1]));
        y.t += (y.speed * dt) / segLen;
        if (y.t >= 1) {
          y.t -= 1;
          y.waypointIdx = nextIdx;
        }
        const a = path[y.waypointIdx];
        const b = path[(y.waypointIdx + 1) % path.length];
        const px = a[0] + (b[0] - a[0]) * y.t;
        const pz = a[1] + (b[1] - a[1]) * y.t;

        y.group.position.set(px, y.baseY + Math.sin(elapsed * 2.4 + y.pathIdx) * 0.018, pz);
        y.group.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
        y.group.rotation.z = Math.sin(elapsed * 2.0 + y.pathIdx) * 0.08;
        y.group.visible = true;
      } else if (y.state === 'sinking') {
        y.timer += dt;
        const p = Math.min(1, y.timer / 1.45);
        y.group.rotation.z = p * 1.15;
        y.group.rotation.x = p * 0.35;
        y.group.position.y = y.baseY - p * 0.85;
        if (p >= 1) {
          y.group.visible = false;
          y.state = 'respawning';
          y.timer = 0;
        }
      } else if (y.state === 'respawning') {
        y.timer += dt;
        if (y.timer >= 11.0) {
          y.state = 'sailing';
          y.timer = 0;
          y.waypointIdx = Math.floor(Math.random() * path.length);
          y.t = 0;
          y.group.rotation.set(0, 0, 0);
          y.group.visible = true;
        }
      }
    }

    // 2. Update Cars + Anti-deadlock 2s 180-degree reversal
    for (const c of cars) {
      if (c.hornCooldown > 0) c.hornCooldown -= dt;
      if (c.pauseTimer > 0) {
        c.pauseTimer -= dt;
      } else {
        const pa = CAR_GRAPH_POINTS[c.fromKey];
        const pb = CAR_GRAPH_POINTS[c.toKey];
        const segLen = Math.max(0.1, Math.hypot(pb[0] - pa[0], pb[1] - pa[1]));
        c.t += (c.speed * dt) / segLen;

        if (c.t >= 1) {
          const arrived = c.toKey;
          const neighbors = CAR_ADJACENCY[arrived] ?? [];
          const choices = neighbors.filter((k) => k !== c.fromKey);
          const next =
            choices.length > 0
              ? choices[Math.floor(Math.random() * choices.length)]
              : neighbors[0] ?? c.fromKey;
          c.fromKey = arrived;
          c.toKey = next;
          c.t = 0;
        }

        const p1 = CAR_GRAPH_POINTS[c.fromKey];
        const p2 = CAR_GRAPH_POINTS[c.toKey];
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const len = Math.hypot(dx, dz) || 1;
        const laneRx = -dz / len;
        const laneRz = dx / len;

        c.x = p1[0] + dx * c.t + laneRx * 0.22;
        c.z = p1[1] + dz * c.t + laneRz * 0.22;
        c.group.position.set(c.x, 0.0, c.z);
        c.group.rotation.y = Math.atan2(dx, dz);
      }

      let isBlockedByBall = false;
      for (const ball of balls) {
        if (ball.state !== 'active') continue;
        const dx = ball.x - c.x;
        const dz = ball.z - c.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 1.38 && c.hornCooldown <= 0) {
          soundEngine.playCarHorn();
          c.hornCooldown = 1.6;
        }

        const minSep = BALL_RADIUS + 0.3;
        if (dist < minSep + 0.16) {
          isBlockedByBall = true;
        }

        if (dist > 0.001 && dist < minSep) {
          const nx = dx / dist;
          const nz = dz / dist;
          ball.x += nx * (minSep - dist);
          ball.z += nz * (minSep - dist);

          const vn = ball.vx * nx + ball.vz * nz;
          if (vn < 1.5) {
            ball.vx += nx * (Math.abs(vn) * 1.4 + 4.8);
            ball.vz += nz * (Math.abs(vn) * 1.4 + 4.8);
          }
          c.pauseTimer = 0.22;
          if (c.hornCooldown <= 0) {
            soundEngine.playCarHorn();
            c.hornCooldown = 1.4;
          }
        }
      }

      if (isBlockedByBall) {
        c.blockedTimer += dt;
        if (c.blockedTimer >= 2.0) {
          // Immediately turn 180 degrees and drive back in the opposite direction
          const prevFrom = c.fromKey;
          c.fromKey = c.toKey;
          c.toKey = prevFrom;
          c.t = Math.max(0.02, 1 - c.t);
          c.blockedTimer = 0;
          c.pauseTimer = 0;
          soundEngine.playCarHorn();
        }
      } else {
        c.blockedTimer = Math.max(0, c.blockedTimer - dt * 2);
      }
    }

    // 3. Update Modzurów Blue TIR (window factory truck heading to PL/CZ border)
    if (tir.hornCooldown > 0) tir.hornCooldown -= dt;
    if (tir.respawnTimer > 0) {
      tir.respawnTimer -= dt;
      tir.group.visible = false;
      if (tir.respawnTimer <= 0) {
        tir.routeIdx = (tir.routeIdx + 1) % TIR_ROUTES.length;
        tir.segIdx = 0;
        tir.dir = 1;
        tir.t = 0;
        tir.blockedTimer = 0;
        tir.group.visible = true;
      }
    } else {
      tir.group.visible = true;
      const route = TIR_ROUTES[tir.routeIdx];
      if (tir.pauseTimer > 0) {
        tir.pauseTimer -= dt;
      } else {
        const fromKey = route[tir.segIdx];
        const toIdx = tir.segIdx + tir.dir;
        if (toIdx < 0 || toIdx >= route.length) {
          tir.respawnTimer = 5.5;
        } else {
          const toKey = route[toIdx];
          const p1 = CAR_GRAPH_POINTS[fromKey];
          const p2 = CAR_GRAPH_POINTS[toKey];
          const dx = p2[0] - p1[0];
          const dz = p2[1] - p1[1];
          const segLen = Math.max(0.1, Math.hypot(dx, dz));
          tir.t += (tir.speed * dt) / segLen;

          if (tir.t >= 1) {
            tir.segIdx = toIdx;
            tir.t = 0;
            const nextCheck = tir.segIdx + tir.dir;
            if (nextCheck < 0 || nextCheck >= route.length) {
              tir.respawnTimer = 5.5;
            }
          }

          if (tir.respawnTimer <= 0) {
            const curFrom = route[tir.segIdx];
            const curTo = route[tir.segIdx + tir.dir];
            const a = CAR_GRAPH_POINTS[curFrom];
            const b = CAR_GRAPH_POINTS[curTo];
            const sdx = b[0] - a[0];
            const sdz = b[1] - a[1];
            const slen = Math.hypot(sdx, sdz) || 1;
            const laneRx = -sdz / slen;
            const laneRz = sdx / slen;

            tir.x = a[0] + sdx * tir.t + laneRx * 0.2;
            tir.z = a[1] + sdz * tir.t + laneRz * 0.2;
            tir.group.position.set(tir.x, 0.0, tir.z);
            tir.group.rotation.y = Math.atan2(sdx, sdz);
          }
        }
      }

      let tirBlocked = false;
      for (const ball of balls) {
        if (ball.state !== 'active') continue;
        const dx = ball.x - tir.x;
        const dz = ball.z - tir.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 1.55 && tir.hornCooldown <= 0) {
          soundEngine.playCarHorn();
          tir.hornCooldown = 1.8;
        }

        const minSep = BALL_RADIUS + 0.36;
        if (dist < minSep + 0.18) {
          tirBlocked = true;
        }
        if (dist > 0.001 && dist < minSep) {
          const nx = dx / dist;
          const nz = dz / dist;
          ball.x += nx * (minSep - dist);
          ball.z += nz * (minSep - dist);
          const vn = ball.vx * nx + ball.vz * nz;
          if (vn < 1.5) {
            ball.vx += nx * (Math.abs(vn) * 1.4 + 4.8);
            ball.vz += nz * (Math.abs(vn) * 1.4 + 4.8);
          }
          tir.pauseTimer = 0.24;
        }
      }

      if (tirBlocked) {
        tir.blockedTimer += dt;
        if (tir.blockedTimer >= 2.0) {
          // Immediately flip 180° along route
          tir.segIdx = tir.segIdx + tir.dir;
          tir.dir = tir.dir === 1 ? -1 : 1;
          tir.t = Math.max(0.02, 1 - tir.t);
          tir.blockedTimer = 0;
          tir.pauseTimer = 0;
          soundEngine.playCarHorn();
        }
      } else {
        tir.blockedTimer = Math.max(0, tir.blockedTimer - dt * 2);
      }
    }

    // 4. Update Deer & White Sheep
    for (const a of animals) {
      if (a.waitTimer > 0) {
        a.waitTimer -= dt;
        const baseY = sampleBoardHeight(a.x, a.z);
        a.group.position.set(a.x, baseY, a.z);
      } else {
        const dx = a.targetX - a.x;
        const dz = a.targetZ - a.z;
        const dist = Math.hypot(dx, dz);
        const spd = a.fleeing ? 3.2 : 0.65;

        if (dist < 0.08) {
          a.fleeing = false;
          a.waitTimer = 1.0 + Math.random() * 2.5;
          pickNextAnimalTarget(a, false);
        } else {
          const step = Math.min(dist, spd * dt);
          a.x += (dx / dist) * step;
          a.z += (dz / dist) * step;
          a.hopPhase += dt * (a.fleeing ? 18 : 7);
          const hopY = Math.abs(Math.sin(a.hopPhase)) * (a.fleeing ? 0.14 : 0.035);
          const groundY = sampleBoardHeight(a.x, a.z);
          a.group.position.set(a.x, groundY + hopY, a.z);
          a.group.rotation.y = Math.atan2(dx, dz);
        }
      }

      if (!a.fleeing) {
        for (const ball of balls) {
          if (ball.state !== 'active') continue;
          const d = Math.hypot(ball.x - a.x, ball.z - a.z);
          if (d < BALL_RADIUS + 0.36) {
            soundEngine.playMagicChime();
            a.fleeing = true;
            a.waitTimer = 0;
            pickNextAnimalTarget(a, true);
            break;
          }
        }
      }
    }

    // 5. Update Wild Geese V-Formation (Rezerwat Łężczok)
    if (!geeseActive) {
      geeseTimer += dt;
      if (geeseTimer >= 18.5) {
        geeseActive = true;
        geeseTimer = 0;
        geeseProgress = 0;
        // Alternate gentle flight corridors across the reserve & Odra
        const flip = Math.random() < 0.5;
        geeseStart = flip ? [13.5, 4.5] : [11.5, 11.5];
        geeseEnd = flip ? [-13.5, -8.5] : [-11.5, -12.5];
        geese.group.visible = true;
        soundEngine.playGeeseHonk();
      }
    } else {
      geeseProgress += dt / 10.5;
      if (geeseProgress >= 1) {
        geeseActive = false;
        geese.group.visible = false;
      } else {
        const gx = THREE.MathUtils.lerp(geeseStart[0], geeseEnd[0], geeseProgress);
        const gz = THREE.MathUtils.lerp(geeseStart[1], geeseEnd[1], geeseProgress);
        const gy = 5.4 + Math.sin(geeseProgress * Math.PI) * 0.7;
        geese.group.position.set(gx, gy, gz);
        geese.group.rotation.y = Math.atan2(
          geeseEnd[0] - geeseStart[0],
          geeseEnd[1] - geeseStart[1]
        );
        for (const b of geese.birds) {
          const flap = Math.sin(elapsed * 11.5 + b.phaseOffset) * 0.52;
          b.wingL.rotation.z = flap;
          b.wingR.rotation.z = -flap;
        }
      }
    }

    // 6. Update Powered Paraglider (Paralotnia z napędem)
    if (!paraActive) {
      paraTimer += dt;
      if (paraTimer >= 24.0) {
        paraActive = true;
        paraTimer = 0;
        paraProgress = 0;
        paramotor.group.visible = true;
        soundEngine.playParamotorHum();
      }
    } else {
      paraProgress += dt / 14.0;
      if (paraProgress >= 1) {
        paraActive = false;
        paramotor.group.visible = false;
      } else {
        // Gentle sweeping curve over the county
        const px = THREE.MathUtils.lerp(-13.5, 13.5, paraProgress);
        const pz = Math.sin(paraProgress * Math.PI * 1.35) * 6.5 - 2.0;
        const py = 4.65 + Math.sin(elapsed * 1.2) * 0.2;

        const nextP = Math.min(1, paraProgress + 0.02);
        const nx = THREE.MathUtils.lerp(-13.5, 13.5, nextP);
        const nz = Math.sin(nextP * Math.PI * 1.35) * 6.5 - 2.0;

        paramotor.group.position.set(px, py, pz);
        paramotor.group.rotation.y = Math.atan2(nx - px, nz - pz);
        paramotor.group.rotation.z = Math.cos(paraProgress * Math.PI * 1.35) * 0.14;
        paramotor.propeller.rotation.z += dt * 38;
      }
    }
  };

  return {
    group,
    interactables,
    update,
    handleTap,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
