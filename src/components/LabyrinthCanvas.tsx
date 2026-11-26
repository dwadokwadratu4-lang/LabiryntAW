import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BALL_RADIUS,
  BOARD_DEPTH,
  BOARD_WIDTH,
  HOLE_RADIUS,
  NODE_MAP,
  TOWN_NODES,
  evaluateGrooveGradient,
  evaluateGrooveSDF,
} from '../game/mapData';
import { buildRaciborzBoard, createMarbleMesh } from '../game/boardBuilder';
import { buildLivingWorld, InteractableHit } from '../game/livingWorld';
import { soundEngine } from '../game/soundEngine';

export type GameMode = 'single' | 'courier3';
export type CameraViewMode = 'angled' | 'top';

export interface ActiveBallMission {
  key: 'gold' | 'silver' | 'copper';
  label: string;
  startId: number;
  targetId: number;
  colorHex: number;
  uiColor: string;
}

export interface LabyrinthCanvasProps {
  mode: GameMode;
  missions: ActiveBallMission[];
  runId: number;
  introActive: boolean;
  isPaused: boolean;
  cameraView: CameraViewMode;
  gyroEnabled: boolean;
  calibrateSignal: number;
  centerLevelSignal: number;
  onTrapFall: (ballLabel: string, holeName: string) => void;
  onBallDelivered: (ballKey: string, remaining: number) => void;
  onRouteComplete: () => void;
  onFirstMove: () => void;
  onTiltChange?: (pitchDeg: number, rollDeg: number) => void;
}

interface SimBall {
  key: 'gold' | 'silver' | 'copper';
  label: string;
  startId: number;
  targetId: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  state: 'active' | 'falling_trap' | 'falling_win' | 'locked';
  fallTimer: number;
  fallHoleX: number;
  fallHoleZ: number;
  mesh: THREE.Mesh;
  dispose: () => void;
}

interface SparkParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

const MAX_TILT_RAD = THREE.MathUtils.degToRad(15.5);
const GRAVITY_ACCEL = 34.0;

// Reusable math objects outside animation loop (zero GC)
const _rollAxis = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3(0, 0, 0.25);
const _camDesiredLookAt = new THREE.Vector3(0, 0, 0.25);
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyScale = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();

export const LabyrinthCanvas: React.FC<LabyrinthCanvasProps> = ({
  mode,
  missions,
  runId,
  introActive,
  isPaused,
  cameraView,
  gyroEnabled,
  calibrateSignal,
  centerLevelSignal,
  onTrapFall,
  onBallDelivered,
  onRouteComplete,
  onFirstMove,
  onTiltChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const propsRef = useRef({
    mode,
    missions,
    introActive,
    isPaused,
    cameraView,
    gyroEnabled,
    onTrapFall,
    onBallDelivered,
    onRouteComplete,
    onFirstMove,
    onTiltChange,
  });
  propsRef.current = {
    mode,
    missions,
    introActive,
    isPaused,
    cameraView,
    gyroEnabled,
    onTrapFall,
    onBallDelivered,
    onRouteComplete,
    onFirstMove,
    onTiltChange,
  };

  const keysRef = useRef<Set<string>>(new Set());
  const dragTiltRef = useRef({ active: false, moved: false, startX: 0, startY: 0, pitch: 0, roll: 0 });
  const gyroRef = useRef({
    hasReading: false,
    rawBeta: 0,
    rawGamma: 0,
    calBeta: 0,
    calGamma: 0,
  });
  const snapFlatRef = useRef(false);

  // Sync calibration signal (phone gyro zeroing)
  useEffect(() => {
    if (calibrateSignal > 0 && gyroRef.current.hasReading) {
      gyroRef.current.calBeta = gyroRef.current.rawBeta;
      gyroRef.current.calGamma = gyroRef.current.rawGamma;
    }
  }, [calibrateSignal]);

  // Sync center/level signal (immediate flat board + centered camera)
  useEffect(() => {
    if (centerLevelSignal > 0) {
      keysRef.current.clear();
      dragTiltRef.current.active = false;
      dragTiltRef.current.pitch = 0;
      dragTiltRef.current.roll = 0;
      if (gyroRef.current.hasReading) {
        gyroRef.current.calBeta = gyroRef.current.rawBeta;
        gyroRef.current.calGamma = gyroRef.current.rawGamma;
      }
      snapFlatRef.current = true;
    }
  }, [centerLevelSignal]);

  const resetBallsRef = useRef<((newMissions: ActiveBallMission[]) => void) | null>(null);

  useEffect(() => {
    if (resetBallsRef.current) {
      resetBallsRef.current(missions);
    }
  }, [missions, runId, mode]);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1610);
    scene.fog = new THREE.FogExp2(0x1e1610, 0.0022);

    const width = Math.max(1, mount.clientWidth || window.innerWidth);
    const height = Math.max(1, mount.clientHeight || window.innerHeight);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 220);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Bright, crisp multi-light rig so grooves, wood grain, water, and plaques pop on every monitor
    const ambientLight = new THREE.AmbientLight(0xfff5e4, 0.95);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfefce8, 0x694526, 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4dc, 2.35);
    keyLight.position.set(14, 34, 14);
    keyLight.castShadow = true;
    const shadowRes = isSoftwareGl ? 1024 : 2048;
    keyLight.shadow.mapSize.width = shadowRes;
    keyLight.shadow.mapSize.height = shadowRes;
    keyLight.shadow.camera.near = 8;
    keyLight.shadow.camera.far = 75;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 17;
    keyLight.shadow.camera.bottom = -17;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.95);
    fillLight.position.set(-16, 22, -14);
    scene.add(fillLight);

    // Subtle tabletop studio surface beneath the board
    const tableGeo = new THREE.PlaneGeometry(140, 140);
    tableGeo.rotateX(-Math.PI / 2);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x16100b,
      roughness: 0.9,
      metalness: 0.05,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.y = -3.8;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    const builtBoard = buildRaciborzBoard(renderer);
    scene.add(builtBoard.boardGroup);

    const livingWorld = buildLivingWorld();
    builtBoard.boardGroup.add(livingWorld.group);

    const targetPointLight = new THREE.PointLight(0x10b981, 2.4, 8.5, 1.6);
    targetPointLight.position.set(0, 1.5, 0);
    builtBoard.boardGroup.add(targetPointLight);

    const MAX_SPARKS = 80;
    const sparkGeo = new THREE.OctahedronGeometry(0.11, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    sparkInstanced.frustumCulled = false;
    sparkInstanced.count = 0;
    builtBoard.boardGroup.add(sparkInstanced);
    const activeSparks: SparkParticle[] = [];

    const spawnSparks = (x: number, z: number, colorHex: number, count = 36) => {
      for (let i = 0; i < count && activeSparks.length < MAX_SPARKS; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.0 + Math.random() * 5.2;
        activeSparks.push({
          x,
          y: 0.25,
          z,
          vx: Math.cos(ang) * spd,
          vy: 3.5 + Math.random() * 5.0,
          vz: Math.sin(ang) * spd,
          life: 0,
          maxLife: 0.75 + Math.random() * 0.5,
          color: new THREE.Color(colorHex),
        });
      }
    };

    let simBalls: SimBall[] = [];
    let hasMovedOnce = false;
    let routeFinished = false;
    let currentPitch = 0;
    let currentRoll = 0;
    let lastTiltBroadcast = 0;

    const rebuildBalls = (currentMissions: ActiveBallMission[]) => {
      for (const b of simBalls) {
        builtBoard.boardGroup.remove(b.mesh);
        b.dispose();
      }
      simBalls = [];
      hasMovedOnce = false;
      routeFinished = false;

      const startSet = new Set(currentMissions.map((m) => m.startId));
      const targetMissionByNode = new Map<number, ActiveBallMission>();
      for (const m of currentMissions) {
        targetMissionByNode.set(m.targetId, m);
      }

      for (const [id, handle] of builtBoard.nodes.entries()) {
        const isStart = startSet.has(id);
        const targetMission = targetMissionByNode.get(id);

        handle.startCap.visible = isStart;
        handle.beaconGroup.visible = Boolean(targetMission);

        if (targetMission) {
          const isSingle = currentMissions.length === 1;
          const ringColor = isSingle ? 0x10b981 : targetMission.colorHex;
          const haloColor = isSingle ? 0xfbbf24 : targetMission.colorHex;
          handle.beaconMat.color.setHex(ringColor);
          handle.haloMat.color.setHex(haloColor);
          handle.ringMat.color.setHex(ringColor);
          handle.ringMat.emissive.setHex(ringColor);
          handle.ringMat.emissiveIntensity = 0.7;
        } else if (isStart) {
          handle.ringMat.color.setHex(0xf59e0b);
          handle.ringMat.emissive.setHex(0xb45309);
          handle.ringMat.emissiveIntensity = 0.35;
        } else {
          handle.ringMat.color.setHex(0xdcb046);
          handle.ringMat.emissive.setHex(0x000000);
          handle.ringMat.emissiveIntensity = 0;
        }
      }

      if (currentMissions.length > 0) {
        const primaryTarget = NODE_MAP.get(currentMissions[0].targetId);
        if (primaryTarget) {
          targetPointLight.position.set(primaryTarget.x, 1.5, primaryTarget.z);
          targetPointLight.visible = true;
        }
      } else {
        targetPointLight.visible = false;
      }

      for (const m of currentMissions) {
        const startNode = NODE_MAP.get(m.startId);
        if (!startNode) continue;
        const { mesh, dispose } = createMarbleMesh(m.colorHex);
        mesh.position.set(startNode.x, BALL_RADIUS + 0.03, startNode.z);
        builtBoard.boardGroup.add(mesh);

        simBalls.push({
          key: m.key,
          label: m.label,
          startId: m.startId,
          targetId: m.targetId,
          x: startNode.x,
          y: BALL_RADIUS + 0.03,
          z: startNode.z,
          vx: 0,
          vz: 0,
          state: 'active',
          fallTimer: 0,
          fallHoleX: 0,
          fallHoleZ: 0,
          mesh,
          dispose,
        });
      }
    };

    resetBallsRef.current = rebuildBalls;
    rebuildBalls(propsRef.current.missions);

    /**
     * Responsive camera distance from aspect ratio (window.innerWidth / window.innerHeight).
     * On wide PC monitors, board fills ~85% of viewport height from a slight 3D perspective angle.
     * On portrait phones, board width fits inside viewport with comfortable margins.
     */
    const updateCameraDesiredPos = (w: number, h: number, viewMode: CameraViewMode) => {
      const aspect = Math.max(0.35, w / Math.max(1, h));
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const tanHalfFov = Math.tan(fovRad / 2);

      // Total board bounds including mahogany frame rails
      const totalWidth = BOARD_WIDTH + 1.8;
      const totalDepth = BOARD_DEPTH + 1.8;

      const tiltFactor = viewMode === 'top' ? 0.08 : 0.34;
      const cosPitchApprox = 1 / Math.hypot(1, tiltFactor);

      // Fit board vertically (~85% of height on widescreen PC) and horizontally (90% on portrait phone)
      const distForHeight = (totalDepth * cosPitchApprox) / (2 * tanHalfFov * 0.84);
      const distForWidth = totalWidth / (2 * tanHalfFov * aspect * 0.9);
      const baseDist = Math.max(distForHeight, distForWidth);

      const yDist = baseDist * cosPitchApprox;
      const zDist = yDist * tiltFactor;
      _camTargetPos.set(0, yDist, zDist);
    };

    updateCameraDesiredPos(width, height, propsRef.current.cameraView);
    camera.position.copy(_camTargetPos);
    camera.lookAt(_camLookAt);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Keyboard & Pointer controls
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        if (k.startsWith('arrow')) e.preventDefault();
        keysRef.current.add(k);
        soundEngine.unlock();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    const onBlur = () => {
      keysRef.current.clear();
      dragTiltRef.current.active = false;
      dragTiltRef.current.pitch = 0;
      dragTiltRef.current.roll = 0;
    };

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const findInteractableHit = (clientX: number, clientY: number): InteractableHit | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(livingWorld.interactables, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData && obj.userData.interactable) {
            return obj.userData.interactable as InteractableHit;
          }
          obj = obj.parent;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      soundEngine.unlock();
      dragTiltRef.current.active = true;
      dragTiltRef.current.moved = false;
      dragTiltRef.current.startX = e.clientX;
      dragTiltRef.current.startY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragTiltRef.current.active) return;
      const dx = e.clientX - dragTiltRef.current.startX;
      const dy = e.clientY - dragTiltRef.current.startY;
      if (Math.hypot(dx, dy) > 8) {
        dragTiltRef.current.moved = true;
      }
      const sensitivity = 85;
      dragTiltRef.current.roll = THREE.MathUtils.clamp(dx / sensitivity, -1, 1) * MAX_TILT_RAD;
      dragTiltRef.current.pitch = THREE.MathUtils.clamp(dy / sensitivity, -1, 1) * MAX_TILT_RAD;
    };
    const onPointerUp = (e: PointerEvent) => {
      const wasTap = dragTiltRef.current.active && !dragTiltRef.current.moved;
      dragTiltRef.current.active = false;
      dragTiltRef.current.moved = false;
      dragTiltRef.current.pitch = 0;
      dragTiltRef.current.roll = 0;
      if (wasTap && e.type === 'pointerup') {
        const hit = findInteractableHit(e.clientX, e.clientY);
        if (hit) {
          livingWorld.handleTap(hit);
        }
      }
    };

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      if (!gyroRef.current.hasReading) {
        gyroRef.current.hasReading = true;
        gyroRef.current.calBeta = e.beta;
        gyroRef.current.calGamma = e.gamma;
      }
      gyroRef.current.rawBeta = e.beta;
      gyroRef.current.rawGamma = e.gamma;
    };

    const applyResize = () => {
      const w = Math.max(1, mount.clientWidth || window.innerWidth);
      const h = Math.max(1, mount.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    };

    const resizeObserver = new ResizeObserver(() => applyResize());
    resizeObserver.observe(mount);

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', applyResize);
    window.addEventListener('deviceorientation', onDeviceOrientation);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    const onContextLost = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const computeTargetTilt = (): [number, number] => {
      let pitch = 0;
      let roll = 0;

      const keys = keysRef.current;
      let kbPitch = 0;
      let kbRoll = 0;
      if (keys.has('arrowup') || keys.has('w')) kbPitch -= 1;
      if (keys.has('arrowdown') || keys.has('s')) kbPitch += 1;
      if (keys.has('arrowleft') || keys.has('a')) kbRoll -= 1;
      if (keys.has('arrowright') || keys.has('d')) kbRoll += 1;

      if (kbPitch !== 0 || kbRoll !== 0) {
        pitch += kbPitch * MAX_TILT_RAD * 0.9;
        roll += kbRoll * MAX_TILT_RAD * 0.9;
      }

      if (dragTiltRef.current.active) {
        pitch += dragTiltRef.current.pitch;
        roll += dragTiltRef.current.roll;
      }

      if (propsRef.current.gyroEnabled && gyroRef.current.hasReading) {
        let dBeta = gyroRef.current.rawBeta - gyroRef.current.calBeta;
        let dGamma = gyroRef.current.rawGamma - gyroRef.current.calGamma;
        if (dBeta > 180) dBeta -= 360;
        if (dBeta < -180) dBeta += 360;
        if (dGamma > 90) dGamma -= 180;
        if (dGamma < -90) dGamma += 180;

        const angle = screen.orientation?.angle ?? 0;
        let gx = dGamma;
        let gy = dBeta;
        if (angle === 90) {
          gx = dBeta;
          gy = -dGamma;
        } else if (angle === -90 || angle === 270) {
          gx = -dBeta;
          gy = dGamma;
        } else if (angle === 180) {
          gx = -dGamma;
          gy = -dBeta;
        }

        const sensitivityDeg = 26;
        roll += THREE.MathUtils.clamp(gx / sensitivityDeg, -1, 1) * MAX_TILT_RAD;
        pitch += THREE.MathUtils.clamp(gy / sensitivityDeg, -1, 1) * MAX_TILT_RAD;
      }

      return [
        THREE.MathUtils.clamp(pitch, -MAX_TILT_RAD, MAX_TILT_RAD),
        THREE.MathUtils.clamp(roll, -MAX_TILT_RAD, MAX_TILT_RAD),
      ];
    };

    const tick = () => {
      if (disposed) return;

      const rawDelta = clock.getDelta();
      const dt = Math.min(rawDelta, 0.05);
      const elapsed = clock.elapsedTime;

      const w = Math.max(1, mount.clientWidth || window.innerWidth);
      const h = Math.max(1, mount.clientHeight || window.innerHeight);

      if (propsRef.current.introActive) {
        // Sweeping 3D flyover showcasing Powiat Raciborski, unified Odra+Zbiornik, and Zamek Piastowski
        const orbitAngle = elapsed * 0.28 - 0.55;
        const aspect = Math.max(0.55, w / Math.max(1, h));
        const radiusScale = aspect < 1 ? 1.32 : 1.0;
        const flyX = Math.sin(orbitAngle) * 14.5 * radiusScale;
        const flyZ = Math.cos(orbitAngle) * 16.5 * radiusScale + 2.0;
        const flyY = (14.5 + Math.sin(elapsed * 0.45) * 2.2) * radiusScale;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, flyX, 3.2, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, flyY, 3.2, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, flyZ, 3.2, dt);

        _camDesiredLookAt.set(
          Math.sin(elapsed * 0.35) * 1.6,
          0.25,
          Math.cos(elapsed * 0.25) * 1.4
        );
        _camLookAt.lerp(_camDesiredLookAt, Math.min(1, dt * 3));
      } else {
        updateCameraDesiredPos(w, h, propsRef.current.cameraView);
        _camDesiredLookAt.set(0, 0, 0.25);

        if (snapFlatRef.current) {
          currentPitch = 0;
          currentRoll = 0;
          camera.position.copy(_camTargetPos);
          _camLookAt.copy(_camDesiredLookAt);
          snapFlatRef.current = false;
        } else {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 7, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 7, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 7, dt);
          _camLookAt.x = THREE.MathUtils.damp(_camLookAt.x, _camDesiredLookAt.x, 7, dt);
          _camLookAt.y = THREE.MathUtils.damp(_camLookAt.y, _camDesiredLookAt.y, 7, dt);
          _camLookAt.z = THREE.MathUtils.damp(_camLookAt.z, _camDesiredLookAt.z, 7, dt);
        }
      }
      camera.lookAt(_camLookAt);

      // Animate Odra & Zbiornik Racibórz Dolny water shimmer + Target beacons + Dynamic Plaque Scaling
      builtBoard.riverTex.offset.y = -elapsed * 0.24;
      builtBoard.reservoirTex.offset.y = -elapsed * 0.08;
      targetPointLight.intensity = 2.0 + Math.sin(elapsed * 4.5) * 0.75;

      const missionStartSet = new Set(propsRef.current.missions.map((m) => m.startId));
      const missionTargetSet = new Set(propsRef.current.missions.map((m) => m.targetId));

      for (const handle of builtBoard.nodes.values()) {
        if (handle.beaconGroup.visible) {
          const pulse = 1 + Math.sin(elapsed * 4.2 + handle.id) * 0.14;
          handle.beaconRing.scale.set(pulse, 1, pulse);
          handle.beaconHalo.rotation.y = elapsed * 1.4;
          handle.haloMat.opacity = 0.2 + Math.sin(elapsed * 4.2) * 0.09;
        }

        // Dynamic town plaque scaling: Start (A) & Target (B) always 1.72x; nearby node when ball approaches 1.6x
        const node = NODE_MAP.get(handle.id);
        const isStart = missionStartSet.has(handle.id);
        const isTarget = missionTargetSet.has(handle.id);
        let minBallDist = 999;
        if (node) {
          for (let bIdx = 0; bIdx < simBalls.length; bIdx++) {
            const sb = simBalls[bIdx];
            if (sb.state !== 'active') continue;
            const d = Math.hypot(sb.x - node.x, sb.z - node.z);
            if (d < minBallDist) minBallDist = d;
          }
        }

        const isNearby = minBallDist < 2.25;
        const desiredScale = isStart || isTarget ? 1.72 : isNearby ? 1.6 : 1.0;
        const desiredLift = isStart || isTarget ? 0.3 : isNearby ? 0.24 : 0.0;
        const desiredRotX = isStart || isTarget ? 0.28 : isNearby ? 0.25 : 0.14;

        const nextScale = THREE.MathUtils.damp(handle.plaqueGroup.scale.x, desiredScale, 10, dt);
        handle.plaqueGroup.scale.setScalar(nextScale);
        handle.plaqueGroup.position.y = THREE.MathUtils.damp(
          handle.plaqueGroup.position.y,
          handle.plaqueBaseY + desiredLift,
          10,
          dt
        );
        handle.plaqueGroup.rotation.x = THREE.MathUtils.damp(
          handle.plaqueGroup.rotation.x,
          desiredRotX,
          10,
          dt
        );

        if (isTarget) {
          handle.plaqueTopMat.emissive.setHex(0x10b981);
          handle.plaqueTopMat.emissiveIntensity = 0.28;
        } else if (isStart) {
          handle.plaqueTopMat.emissive.setHex(0xf59e0b);
          handle.plaqueTopMat.emissiveIntensity = 0.22;
        } else if (isNearby) {
          handle.plaqueTopMat.emissive.setHex(0xd97706);
          handle.plaqueTopMat.emissiveIntensity = 0.18;
        } else {
          handle.plaqueTopMat.emissiveIntensity = 0;
        }
      }

      const [targetPitch, targetRoll] = propsRef.current.isPaused ? [0, 0] : computeTargetTilt();
      currentPitch = THREE.MathUtils.damp(currentPitch, targetPitch, 14, dt);
      currentRoll = THREE.MathUtils.damp(currentRoll, targetRoll, 14, dt);

      builtBoard.boardGroup.rotation.x = currentPitch;
      builtBoard.boardGroup.rotation.z = -currentRoll;

      if (propsRef.current.onTiltChange && elapsed - lastTiltBroadcast > 0.06) {
        lastTiltBroadcast = elapsed;
        propsRef.current.onTiltChange(
          THREE.MathUtils.radToDeg(currentPitch),
          THREE.MathUtils.radToDeg(currentRoll)
        );
      }

      if (!propsRef.current.isPaused && dt > 0) {
        const ax = GRAVITY_ACCEL * Math.sin(currentRoll);
        const az = GRAVITY_ACCEL * Math.sin(currentPitch);
        const startIds = new Set(simBalls.map((b) => b.startId));

        if (!hasMovedOnce && (Math.abs(currentPitch) > 0.012 || Math.abs(currentRoll) > 0.012)) {
          hasMovedOnce = true;
          propsRef.current.onFirstMove();
        }

        const SUB_STEPS = 4;
        const subDt = dt / SUB_STEPS;

        for (let step = 0; step < SUB_STEPS; step++) {
          for (const ball of simBalls) {
            if (ball.state !== 'active') continue;

            ball.vx += ax * subDt;
            ball.vz += az * subDt;

            const dampFactor = Math.exp(-1.12 * subDt);
            ball.vx *= dampFactor;
            ball.vz *= dampFactor;

            const maxSpd = 12.5;
            const spd = Math.hypot(ball.vx, ball.vz);
            if (spd > maxSpd) {
              ball.vx = (ball.vx / spd) * maxSpd;
              ball.vz = (ball.vz / spd) * maxSpd;
            }

            ball.x += ball.vx * subDt;
            ball.z += ball.vz * subDt;

            const grooveD = evaluateGrooveSDF(ball.x, ball.z);
            const wallLimit = -BALL_RADIUS + 0.02;
            if (grooveD > wallLimit) {
              const [nx, nz] = evaluateGrooveGradient(ball.x, ball.z);
              const penetration = grooveD - wallLimit;
              ball.x -= nx * penetration;
              ball.z -= nz * penetration;

              const vn = ball.vx * nx + ball.vz * nz;
              if (vn > 0) {
                const restitution = 0.42;
                ball.vx -= (1 + restitution) * vn * nx;
                ball.vz -= (1 + restitution) * vn * nz;
                if (vn > 1.05) {
                  soundEngine.playWoodKnock(vn);
                }
              }
            }

            for (let nIdx = 0; nIdx < TOWN_NODES.length; nIdx++) {
              const node = TOWN_NODES[nIdx];
              if (startIds.has(node.id)) continue;

              const dx = node.x - ball.x;
              const dz = node.z - ball.z;
              const dist = Math.hypot(dx, dz);

              if (dist < HOLE_RADIUS + 0.08) {
                const isOwnTarget = node.id === ball.targetId;
                const captureRadius = isOwnTarget ? HOLE_RADIUS * 0.9 : HOLE_RADIUS * 0.68;

                if (dist < captureRadius) {
                  ball.fallHoleX = node.x;
                  ball.fallHoleZ = node.z;
                  ball.fallTimer = 0;
                  ball.vx = 0;
                  ball.vz = 0;

                  if (isOwnTarget) {
                    ball.state = 'falling_win';
                    spawnSparks(node.x, node.z, mColorForBall(ball.key), 38);
                    const remaining = simBalls.filter(
                      (other) =>
                        other !== ball && other.state !== 'locked' && other.state !== 'falling_win'
                    ).length;

                    if (remaining === 0 && !routeFinished) {
                      routeFinished = true;
                      soundEngine.playVictoryFanfare();
                      propsRef.current.onBallDelivered(ball.key, 0);
                      propsRef.current.onRouteComplete();
                    } else {
                      soundEngine.playTargetLock(simBalls.indexOf(ball));
                      propsRef.current.onBallDelivered(ball.key, remaining);
                    }
                  } else {
                    ball.state = 'falling_trap';
                    soundEngine.playTrapBell();
                    propsRef.current.onTrapFall(ball.label, `${node.id} ${node.name}`);
                  }
                  break;
                } else if (dist > 0.001) {
                  const pull = isOwnTarget ? 11.5 : 4.2;
                  ball.vx += (dx / dist) * pull * subDt;
                  ball.vz += (dz / dist) * pull * subDt;
                }
              }
            }
          }

          for (let i = 0; i < simBalls.length; i++) {
            const a = simBalls[i];
            if (a.state !== 'active') continue;
            for (let j = i + 1; j < simBalls.length; j++) {
              const b = simBalls[j];
              if (b.state !== 'active') continue;

              const dx = b.x - a.x;
              const dz = b.z - a.z;
              const dist = Math.hypot(dx, dz);
              const minDist = BALL_RADIUS * 2;
              if (dist > 0.0001 && dist < minDist) {
                const nx = dx / dist;
                const nz = dz / dist;
                const overlap = (minDist - dist) * 0.5;
                a.x -= nx * overlap;
                a.z -= nz * overlap;
                b.x += nx * overlap;
                b.z += nz * overlap;

                const rvx = b.vx - a.vx;
                const rvz = b.vz - a.vz;
                const velAlongNormal = rvx * nx + rvz * nz;
                if (velAlongNormal < 0) {
                  const restitution = 0.72;
                  const impulse = -(1 + restitution) * velAlongNormal * 0.5;
                  a.vx -= impulse * nx;
                  a.vz -= impulse * nz;
                  b.vx += impulse * nx;
                  b.vz += impulse * nz;
                  soundEngine.playMarbleClack(Math.abs(velAlongNormal));
                }
              }
            }
          }
        }

        for (const ball of simBalls) {
          if (ball.state === 'active') {
            ball.y = BALL_RADIUS + 0.02;
            ball.mesh.position.set(ball.x, ball.y, ball.z);

            const speed = Math.hypot(ball.vx, ball.vz);
            if (speed > 0.02) {
              _rollAxis.set(ball.vz, 0, -ball.vx).normalize();
              const angle = (speed * dt) / BALL_RADIUS;
              _deltaQuat.setFromAxisAngle(_rollAxis, angle);
              ball.mesh.quaternion.premultiply(_deltaQuat).normalize();
            }
          } else if (ball.state === 'falling_trap') {
            ball.fallTimer += dt;
            const p = Math.min(1, ball.fallTimer / 0.36);
            ball.x = THREE.MathUtils.lerp(ball.x, ball.fallHoleX, 0.22);
            ball.z = THREE.MathUtils.lerp(ball.z, ball.fallHoleZ, 0.22);
            ball.y = BALL_RADIUS + 0.02 - p * 0.95;
            ball.mesh.position.set(ball.x, ball.y, ball.z);

            if (ball.fallTimer >= 0.42) {
              const startNode = NODE_MAP.get(ball.startId)!;
              ball.x = startNode.x;
              ball.z = startNode.z;
              ball.y = BALL_RADIUS + 0.03;
              ball.vx = 0;
              ball.vz = 0;
              ball.state = 'active';
              ball.mesh.position.set(ball.x, ball.y, ball.z);
            }
          } else if (ball.state === 'falling_win') {
            ball.fallTimer += dt;
            const p = Math.min(1, ball.fallTimer / 0.35);
            ball.x = THREE.MathUtils.lerp(ball.x, ball.fallHoleX, 0.28);
            ball.z = THREE.MathUtils.lerp(ball.z, ball.fallHoleZ, 0.28);
            ball.y = BALL_RADIUS + 0.02 - p * 0.38;
            ball.mesh.position.set(ball.x, ball.y, ball.z);
            if (p >= 1) {
              ball.state = 'locked';
            }
          }
        }

        livingWorld.update(dt, elapsed, simBalls);
      } else if (propsRef.current.introActive && dt > 0) {
        livingWorld.update(dt, elapsed, []);
      }

      for (let i = activeSparks.length - 1; i >= 0; i--) {
        const sp = activeSparks[i];
        sp.life += dt;
        if (sp.life >= sp.maxLife) {
          activeSparks.splice(i, 1);
          continue;
        }
        sp.vy -= 12.5 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
      }

      sparkInstanced.count = activeSparks.length;
      for (let i = 0; i < activeSparks.length; i++) {
        const sp = activeSparks[i];
        const s = 1 - sp.life / sp.maxLife;
        _dummyPos.set(sp.x, sp.y, sp.z);
        _dummyScale.setScalar(Math.max(0.01, s));
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        sparkInstanced.setMatrixAt(i, _dummyMatrix);
        sparkInstanced.setColorAt(i, sp.color);
      }
      sparkInstanced.instanceMatrix.needsUpdate = true;
      if (sparkInstanced.instanceColor) sparkInstanced.instanceColor.needsUpdate = true;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', applyResize);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      for (const b of simBalls) b.dispose();
      livingWorld.dispose();
      builtBoard.dispose();
      tableGeo.dispose();
      tableMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full touch-none select-none cursor-grab active:cursor-grabbing"
    />
  );
};

function mColorForBall(key: 'gold' | 'silver' | 'copper'): number {
  if (key === 'gold') return 0xfbbf24;
  if (key === 'silver') return 0x38bdf8;
  return 0xf97316;
}
