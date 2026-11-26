import * as THREE from 'three';
import {
  BALL_RADIUS,
  BEVEL_WIDTH,
  BOARD_DEPTH,
  BOARD_WIDTH,
  COUNTY_POLYGON,
  DECORATIVE_DASHED_STUBS,
  HOLE_RADIUS,
  ODRA_RIVER_POINTS,
  PLAZA_RADIUS,
  RIVER_BRIDGES,
  ROAD_SEGMENTS,
  TOWN_NODES,
  WALL_HEIGHT,
  WAYPOINTS,
  ZBIORNIK_CENTER,
  ZBIORNIK_RX,
  ZBIORNIK_RZ,
  evaluateCountyPolygonSDF,
  evaluateGrooveSDF,
  evaluateOdraRiverDist,
  evaluateZbiornikSDF,
} from './mapData';

export interface NodeVisualHandle {
  id: number;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
  beaconGroup: THREE.Group;
  beaconRing: THREE.Mesh;
  beaconHalo: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  startCap: THREE.Mesh;
  plaqueGroup: THREE.Group;
  plaqueTopMat: THREE.MeshStandardMaterial;
  plaqueBaseY: number;
}

export interface BuiltBoard {
  boardGroup: THREE.Group;
  nodes: Map<number, NodeVisualHandle>;
  riverMat: THREE.MeshPhysicalMaterial;
  riverTex: THREE.CanvasTexture;
  reservoirTex: THREE.CanvasTexture;
  updateInfoPlaque: (title: string, era: string, population: string, distance: string) => void;
  dispose: () => void;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Exact continuous height function for the sculpted wooden board surface.
 */
export function sampleBoardHeight(x: number, z: number): number {
  const grooveD = evaluateGrooveSDF(x, z);
  const countyD = evaluateCountyPolygonSDF(x, z);

  let minHoleD = 999;
  for (let i = 0; i < TOWN_NODES.length; i++) {
    const n = TOWN_NODES[i];
    const d = Math.hypot(x - n.x, z - n.z);
    if (d < minHoleD) minHoleD = d;
  }

  let h = 0;
  if (grooveD > 0) {
    h = smoothstep(0, BEVEL_WIDTH, grooveD) * WALL_HEIGHT;
  }

  // Relief step at Powiat Raciborski outer border (keeps road exits open)
  if (countyD > 0.18 && grooveD > 0.04) {
    const dropFactor = smoothstep(0.18, 0.6, countyD);
    h -= dropFactor * 0.28;
  }

  // Carve unified Odra River + Zbiornik Racibórz Dolny water basin (one continuous body of water)
  const riverD = evaluateOdraRiverDist(x, z);
  const zbiornikD = evaluateZbiornikSDF(x, z);
  const unifiedWaterD = Math.min(riverD - 0.46, zbiornikD);
  if (unifiedWaterD < 0.06 && grooveD > 0.02) {
    const waterCut = (1 - smoothstep(-0.34, 0.06, unifiedWaterD)) * 0.56;
    h = Math.min(h, WALL_HEIGHT - waterCut);
    h = Math.max(-0.2, h - waterCut * 0.42);
  } else if (zbiornikD >= 0.06 && zbiornikD < 0.42 && riverD > 0.72 && grooveD > 0.05) {
    // Subtle embankment shore only on outer reservoir edges clear of river inflow/outflow
    const berm = (1 - smoothstep(0.06, 0.42, zbiornikD)) * 0.08;
    h += berm;
  }

  // Deepen circular sockets at all 19 town nodes
  if (minHoleD < HOLE_RADIUS + 0.06) {
    const holeDepth = 1 - smoothstep(HOLE_RADIUS - 0.09, HOLE_RADIUS + 0.06, minHoleD);
    h -= holeDepth * 0.72;
  }

  return h;
}

function createBoardColorTexture(maxAniso: number): THREE.CanvasTexture {
  const w = 1536;
  const h = 1608;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const toPxX = (x: number) => ((x + BOARD_WIDTH / 2) / BOARD_WIDTH) * w;
  const toPxZ = (z: number) => ((z + BOARD_DEPTH / 2) / BOARD_DEPTH) * h;
  const scalePx = w / BOARD_WIDTH;

  // 1. Rich warm walnut exterior baseboard
  ctx.fillStyle = '#4e2d18';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 320; i++) {
    const y = (i / 320) * h;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(35, 18, 9, 0.25)' : 'rgba(145, 92, 52, 0.16)';
    ctx.lineWidth = 1.5 + (i % 4);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 96) {
      const wave = Math.sin(x * 0.008 + i * 0.37) * 7 + Math.cos(x * 0.02 + i) * 3;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  // 2. Powiat Raciborski luminous honey-oak plateau
  ctx.save();
  ctx.beginPath();
  COUNTY_POLYGON.forEach(([px, pz], idx) => {
    if (idx === 0) ctx.moveTo(toPxX(px), toPxZ(pz));
    else ctx.lineTo(toPxX(px), toPxZ(pz));
  });
  ctx.closePath();

  const oakGrad = ctx.createRadialGradient(w * 0.48, h * 0.48, 80, w * 0.5, h * 0.5, w * 0.72);
  oakGrad.addColorStop(0, '#c68d53');
  oakGrad.addColorStop(0.55, '#ad743e');
  oakGrad.addColorStop(1, '#8c592d');
  ctx.fillStyle = oakGrad;
  ctx.fill();

  ctx.clip();
  for (let i = 0; i < 280; i++) {
    const y = (i / 280) * h;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(92, 50, 22, 0.16)' : 'rgba(235, 190, 130, 0.15)';
    ctx.lineWidth = 1.5 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 64) {
      const wave = Math.sin(x * 0.011 + i * 0.41) * 8;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  // Lush Lasy Rudzkie pine-moss forest floor tint (NE/E zone: 1, 2, 3, 10, 17, 18)
  const forestGrad = ctx.createRadialGradient(
    toPxX(5.4),
    toPxZ(-4.8),
    1.0 * scalePx,
    toPxX(5.0),
    toPxZ(-4.6),
    8.2 * scalePx
  );
  forestGrad.addColorStop(0, 'rgba(42, 82, 34, 0.82)');
  forestGrad.addColorStop(0.6, 'rgba(56, 98, 40, 0.65)');
  forestGrad.addColorStop(1, 'rgba(72, 106, 48, 0.0)');
  ctx.fillStyle = forestGrad;
  ctx.fillRect(toPxX(-1.6), toPxZ(-11.4), 13.8 * scalePx, 13.6 * scalePx);

  // Subtle green-meadow hints across western & southern grazing pastures
  const meadowSpots: Array<[number, number, number]> = [
    [-7.6, -5.8, 3.6],
    [-8.0, 2.2, 3.5],
    [-4.2, 5.8, 3.8],
  ];
  for (const [mx, mz, mr] of meadowSpots) {
    const mGrad = ctx.createRadialGradient(
      toPxX(mx),
      toPxZ(mz),
      0.4 * scalePx,
      toPxX(mx),
      toPxZ(mz),
      mr * scalePx
    );
    mGrad.addColorStop(0, 'rgba(92, 128, 52, 0.44)');
    mGrad.addColorStop(1, 'rgba(92, 128, 52, 0.0)');
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(toPxX(mx), toPxZ(mz), mr * scalePx, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Brass inlay outline around Powiat Raciborski
  ctx.save();
  ctx.beginPath();
  COUNTY_POLYGON.forEach(([px, pz], idx) => {
    if (idx === 0) ctx.moveTo(toPxX(px), toPxZ(pz));
    else ctx.lineTo(toPxX(px), toPxZ(pz));
  });
  ctx.closePath();
  ctx.strokeStyle = 'rgba(238, 196, 94, 0.88)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  // 3. Decorative dashed county road stubs from the user's diagram
  ctx.save();
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = 'rgba(72, 40, 18, 0.58)';
  ctx.lineWidth = 4;
  for (const [ax, az, bx, bz] of DECORATIVE_DASHED_STUBS) {
    ctx.beginPath();
    ctx.moveTo(toPxX(ax), toPxZ(az));
    ctx.lineTo(toPxX(bx), toPxZ(bz));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // 4. Unified Odra River & Zbiornik Racibórz Dolny basin underlayer (one continuous water sheet)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer dark riverbank for both Odra and Zbiornik first
  ctx.beginPath();
  ODRA_RIVER_POINTS.forEach(([rx, rz], idx) => {
    if (idx === 0) ctx.moveTo(toPxX(rx), toPxZ(rz));
    else ctx.lineTo(toPxX(rx), toPxZ(rz));
  });
  ctx.strokeStyle = '#184e77';
  ctx.lineWidth = 0.78 * scalePx;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    toPxX(ZBIORNIK_CENTER[0]),
    toPxZ(ZBIORNIK_CENTER[1]),
    (ZBIORNIK_RX + 0.16) * scalePx,
    (ZBIORNIK_RZ + 0.16) * scalePx,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = '#184e77';
  ctx.fill();

  // Inner bright blue water unifying river and reservoir seamlessly
  ctx.beginPath();
  ODRA_RIVER_POINTS.forEach(([rx, rz], idx) => {
    if (idx === 0) ctx.moveTo(toPxX(rx), toPxZ(rz));
    else ctx.lineTo(toPxX(rx), toPxZ(rz));
  });
  ctx.strokeStyle = '#2d8ac4';
  ctx.lineWidth = 0.54 * scalePx;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(
    toPxX(ZBIORNIK_CENTER[0]),
    toPxZ(ZBIORNIK_CENTER[1]),
    ZBIORNIK_RX * scalePx,
    ZBIORNIK_RZ * scalePx,
    0,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = '#267cb3';
  ctx.fill();
  ctx.restore();

  // 5. Carved road grooves bed (bright warm birch/maple track floor)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const s of ROAD_SEGMENTS) {
    ctx.beginPath();
    ctx.moveTo(toPxX(s.ax), toPxZ(s.az));
    ctx.lineTo(toPxX(s.bx), toPxZ(s.bz));
    ctx.strokeStyle = '#4f2c16';
    ctx.lineWidth = (s.halfWidth * 2 + 0.14) * scalePx;
    ctx.stroke();
  }
  for (const n of TOWN_NODES) {
    ctx.beginPath();
    ctx.arc(toPxX(n.x), toPxZ(n.z), (PLAZA_RADIUS + 0.07) * scalePx, 0, Math.PI * 2);
    ctx.fillStyle = '#4f2c16';
    ctx.fill();
  }

  for (const s of ROAD_SEGMENTS) {
    ctx.beginPath();
    ctx.moveTo(toPxX(s.ax), toPxZ(s.az));
    ctx.lineTo(toPxX(s.bx), toPxZ(s.bz));
    ctx.strokeStyle = s.kind === 'primary' ? '#edd2a4' : '#dfbe88';
    ctx.lineWidth = s.halfWidth * 2 * scalePx;
    ctx.stroke();
  }
  for (const n of TOWN_NODES) {
    ctx.beginPath();
    ctx.arc(toPxX(n.x), toPxZ(n.z), PLAZA_RADIUS * scalePx, 0, Math.PI * 2);
    ctx.fillStyle = '#f0d6ab';
    ctx.fill();
  }
  for (const [wx, wz] of WAYPOINTS) {
    ctx.beginPath();
    ctx.arc(toPxX(wx), toPxZ(wz), 0.68 * scalePx, 0, Math.PI * 2);
    ctx.fillStyle = '#edd2a4';
    ctx.fill();
  }

  // Centerlines: solid for primary, dashed for secondary
  for (const s of ROAD_SEGMENTS) {
    ctx.beginPath();
    ctx.moveTo(toPxX(s.ax), toPxZ(s.az));
    ctx.lineTo(toPxX(s.bx), toPxZ(s.bz));
    if (s.kind === 'primary') {
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(138, 84, 34, 0.55)';
      ctx.lineWidth = 5;
    } else {
      ctx.setLineDash([16, 14]);
      ctx.strokeStyle = 'rgba(104, 60, 22, 0.72)';
      ctx.lineWidth = 4;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Dark pit centers for each hole
  for (const n of TOWN_NODES) {
    ctx.beginPath();
    ctx.arc(toPxX(n.x), toPxZ(n.z), HOLE_RADIUS * scalePx, 0, Math.PI * 2);
    ctx.fillStyle = '#110905';
    ctx.fill();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAniso;
  texture.needsUpdate = true;
  return texture;
}

function createPlaqueTexture(
  id: number | null,
  name: string,
  variant: 'town' | 'exit' | 'water',
  maxAniso: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 0, 128);
  if (variant === 'water') {
    bg.addColorStop(0, '#0d2538');
    bg.addColorStop(1, '#06131e');
  } else if (variant === 'exit') {
    bg.addColorStop(0, '#18241c');
    bg.addColorStop(1, '#0b120e');
  } else {
    bg.addColorStop(0, '#1c120c');
    bg.addColorStop(1, '#0c0704');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle =
    variant === 'water' ? '#70c4f7' : variant === 'exit' ? '#b9dc9e' : '#f7ca57';
  ctx.lineWidth = 8;
  ctx.strokeRect(7, 7, 498, 114);

  if (id !== null) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = variant === 'exit' ? '#dcfce7' : '#fff9e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = name.length > 16 ? 44 : name.length > 11 ? 52 : 58;
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(name, 256, 66, 466);
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#dff3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 42px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(name, 256, 66, 482);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createTitlePlaqueTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 1024, 160);
  grad.addColorStop(0, '#c89a38');
  grad.addColorStop(0.5, '#f5d982');
  grad.addColorStop(1, '#ae7f23');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 160);

  ctx.fillStyle = '#1e130b';
  ctx.fillRect(10, 10, 1004, 140);

  ctx.strokeStyle = '#dfb24c';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 984, 120);

  ctx.fillStyle = '#f8df92';
  ctx.font = '700 50px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ZŁOTE KULE POWIATU', 512, 82);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createWaterTexture(maxAniso: number, repeatY: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, '#1e6996');
  grad.addColorStop(0.5, '#3ea8e0');
  grad.addColorStop(1, '#1e6996');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  ctx.strokeStyle = 'rgba(220, 246, 255, 0.36)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 24; i++) {
    const x = 32 + ((i * 53) % 192);
    const y = (i / 24) * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 14, y + 32, x - 4, y + 64);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, repeatY);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function buildRaciborzBoard(renderer: THREE.WebGLRenderer): BuiltBoard {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const boardGroup = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Sculpted 3D Carved Wood Surface (160 x 168 vertices -> crisp + fast mount)
  const segX = 160;
  const segZ = 168;
  const geom = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_DEPTH, segX, segZ);
  geom.rotateX(-Math.PI / 2);

  const posAttr = geom.attributes.position;
  const normAttr = geom.attributes.normal;
  const eps = 0.03;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const h = sampleBoardHeight(x, z);
    posAttr.setY(i, h);

    const hx1 = sampleBoardHeight(x + eps, z);
    const hx0 = sampleBoardHeight(x - eps, z);
    const hz1 = sampleBoardHeight(x, z + eps);
    const hz0 = sampleBoardHeight(x, z - eps);
    const dhdx = (hx1 - hx0) / (2 * eps);
    const dhdz = (hz1 - hz0) / (2 * eps);

    const invLen = 1 / Math.hypot(-dhdx, 1, -dhdz);
    normAttr.setXYZ(i, -dhdx * invLen, invLen, -dhdz * invLen);
  }
  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
  geom.computeBoundingSphere();

  const boardColorTex = createBoardColorTexture(maxAniso);
  const boardMat = new THREE.MeshStandardMaterial({
    map: boardColorTex,
    roughness: 0.44,
    metalness: 0.06,
  });

  const surfaceMesh = new THREE.Mesh(geom, boardMat);
  surfaceMesh.receiveShadow = true;
  surfaceMesh.castShadow = true;
  boardGroup.add(surfaceMesh);
  disposables.push(geom, boardColorTex, boardMat);

  // 2. Mahogany Under-chassis & Perimeter Frame Rails
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x3b1f10,
    roughness: 0.52,
    metalness: 0.06,
  });
  const frameWoodMat = new THREE.MeshStandardMaterial({
    color: 0x522c17,
    roughness: 0.35,
    metalness: 0.08,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe3b84d,
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 0.4,
  });
  disposables.push(chassisMat, frameWoodMat, brassMat);

  const underSlabGeo = new THREE.BoxGeometry(BOARD_WIDTH + 0.2, 0.9, BOARD_DEPTH + 0.2);
  const underSlab = new THREE.Mesh(underSlabGeo, chassisMat);
  underSlab.position.y = -1.05;
  underSlab.receiveShadow = true;
  underSlab.castShadow = true;
  boardGroup.add(underSlab);
  disposables.push(underSlabGeo);

  const railThick = 0.78;
  const railHeight = 1.7;
  const railY = -0.32;

  const hRailGeo = new THREE.BoxGeometry(BOARD_WIDTH + railThick * 2, railHeight, railThick);
  const topRail = new THREE.Mesh(hRailGeo, frameWoodMat);
  topRail.position.set(0, railY, -(BOARD_DEPTH / 2 + railThick / 2));
  topRail.castShadow = true;
  topRail.receiveShadow = true;

  const bottomRail = new THREE.Mesh(hRailGeo, frameWoodMat);
  bottomRail.position.set(0, railY, BOARD_DEPTH / 2 + railThick / 2);
  bottomRail.castShadow = true;
  bottomRail.receiveShadow = true;

  const vRailGeo = new THREE.BoxGeometry(railThick, railHeight, BOARD_DEPTH);
  const leftRail = new THREE.Mesh(vRailGeo, frameWoodMat);
  leftRail.position.set(-(BOARD_WIDTH / 2 + railThick / 2), railY, 0);
  leftRail.castShadow = true;
  leftRail.receiveShadow = true;

  const rightRail = new THREE.Mesh(vRailGeo, frameWoodMat);
  rightRail.position.set(BOARD_WIDTH / 2 + railThick / 2, railY, 0);
  rightRail.castShadow = true;
  rightRail.receiveShadow = true;

  boardGroup.add(topRail, bottomRail, leftRail, rightRail);
  disposables.push(hRailGeo, vRailGeo);

  const cornerGeo = new THREE.BoxGeometry(1.18, railHeight + 0.06, 1.18);
  const screwGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.12, 12);
  const corners: [number, number][] = [
    [-(BOARD_WIDTH / 2 + railThick * 0.45), -(BOARD_DEPTH / 2 + railThick * 0.45)],
    [BOARD_WIDTH / 2 + railThick * 0.45, -(BOARD_DEPTH / 2 + railThick * 0.45)],
    [-(BOARD_WIDTH / 2 + railThick * 0.45), BOARD_DEPTH / 2 + railThick * 0.45],
    [BOARD_WIDTH / 2 + railThick * 0.45, BOARD_DEPTH / 2 + railThick * 0.45],
  ];
  for (const [cx, cz] of corners) {
    const bracket = new THREE.Mesh(cornerGeo, brassMat);
    bracket.position.set(cx, railY, cz);
    bracket.castShadow = true;
    boardGroup.add(bracket);

    const screw = new THREE.Mesh(screwGeo, brassMat);
    screw.position.set(cx, railY + railHeight / 2 + 0.05, cz);
    boardGroup.add(screw);
  }
  disposables.push(cornerGeo, screwGeo);

  const titleTex = createTitlePlaqueTexture(maxAniso);
  const titleMat = new THREE.MeshStandardMaterial({
    map: titleTex,
    roughness: 0.34,
    metalness: 0.55,
  });
  const titleGeo = new THREE.BoxGeometry(9.4, 0.1, 0.66);
  const titlePlate = new THREE.Mesh(titleGeo, titleMat);
  titlePlate.position.set(0, railY + railHeight / 2 + 0.05, BOARD_DEPTH / 2 + railThick / 2);
  boardGroup.add(titlePlate);
  disposables.push(titleTex, titleMat, titleGeo);

  // 3. Unified Odra River + Zbiornik Racibórz Dolny 3D Water Surface (same level, seamless join)
  const riverCurve = new THREE.CatmullRomCurve3(
    ODRA_RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, -0.05, z))
  );
  const riverTubeGeo = new THREE.TubeGeometry(riverCurve, 104, 0.34, 8, false);
  riverTubeGeo.scale(1, 0.1, 1);
  const riverTex = createWaterTexture(maxAniso, 7);
  const riverMat = new THREE.MeshPhysicalMaterial({
    map: riverTex,
    color: 0x4cc2ff,
    roughness: 0.14,
    metalness: 0.08,
    clearcoat: 0.95,
    transparent: true,
    opacity: 0.92,
  });
  const riverMesh = new THREE.Mesh(riverTubeGeo, riverMat);
  riverMesh.position.y = -0.045;
  riverMesh.receiveShadow = true;
  boardGroup.add(riverMesh);
  disposables.push(riverTubeGeo, riverTex, riverMat);

  // 4. Zbiornik Racibórz Dolny Oval Water Basin at exact same water level as Odra
  const reservoirGeo = new THREE.CircleGeometry(1, 48);
  reservoirGeo.rotateX(-Math.PI / 2);
  reservoirGeo.scale(ZBIORNIK_RX, 1, ZBIORNIK_RZ);
  const reservoirTex = createWaterTexture(maxAniso, 2);
  const reservoirMat = new THREE.MeshPhysicalMaterial({
    map: reservoirTex,
    color: 0x45baf7,
    roughness: 0.14,
    metalness: 0.08,
    clearcoat: 0.95,
    transparent: true,
    opacity: 0.92,
  });
  const reservoirMesh = new THREE.Mesh(reservoirGeo, reservoirMat);
  reservoirMesh.position.set(ZBIORNIK_CENTER[0], -0.04, ZBIORNIK_CENTER[1]);
  reservoirMesh.receiveShadow = true;
  boardGroup.add(reservoirMesh);

  // Compact Zbiornik Racibórz Dolny Plaque
  const resPlaqueTex = createPlaqueTexture(null, 'Zbiornik Racibórz Dolny', 'water', maxAniso);
  const resPlaqueMat = new THREE.MeshStandardMaterial({
    map: resPlaqueTex,
    roughness: 0.32,
    metalness: 0.35,
  });
  const resPlaqueGeo = new THREE.BoxGeometry(2.65, 0.09, 0.46);
  const resPlaque = new THREE.Mesh(resPlaqueGeo, [
    brassMat,
    brassMat,
    resPlaqueMat,
    brassMat,
    brassMat,
    brassMat,
  ]);
  resPlaque.position.set(ZBIORNIK_CENTER[0] + 0.15, 0.12, ZBIORNIK_CENTER[1]);
  resPlaque.rotation.x = 0.14;
  resPlaque.castShadow = true;
  boardGroup.add(resPlaque);
  disposables.push(
    reservoirGeo,
    reservoirTex,
    reservoirMat,
    resPlaqueTex,
    resPlaqueMat,
    resPlaqueGeo
  );

  // 5. Aesthetic 3D Bridges over Odra River at road crossings
  const bridgeDeckMat = new THREE.MeshStandardMaterial({
    color: 0xe3be86,
    roughness: 0.55,
    metalness: 0.05,
  });
  const bridgeRailMat = new THREE.MeshStandardMaterial({
    color: 0x6b3a1b,
    roughness: 0.38,
    metalness: 0.12,
  });
  disposables.push(bridgeDeckMat, bridgeRailMat);

  for (const br of RIVER_BRIDGES) {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(br.x, 0.0, br.z);
    bridgeGroup.rotation.y = br.angleY;

    // Deck flush with groove bottom so marble rolls smoothly across
    const deckGeo = new THREE.BoxGeometry(br.length, 0.06, br.width);
    const deck = new THREE.Mesh(deckGeo, bridgeDeckMat);
    deck.position.y = -0.025;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);

    // Side wooden/brass parapets
    const parapetGeo = new THREE.BoxGeometry(br.length, 0.26, 0.11);
    const pNorth = new THREE.Mesh(parapetGeo, bridgeRailMat);
    pNorth.position.set(0, 0.14, -(br.width / 2 + 0.04));
    pNorth.castShadow = true;

    const pSouth = new THREE.Mesh(parapetGeo, bridgeRailMat);
    pSouth.position.set(0, 0.14, br.width / 2 + 0.04);
    pSouth.castShadow = true;

    // Brass top cap strip on parapets
    const capStripGeo = new THREE.BoxGeometry(br.length + 0.04, 0.04, 0.13);
    const cNorth = new THREE.Mesh(capStripGeo, brassMat);
    cNorth.position.set(0, 0.28, -(br.width / 2 + 0.04));
    const cSouth = new THREE.Mesh(capStripGeo, brassMat);
    cSouth.position.set(0, 0.28, br.width / 2 + 0.04);

    bridgeGroup.add(pNorth, pSouth, cNorth, cSouth);
    boardGroup.add(bridgeGroup);
    disposables.push(deckGeo, parapetGeo, capStripGeo);
  }

  // 6. 18 Node Ferrules, Hole Sockets, Beacons, Start Caps, and Brass Nameplates
  const nodes = new Map<number, NodeVisualHandle>();
  const ringGeo = new THREE.TorusGeometry(HOLE_RADIUS + 0.04, 0.045, 10, 28);
  ringGeo.rotateX(Math.PI / 2);

  const beaconRingGeo = new THREE.TorusGeometry(HOLE_RADIUS + 0.24, 0.045, 10, 32);
  beaconRingGeo.rotateX(Math.PI / 2);

  const haloGeo = new THREE.CylinderGeometry(
    HOLE_RADIUS + 0.12,
    HOLE_RADIUS + 0.22,
    1.35,
    24,
    1,
    true
  );
  const capGeo = new THREE.CylinderGeometry(HOLE_RADIUS + 0.02, HOLE_RADIUS + 0.02, 0.14, 24);

  const plaquePlateGeo = new THREE.BoxGeometry(1.5, 0.08, 0.38);
  const plaqueRivetGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.095, 8);
  const startCapMat = new THREE.MeshStandardMaterial({
    color: 0xd9a838,
    metalness: 0.85,
    roughness: 0.26,
  });
  disposables.push(
    ringGeo,
    beaconRingGeo,
    haloGeo,
    capGeo,
    plaquePlateGeo,
    plaqueRivetGeo,
    startCapMat
  );

  for (const n of TOWN_NODES) {
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xdcb046,
      metalness: 0.88,
      roughness: 0.22,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(n.x, 0.025, n.z);
    ringMesh.receiveShadow = true;
    boardGroup.add(ringMesh);

    const startCap = new THREE.Mesh(capGeo, startCapMat);
    startCap.position.set(n.x, -0.04, n.z);
    startCap.visible = false;
    startCap.receiveShadow = true;
    boardGroup.add(startCap);

    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(n.x, 0.08, n.z);
    beaconGroup.visible = false;

    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.92,
    });
    const beaconRing = new THREE.Mesh(beaconRingGeo, beaconMat);
    beaconGroup.add(beaconRing);

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconHalo = new THREE.Mesh(haloGeo, haloMat);
    beaconHalo.position.y = 0.65;
    beaconGroup.add(beaconHalo);
    boardGroup.add(beaconGroup);

    // Brass-and-ebony town nameplate (compact by default, dynamically scaled on active/nearby)
    const plaqueGroup = new THREE.Group();
    const px = n.x + n.plaqueOffset[0];
    const pz = n.z + n.plaqueOffset[1];
    const plaqueBaseY = Math.max(0.32, sampleBoardHeight(px, pz)) + 0.07;
    plaqueGroup.position.set(px, plaqueBaseY, pz);
    plaqueGroup.rotation.x = 0.14;

    const plaqueTex = createPlaqueTexture(
      n.id,
      n.shortName,
      n.isBorderExit ? 'exit' : 'town',
      maxAniso
    );
    const plaqueTopMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      roughness: 0.34,
      metalness: 0.32,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    const plaqueMesh = new THREE.Mesh(plaquePlateGeo, [
      brassMat,
      brassMat,
      plaqueTopMat,
      brassMat,
      brassMat,
      brassMat,
    ]);
    plaqueMesh.castShadow = true;
    plaqueMesh.receiveShadow = true;
    plaqueGroup.add(plaqueMesh);

    const rLeft = new THREE.Mesh(plaqueRivetGeo, brassMat);
    rLeft.position.set(-0.67, 0.015, 0.14);
    const rRight = new THREE.Mesh(plaqueRivetGeo, brassMat);
    rRight.position.set(0.67, 0.015, -0.14);
    plaqueGroup.add(rLeft, rRight);

    boardGroup.add(plaqueGroup);
    disposables.push(ringMat, beaconMat, haloMat, plaqueTex, plaqueTopMat);

    nodes.set(n.id, {
      id: n.id,
      ringMesh,
      ringMat,
      beaconGroup,
      beaconRing,
      beaconHalo,
      beaconMat,
      haloMat,
      startCap,
      plaqueGroup,
      plaqueTopMat,
      plaqueBaseY,
    });
  }

  // 7. Bottom-right 3D Target Town Info Plaque (with typewriter updates)
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 640;
  infoCanvas.height = 320;
  const infoCtx = infoCanvas.getContext('2d')!;
  const infoTex = new THREE.CanvasTexture(infoCanvas);
  infoTex.colorSpace = THREE.SRGBColorSpace;
  infoTex.anisotropy = maxAniso;

  const drawInfoCanvas = (title: string, era: string, population: string, distance: string) => {
    const g = infoCtx.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, '#18100a');
    g.addColorStop(1, '#0b0704');
    infoCtx.fillStyle = g;
    infoCtx.fillRect(0, 0, 640, 320);

    infoCtx.strokeStyle = '#e5b84b';
    infoCtx.lineWidth = 8;
    infoCtx.strokeRect(10, 10, 620, 300);

    infoCtx.fillStyle = '#fbbf24';
    infoCtx.font = '700 22px "Outfit", sans-serif';
    infoCtx.textAlign = 'left';
    infoCtx.textBaseline = 'top';
    infoCtx.fillText('CEL PODRÓŻY:', 30, 26);

    infoCtx.fillStyle = '#fff9e6';
    infoCtx.font = '800 38px "Plus Jakarta Sans", sans-serif';
    infoCtx.fillText(title, 30, 56, 580);

    infoCtx.strokeStyle = 'rgba(229, 184, 75, 0.35)';
    infoCtx.lineWidth = 2;
    infoCtx.beginPath();
    infoCtx.moveTo(30, 112);
    infoCtx.lineTo(610, 112);
    infoCtx.stroke();

    infoCtx.fillStyle = '#d6d3d1';
    infoCtx.font = '600 25px "Plus Jakarta Sans", sans-serif';
    infoCtx.fillText(`Powstanie: ${era}`, 30, 130, 580);
    infoCtx.fillText(`Ludność: ${population}`, 30, 182, 580);
    infoCtx.fillStyle = '#6ee7b7';
    infoCtx.fillText(`Do Starostwa: ${distance}`, 30, 234, 580);

    infoTex.needsUpdate = true;
  };
  drawInfoCanvas('Racibórz', '', '', '');

  const infoMat = new THREE.MeshStandardMaterial({
    map: infoTex,
    roughness: 0.34,
    metalness: 0.25,
  });
  const infoGeo = new THREE.BoxGeometry(5.6, 0.14, 2.75);
  const infoPlaque = new THREE.Mesh(infoGeo, [
    brassMat,
    brassMat,
    infoMat,
    brassMat,
    brassMat,
    brassMat,
  ]);
  infoPlaque.position.set(8.6, 0.42, 10.65);
  infoPlaque.rotation.x = 0.16;
  infoPlaque.castShadow = true;
  infoPlaque.receiveShadow = true;
  boardGroup.add(infoPlaque);
  disposables.push(infoTex, infoMat, infoGeo);

  return {
    boardGroup,
    nodes,
    riverMat,
    riverTex,
    reservoirTex,
    updateInfoPlaque: drawInfoCanvas,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function createMarbleMesh(colorHex: number): {
  mesh: THREE.Mesh;
  dispose: () => void;
} {
  const geo = new THREE.SphereGeometry(BALL_RADIUS, 36, 28);
  const mat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    metalness: 0.94,
    roughness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
