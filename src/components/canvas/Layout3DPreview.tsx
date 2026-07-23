import { Component, memo, useRef, useCallback, useState, useMemo, useEffect, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Box, Cone, Line, Text, Grid, Plane, Sphere, Cylinder, useGLTF, Billboard } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { RotateCcw, X, Magnet, Eye, EyeOff, Save, Lock, Unlock, Maximize2, Package } from 'lucide-react';
import { isProductLayoutObject, type LayoutObject } from './ObjectPropertyPanel';
import { CAMERA_INTERACTION_TYPES, PRODUCT_INTERACTION_TYPES } from './MechanismSVG';
import * as THREE from 'three';
import { toLocalProxyUrl } from '@/utils/storageUrl';

// Compute world-space rotation using quaternions to avoid Euler gimbal lock.
// Each slider always rotates around the fixed world axis regardless of other axes' values.
// Mapping: rotX → world X, rotY → world Z (Three.js Z = user depth), rotZ → world Y (Three.js Y = user height)
function computeWorldRotation(rotXDeg: number, rotYDeg: number, rotZDeg: number): THREE.Euler {
  const rx = (rotXDeg * Math.PI) / 180;
  const ry = (rotYDeg * Math.PI) / 180;
  const rz = (rotZDeg * Math.PI) / 180;

  const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rx);
  const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ry); // user Y = Three.js Z
  const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rz); // user Z = Three.js Y

  const combined = new THREE.Quaternion().multiply(qZ).multiply(qY).multiply(qX);
  return new THREE.Euler().setFromQuaternion(combined);
}

// Apply world rotation to a vector (for connection endpoint calculations)
function applyWorldRotation(v: THREE.Vector3, rotXDeg: number, rotYDeg: number, rotZDeg: number): THREE.Vector3 {
  const rx = (rotXDeg * Math.PI) / 180;
  const ry = (rotYDeg * Math.PI) / 180;
  const rz = (rotZDeg * Math.PI) / 180;

  const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rx);
  const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ry);
  const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rz);

  const combined = new THREE.Quaternion().multiply(qZ).multiply(qY).multiply(qX);
  return v.clone().applyQuaternion(combined);
}

type FitBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

function createEmptyFitBounds(): FitBounds {
  return {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
}

function addFitPoint(bounds: FitBounds, point: THREE.Vector3) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxY = Math.max(bounds.maxY, point.y);
  bounds.minZ = Math.min(bounds.minZ, point.z);
  bounds.maxZ = Math.max(bounds.maxZ, point.z);
}

function addLocalBoxToFitBounds(
  bounds: FitBounds,
  origin: THREE.Vector3,
  localMin: THREE.Vector3,
  localMax: THREE.Vector3,
  rotation?: THREE.Euler,
) {
  const xs = [localMin.x, localMax.x];
  const ys = [localMin.y, localMax.y];
  const zs = [localMin.z, localMax.z];

  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const point = new THREE.Vector3(x, y, z);
        if (rotation) point.applyEuler(rotation);
        addFitPoint(bounds, point.add(origin));
      }
    }
  }
}

function getMechanismFitExtraTop(mechType: string, height: number, hasModel3d: boolean) {
  const labelSpace = 0.55;
  switch (mechType) {
    case 'camera_mount':
      return Math.max(labelSpace, height * 0.45, 0.75);
    case 'robot_arm':
      return Math.max(labelSpace, height * 0.55, 0.9);
    case 'cylinder':
      return Math.max(labelSpace, height * 0.3, 0.45);
    default:
      return hasModel3d ? Math.max(labelSpace, height * 0.25, 0.45) : labelSpace;
  }
}

function getObjectOrigin(obj: LayoutObject) {
  return new THREE.Vector3(
    (obj.posX ?? 0) * SCALE,
    (obj.posZ ?? 0) * SCALE,
    (obj.posY ?? 0) * SCALE,
  );
}

function addLayoutObjectToFitBounds(bounds: FitBounds, obj: LayoutObject) {
  const origin = getObjectOrigin(obj);
  const rotation = computeWorldRotation(obj.rotX ?? 0, obj.rotY ?? 0, obj.rotZ ?? 0);
  const margin = FIT_OBJECT_MARGIN;

  if (obj.type === 'product') {
    const w = Math.max((obj.productLength ?? 100) * SCALE, 0.1);
    const h = Math.max((obj.productHeight ?? 50) * SCALE, 0.1);
    const d = Math.max((obj.productWidth ?? 100) * SCALE, 0.1);
    addLocalBoxToFitBounds(
      bounds,
      origin,
      new THREE.Vector3(-w / 2 - margin, -margin, -d / 2 - margin),
      new THREE.Vector3(w / 2 + margin, h + 0.45 + margin, d / 2 + margin),
      rotation,
    );
    return;
  }

  if (obj.type === 'camera') {
    const w = Math.max((obj.width || 50) / 100, 0.42);
    const h = Math.max((obj.height || 55) / 100, 0.45);
    const d = Math.max(w * 0.8, 0.5);
    addLocalBoxToFitBounds(
      bounds,
      origin,
      new THREE.Vector3(-w / 2 - margin, -0.55 - margin, -d / 2 - margin),
      new THREE.Vector3(w / 2 + margin, Math.max(h, 0.45) + margin, d / 2 + margin),
      rotation,
    );
    return;
  }

  const w = (obj.width || 100) * SCALE;
  const h = (obj.height || 100) * SCALE;
  const d = ((obj as any).depth || 80) * SCALE;
  const mechType = obj.mechanismType || '';
  const extraTop = getMechanismFitExtraTop(mechType, h, Boolean((obj as any).model3dUrl));

  addLocalBoxToFitBounds(
    bounds,
    origin,
    new THREE.Vector3(-w / 2 - margin, -margin, -d / 2 - margin),
    new THREE.Vector3(w / 2 + margin, h + extraTop, d / 2 + margin),
    rotation,
  );
}

export function calculateIsometricFitCamera({
  objects,
  fov,
  aspect,
  padding = DEFAULT_ISOMETRIC_FIT_PADDING,
}: {
  objects: LayoutObject[];
  fov: number;
  aspect: number;
  padding?: number;
}): IsometricCameraAction {
  const bounds = createEmptyFitBounds();

  for (const obj of objects) {
    addLayoutObjectToFitBounds(bounds, obj);
  }

  if (!Number.isFinite(bounds.minX)) {
    bounds.minX = -1;
    bounds.maxX = 1;
    bounds.minY = 0;
    bounds.maxY = 2;
    bounds.minZ = -1;
    bounds.maxZ = 1;
  }

  const center = new THREE.Vector3(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  );

  const fovRad = (Math.max(fov, 1) * Math.PI) / 180;
  const safeAspect = Math.max(aspect || 1, 0.1);
  const dir = new THREE.Vector3(1, 0.85, 1).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();

  const corners = [
    new THREE.Vector3(bounds.minX, bounds.minY, bounds.minZ), new THREE.Vector3(bounds.maxX, bounds.minY, bounds.minZ),
    new THREE.Vector3(bounds.minX, bounds.maxY, bounds.minZ), new THREE.Vector3(bounds.maxX, bounds.maxY, bounds.minZ),
    new THREE.Vector3(bounds.minX, bounds.minY, bounds.maxZ), new THREE.Vector3(bounds.maxX, bounds.minY, bounds.maxZ),
    new THREE.Vector3(bounds.minX, bounds.maxY, bounds.maxZ), new THREE.Vector3(bounds.maxX, bounds.maxY, bounds.maxZ),
  ];

  let projMinU = Infinity;
  let projMaxU = -Infinity;
  let projMinV = Infinity;
  let projMaxV = -Infinity;
  for (const corner of corners) {
    const u = corner.dot(right);
    const v = corner.dot(up);
    projMinU = Math.min(projMinU, u);
    projMaxU = Math.max(projMaxU, u);
    projMinV = Math.min(projMinV, v);
    projMaxV = Math.max(projMaxV, v);
  }

  const projWidth = Math.max(projMaxU - projMinU, 0.5);
  const projHeight = Math.max(projMaxV - projMinV, 0.5);
  const distV = (projHeight / 2) / Math.tan(fovRad / 2);
  const hFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * safeAspect);
  const distH = (projWidth / 2) / Math.tan(hFovRad / 2);
  const distance = Math.max(distV, distH, 0.5) * padding;
  const camPos = center.clone().add(dir.multiplyScalar(distance));

  return {
    position: [camPos.x, camPos.y, camPos.z],
    target: [center.x, center.y, center.z],
  };
}

interface Layout3DPreviewProps {
  objects: LayoutObject[];
  onSelectObject?: (id: string | null) => void;
  selectedObjectId?: string | null;
  onUpdateObject?: (id: string, updates: Partial<LayoutObject>) => void;
  onScreenshotReady?: (fn: IsometricScreenshotFn | null) => void;
  onFitAllReady?: (fn: IsometricFitAllFn) => void;
  onIsometricSceneStatusChange?: (status: IsometricSceneStatus) => void;
  onStageLayout?: () => void;
}

export interface IsometricFitOptions {
  padding?: number;
}

export type IsometricCameraAction = {
  position: [number, number, number];
  target: [number, number, number];
};

export type IsometricFitAllFn = (options?: IsometricFitOptions) => void;
export type IsometricScreenshotFn = () => string | null;

export type IsometricSceneStatus = {
  ready: boolean;
  pendingModelCount: number;
  failedModelCount: number;
};

export const DEFAULT_ISOMETRIC_FIT_PADDING = 1.55;
export const ISOMETRIC_CAPTURE_PADDING = 1.18;
export const ISOMETRIC_CAPTURE_FALLBACK_PADDING = 1.32;
const FIT_OBJECT_MARGIN = 0.18;

export function getIsometricModelLoadKey(obj: LayoutObject): string | null {
  if (obj.type !== 'mechanism' && obj.type !== 'product') return null;
  const url = String((obj as any).model3dUrl || '').trim();
  return url ? `${obj.id}:${url}` : null;
}

export function getIsometricModelLoadKeys(objects: LayoutObject[]): string[] {
  const keys = new Set<string>();
  objects.forEach(obj => {
    const key = getIsometricModelLoadKey(obj);
    if (key) keys.add(key);
  });
  return Array.from(keys);
}

function pruneModelKeySet(keys: Set<string>, expectedKeys: string[]): Set<string> {
  const expected = new Set(expectedKeys);
  const next = new Set(Array.from(keys).filter(key => expected.has(key)));
  if (next.size === keys.size && Array.from(next).every(key => keys.has(key))) {
    return keys;
  }
  return next;
}

export function deriveIsometricSceneStatus(
  objects: LayoutObject[],
  loadedModelKeys: Iterable<string>,
  failedModelKeys: Iterable<string>,
): IsometricSceneStatus {
  const expectedKeys = getIsometricModelLoadKeys(objects);
  const loaded = loadedModelKeys instanceof Set ? loadedModelKeys : new Set(loadedModelKeys);
  const failed = failedModelKeys instanceof Set ? failedModelKeys : new Set(failedModelKeys);
  let pendingModelCount = 0;
  let failedModelCount = 0;

  expectedKeys.forEach(key => {
    if (failed.has(key)) {
      failedModelCount += 1;
      return;
    }
    if (!loaded.has(key)) {
      pendingModelCount += 1;
    }
  });

  return {
    // A failed model renders the dimension-box fallback, so it must not block capture.
    ready: pendingModelCount === 0,
    pendingModelCount,
    failedModelCount,
  };
}

export function isIsometricCaptureReady(
  status: IsometricSceneStatus,
  hasScreenshotFn: boolean,
  hasFitAllFn: boolean,
): boolean {
  return status.ready && hasScreenshotFn && hasFitAllFn;
}

function ScreenshotHelper({
  enabled,
  onScreenshotReady,
}: {
  enabled: boolean;
  onScreenshotReady: (fn: IsometricScreenshotFn | null) => void;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!enabled) {
      onScreenshotReady(null);
      return;
    }
    onScreenshotReady(() => {
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    });
    return () => onScreenshotReady(null);
  }, [enabled, gl, scene, camera, onScreenshotReady]);
  return null;
}

// Labeled axis indicator with user coordinate mapping
function AxisLabels() {
  const axisLength = 3;
  return (
    <group>
      {/* X axis (Red) — Left/Right */}
      <Line points={[[0,0,0],[axisLength,0,0]]} color="red" lineWidth={2} />
      <Billboard position={[axisLength + 0.3, 0, 0]}>
        <Text fontSize={0.3} color="red" anchorX="center" anchorY="middle" font={undefined}>X</Text>
      </Billboard>

      {/* Three.js Y axis → User Z (Height, Blue) */}
      <Line points={[[0,0,0],[0,axisLength,0]]} color="#3b82f6" lineWidth={2} />
      <Billboard position={[0, axisLength + 0.3, 0]}>
        <Text fontSize={0.3} color="#3b82f6" anchorX="center" anchorY="middle" font={undefined}>Z（高度）</Text>
      </Billboard>

      {/* Three.js Z axis → User Y (Depth, Green) */}
      <Line points={[[0,0,0],[0,0,axisLength]]} color="#22c55e" lineWidth={2} />
      <Billboard position={[0, 0, axisLength + 0.3]}>
        <Text fontSize={0.3} color="#22c55e" anchorX="center" anchorY="middle" font={undefined}>Y（深度）</Text>
      </Billboard>
    </group>
  );
}

const SCALE = 0.01;
const INV_SCALE = 100; // 1 / SCALE

// Returns the surface Z-offset (mm) where a product should rest on a mechanism
export function getMechanismSurfaceHeight(mechType: string, mechHeight: number): number {
  switch (mechType) {
    case 'conveyor': return mechHeight * 0.64;   // belt top
    case 'turntable': return mechHeight * 0.50;  // disc surface
    case 'lift': return mechHeight * 0.63;       // platform surface
    case 'stop': return mechHeight * 0.40;       // stopper top
    case 'cylinder': return mechHeight * 1.10;   // piston rod end
    case 'gripper': return mechHeight * 0.35;    // grip center
    case 'camera_mount': return mechHeight * 0.90;
    case 'robot_arm': return mechHeight * 0.80;
    default: return mechHeight;                   // top of mechanism
  }
}

// Returns precise 3D offset (mm) for camera mounting on a mechanism
export function getCameraMountPosition(
  mechType: string,
  mountPointId: string,
  mechDims: { width: number; height: number; depth: number }
): { offsetX: number; offsetY: number; offsetZ: number } {
  switch (mechType) {
    case 'camera_mount':
      return { offsetX: 0, offsetY: 0, offsetZ: mechDims.height * 0.90 }; // top plate
    case 'robot_arm':
      if (mountPointId === 'arm_end') {
        return { offsetX: mechDims.width * 0.35, offsetY: 0, offsetZ: mechDims.height * 0.80 }; // flange end
      }
      return { offsetX: mechDims.width * 0.25, offsetY: 0, offsetZ: mechDims.height * 0.60 }; // wrist
    case 'conveyor':
      return { offsetX: 0, offsetY: 0, offsetZ: mechDims.height * 0.75 }; // above belt
    case 'turntable':
      return { offsetX: 0, offsetY: 0, offsetZ: mechDims.height * 0.65 }; // above disc
    case 'lift':
      return { offsetX: 0, offsetY: 0, offsetZ: mechDims.height * 0.75 }; // above platform
    default:
      return { offsetX: 0, offsetY: 0, offsetZ: mechDims.height }; // top
  }
}

// Shared drag state across components
interface DragState {
  isDragging: boolean;
  objectId: string | null;
  startPoint: THREE.Vector3 | null;
  startPos: { posX: number; posY: number; posZ: number } | null;
}

// --- Utility: check if a mechanism supports camera mounting ---
function isCameraMountable(mechType: string): boolean {
  return CAMERA_INTERACTION_TYPES.includes(mechType);
}
function isProductInteraction(mechType: string): boolean {
  return PRODUCT_INTERACTION_TYPES.includes(mechType);
}

// --- Compute related IDs for focus mode ---
function getRelatedIds(selectedId: string | null, objects: LayoutObject[]): Set<string> {
  if (!selectedId) return new Set();
  const related = new Set<string>();
  related.add(selectedId);
  const selectedObj = objects.find(o => o.id === selectedId);
  if (!selectedObj) return related;

  if (selectedObj.mountedToMechanismId) {
    related.add(selectedObj.mountedToMechanismId);
  }
  objects.forEach(o => {
    if (o.mountedToMechanismId === selectedId) {
      related.add(o.id);
    }
  });
  return related;
}

function DraggableGroup({
  children,
  objectId,
  position,
  rotation,
  dragState,
  onDragStart,
  onClick,
  objectClickedRef,
  selectedObjectId,
  editMode,
  spaceHeld,
  onDragEnd,
}: {
  children: React.ReactNode;
  objectId: string;
  position: [number, number, number];
  rotation?: THREE.Euler | [number, number, number];
  dragState: React.MutableRefObject<DragState>;
  onDragStart: (id: string, point: THREE.Vector3) => void;
  onClick: (id: string) => void;
  objectClickedRef: React.MutableRefObject<boolean>;
  selectedObjectId?: string | null;
  editMode?: boolean;
  spaceHeld?: boolean;
  onDragEnd?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointerDownPos = useRef<{ x: number; y: number; point: THREE.Vector3 } | null>(null);
  const hasDragStarted = useRef(false);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0 || spaceHeld) return;
        e.stopPropagation();
        objectClickedRef.current = true;
        pointerDownPos.current = { x: e.clientX, y: e.clientY, point: e.point.clone() };
        hasDragStarted.current = false;
        // Select immediately on pointer down
        onClick(objectId);
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!pointerDownPos.current || hasDragStarted.current) return;
        // Only allow drag if in edit mode AND object is already selected
        if (!editMode) return;
        if (objectId !== selectedObjectId) return;
        const dx = Math.abs(e.clientX - pointerDownPos.current.x);
        const dy = Math.abs(e.clientY - pointerDownPos.current.y);
        if (dx > 5 || dy > 5) {
          hasDragStarted.current = true;
          onDragStart(objectId, pointerDownPos.current.point);
        }
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const wasDragging = hasDragStarted.current;
        pointerDownPos.current = null;
        hasDragStarted.current = false;
        if (wasDragging) {
          onDragEnd?.();
        } else {
          dragState.current = { isDragging: false, objectId: null, startPoint: null, startPos: null };
        }
      }}
    >
      {children}
    </group>
  );
}

// Helper: standard material props for mechanisms (metallic)
function mechMat(color: string, selected: boolean, metalness = 0.6, roughness = 0.3) {
  const highlightColor = '#facc15';
  return {
    color: selected ? highlightColor : color,
    transparent: true,
    opacity: selected ? 0.92 : 0.85,
    emissive: selected ? highlightColor : '#000000',
    emissiveIntensity: selected ? 0.3 : 0,
    metalness,
    roughness,
  } as const;
}

// X-Ray material: semi-transparent wireframe
function xrayMat(color: string) {
  return {
    color,
    transparent: true,
    opacity: 0.12,
    wireframe: true,
  } as const;
}

// Rubber/plastic material
function rubberMat(color: string, selected: boolean) {
  return mechMat(color, selected, 0.05, 0.8);
}

// --- Dimmed material wrapper for focus mode ---
function dimmedMechMat(color: string, selected: boolean, dimmed: boolean, metalness = 0.6, roughness = 0.3) {
  const base = mechMat(color, selected, metalness, roughness);
  if (dimmed) {
    return { ...base, opacity: 0.2 };
  }
  return base;
}

// ============================================================
// HIGH-CONTRAST MECHANISM MODELS
// ============================================================

function RobotArmModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  // KUKA KR series high-fidelity 6-axis industrial robot arm
  const baseR = Math.min(w, d) * 0.48;
  const baseFlangeH = h * 0.04;    // bottom mounting flange
  const baseTowerH = h * 0.18;     // main base tower
  const shoulderShellH = h * 0.14; // shoulder housing (J1/J2 area)
  const arm1L = h * 0.32;         // upper arm (Link 2)
  const arm2L = h * 0.28;         // forearm (Link 3)
  const wristTotalL = h * 0.12;   // compact 3-axis wrist (J4/J5/J6)
  const jointR = w * 0.14;
  const armW = w * 0.24;          // arm body width
  const armD = w * 0.16;          // arm body depth
  const flangeR = w * 0.09;

  const bodyColor = '#f97316';     // KUKA orange
  const jointColor = '#ff6b00';    // darker orange for joints
  const baseColor = '#64748b';     // grey base
  const darkAccent = '#1e293b';    // dark steel
  const flangeColor = '#facc15';   // yellow flange
  const cableColor = '#1a1a1a';
  const labelColor = '#fef3c7';    // pale yellow for KUKA label area

  // Seal ring at each joint
  const SealRing = ({ r, y }: { r: number; y?: number }) => (
    <Cylinder args={[r * 1.06, r * 1.06, r * 0.06, 24]} position={[0, y || 0, 0]}>
      {xray ? <meshBasicMaterial {...xrayMat(darkAccent)} /> :
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.2)} />}
    </Cylinder>
  );

  // Industrial joint with double-disc + axis
  const IndustrialJoint = ({ r, thickness, showMotor }: { r: number; thickness?: number; showMotor?: boolean }) => {
    const t = thickness || r * 0.5;
    if (xray) {
      return (
        <group>
          <Cylinder args={[r, r, t, 24]}>
            <meshBasicMaterial {...xrayMat(jointColor)} />
          </Cylinder>
        </group>
      );
    }
    return (
      <group>
        {/* Side discs */}
        <Cylinder args={[r * 1.12, r * 1.12, t * 0.12, 24]} position={[0, t * 0.48, 0]}>
          <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.25)} />
        </Cylinder>
        <Cylinder args={[r * 1.12, r * 1.12, t * 0.12, 24]} position={[0, -t * 0.48, 0]}>
          <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.25)} />
        </Cylinder>
        {/* Central joint body */}
        <Cylinder args={[r, r, t, 24]}>
          <meshStandardMaterial {...mechMat(jointColor, selected, 0.55, 0.35)} />
        </Cylinder>
        {/* Center hub cap */}
        <Cylinder args={[r * 0.35, r * 0.35, t * 0.6, 16]}>
          <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
        </Cylinder>
        {/* Motor housing (side protrusion) */}
        {showMotor !== false && (
          <>
            <Cylinder args={[jointR * 0.38, jointR * 0.38, jointR * 1.8, 14]}
              rotation={[0, 0, Math.PI / 2]} position={[jointR * 1.0, 0, 0]}>
              <meshStandardMaterial {...mechMat(baseColor, selected, 0.65, 0.3)} />
            </Cylinder>
            <Cylinder args={[jointR * 0.42, jointR * 0.42, jointR * 0.15, 14]}
              rotation={[0, 0, Math.PI / 2]} position={[jointR * 1.9, 0, 0]}>
              <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.25)} />
            </Cylinder>
          </>
        )}
      </group>
    );
  };

  // Shoulder housing — wrap-around shell
  const ShoulderHousing = () => {
    const shellW = baseR * 1.3;
    const shellD = baseR * 0.9;
    if (xray) {
      return (
        <group position={[0, h * 0.04 + baseTowerH + shoulderShellH / 2, 0]}>
          <Box args={[shellW, shoulderShellH, shellD]}>
            <meshBasicMaterial {...xrayMat(bodyColor)} />
          </Box>
        </group>
      );
    }
    return (
      <group position={[0, h * 0.04 + baseTowerH + shoulderShellH / 2, 0]}>
        {/* Main housing body */}
        <Box args={[shellW, shoulderShellH, shellD]}>
          <meshStandardMaterial {...mechMat(bodyColor, selected, 0.5, 0.4)} />
        </Box>
        {/* Rounded front/back covers */}
        <Cylinder args={[shellD * 0.5, shellD * 0.5, shellW, 20]}
          rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial {...mechMat(bodyColor, selected, 0.48, 0.42)} />
        </Cylinder>
        {/* Side motor covers (protruding) */}
        {[1, -1].map(side => (
          <group key={`motor-cover-${side}`}>
            <Box args={[shellW * 0.18, shoulderShellH * 0.7, shellD * 1.15]}
              position={[side * shellW * 0.58, 0, 0]}>
              <meshStandardMaterial {...mechMat(bodyColor, selected, 0.48, 0.45)} />
            </Box>
            <Cylinder args={[shoulderShellH * 0.25, shoulderShellH * 0.25, shellW * 0.2, 16]}
              rotation={[0, 0, Math.PI / 2]}
              position={[side * shellW * 0.68, 0, 0]}>
              <meshStandardMaterial {...mechMat(baseColor, selected, 0.65, 0.3)} />
            </Cylinder>
          </group>
        ))}
        {/* Top accent line */}
        <Box args={[shellW * 0.8, shoulderShellH * 0.02, shellD * 0.6]}
          position={[0, shoulderShellH * 0.48, 0]}>
          <meshStandardMaterial {...mechMat(darkAccent, selected, 0.5, 0.4)} />
        </Box>
        {/* Seal ring at bottom */}
        <SealRing r={baseR * 0.6} y={-shoulderShellH * 0.5} />
      </group>
    );
  };

  // Upper arm (Link 2) — rounded rectangular profile with ribs
  const UpperArm = () => {
    if (xray) {
      return (
        <group>
          <Box args={[armW, arm1L, armD]} position={[0, arm1L / 2, 0]}>
            <meshBasicMaterial {...xrayMat(bodyColor)} />
          </Box>
        </group>
      );
    }
    return (
      <group>
        {/* Main arm body */}
        <Box args={[armW, arm1L, armD]} position={[0, arm1L / 2, 0]}>
          <meshStandardMaterial {...mechMat(bodyColor, selected, 0.5, 0.4)} />
        </Box>
        {/* Rounded side edges (simulated with half-cylinders) */}
        {[1, -1].map(side => (
          <Cylinder key={`arm1-edge-${side}`} args={[armD * 0.5, armD * 0.5, arm1L * 0.96, 12, 1, false, 0, Math.PI]}
            position={[side * armW * 0.5, arm1L / 2, 0]}
            rotation={[0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <meshStandardMaterial {...mechMat(bodyColor, selected, 0.48, 0.42)} />
          </Cylinder>
        ))}
        {/* Top reinforcement rib */}
        <Box args={[armW * 0.15, arm1L * 0.9, armD * 0.08]}
          position={[0, arm1L * 0.5, armD * 0.54]}>
          <meshStandardMaterial {...mechMat(bodyColor, selected, 0.45, 0.5)} />
        </Box>
        {/* Bottom reinforcement rib */}
        <Box args={[armW * 0.15, arm1L * 0.9, armD * 0.08]}
          position={[0, arm1L * 0.5, -armD * 0.54]}>
          <meshStandardMaterial {...mechMat(bodyColor, selected, 0.45, 0.5)} />
        </Box>
        {/* KUKA label area (side rectangle) */}
        <Box args={[armW * 0.01, arm1L * 0.35, armD * 0.55]}
          position={[armW * 0.52, arm1L * 0.55, 0]}>
          <meshStandardMaterial {...mechMat(labelColor, selected, 0.2, 0.8)} />
        </Box>
        {/* Cable harness along back */}
        <Cylinder args={[armW * 0.065, armW * 0.065, arm1L * 0.85, 8]}
          position={[armW * 0.42, arm1L * 0.48, -armD * 0.45]}>
          <meshStandardMaterial {...mechMat(cableColor, selected, 0.05, 0.95)} />
        </Cylinder>
        {/* Cable clip */}
        {[0.25, 0.5, 0.75].map(frac => (
          <Box key={`clip-${frac}`} args={[armW * 0.18, armW * 0.04, armW * 0.04]}
            position={[armW * 0.42, arm1L * frac, -armD * 0.52]}>
            <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
          </Box>
        ))}
      </group>
    );
  };

  // Forearm (Link 3) — tapered conical with side plates
  const Forearm = () => {
    if (xray) {
      return (
        <group>
          <Cylinder args={[armW * 0.42, armW * 0.28, arm2L, 16]} position={[0, arm2L / 2, 0]}>
            <meshBasicMaterial {...xrayMat(bodyColor)} />
          </Cylinder>
        </group>
      );
    }
    return (
      <group>
        {/* Tapered main body */}
        <Cylinder args={[armW * 0.42, armW * 0.28, arm2L, 18]} position={[0, arm2L / 2, 0]}>
          <meshStandardMaterial {...mechMat(bodyColor, selected, 0.5, 0.4)} />
        </Cylinder>
        {/* Side reinforcement plates */}
        {[1, -1].map(side => (
          <Box key={`arm2-plate-${side}`} args={[armW * 0.05, arm2L * 0.85, armD * 0.9]}
            position={[side * armW * 0.45, arm2L * 0.48, 0]}>
            <meshStandardMaterial {...mechMat(bodyColor, selected, 0.45, 0.5)} />
          </Box>
        ))}
        {/* Cable routing */}
        <Cylinder args={[armW * 0.045, armW * 0.045, arm2L * 0.8, 6]}
          position={[armW * 0.38, arm2L * 0.45, -armD * 0.35]}>
          <meshStandardMaterial {...mechMat(cableColor, selected, 0.05, 0.95)} />
        </Cylinder>
      </group>
    );
  };

  // Compact 3-axis wrist (J4/J5/J6)
  const CompactWrist = () => {
    const j4L = wristTotalL * 0.4;  // J4 inline rotation
    const j5L = wristTotalL * 0.3;  // J5 pitch
    const j6L = wristTotalL * 0.3;  // J6 + flange
    const wristR = armW * 0.22;

    if (xray) {
      return (
        <group>
          <Cylinder args={[wristR, wristR, wristTotalL, 14]} position={[0, wristTotalL / 2, 0]}>
            <meshBasicMaterial {...xrayMat(bodyColor)} />
          </Cylinder>
          <Cylinder args={[flangeR, flangeR, h * 0.025, 16]}
            position={[0, wristTotalL + h * 0.015, 0]}>
            <meshBasicMaterial {...xrayMat(flangeColor)} />
          </Cylinder>
        </group>
      );
    }

    return (
      <group>
        {/* J4 — inline rotation segment */}
        <Cylinder args={[wristR * 1.1, wristR, j4L, 16]} position={[0, j4L / 2, 0]}>
          <meshStandardMaterial {...mechMat(bodyColor, selected, 0.5, 0.4)} />
        </Cylinder>
        <SealRing r={wristR * 1.05} y={0} />

        {/* J5 — pitch joint */}
        <group position={[0, j4L, 0]}>
          <Cylinder args={[wristR * 1.15, wristR * 1.15, j5L * 0.6, 18]}>
            <meshStandardMaterial {...mechMat(jointColor, selected, 0.55, 0.35)} />
          </Cylinder>
          <Cylinder args={[wristR * 1.2, wristR * 1.2, j5L * 0.12, 18]} position={[0, j5L * 0.35, 0]}>
            <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.25)} />
          </Cylinder>
          <Cylinder args={[wristR * 1.2, wristR * 1.2, j5L * 0.12, 18]} position={[0, -j5L * 0.35, 0]}>
            <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.25)} />
          </Cylinder>
        </group>

        {/* J6 — end rotation + flange */}
        <group position={[0, j4L + j5L, 0]}>
          <Cylinder args={[wristR * 0.9, wristR * 0.85, j6L * 0.5, 14]}>
            <meshStandardMaterial {...mechMat(bodyColor, selected, 0.5, 0.4)} />
          </Cylinder>
          {/* Flange adapter */}
          <Cylinder args={[flangeR * 0.9, flangeR * 0.85, h * 0.025, 14]}
            position={[0, j6L * 0.4, 0]}>
            <meshStandardMaterial {...mechMat(darkAccent, selected, 0.65, 0.3)} />
          </Cylinder>
          {/* Yellow flange disc */}
          <Cylinder args={[flangeR, flangeR, h * 0.02, 22]}
            position={[0, j6L * 0.55, 0]}>
            <meshStandardMaterial {...mechMat(flangeColor, selected, 0.5, 0.35)} />
          </Cylinder>
          {/* Flange bolt pattern */}
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
              <Cylinder key={`fb-${i}`} args={[flangeR * 0.1, flangeR * 0.1, h * 0.008, 6]}
                position={[Math.cos(angle) * flangeR * 0.72, j6L * 0.57, Math.sin(angle) * flangeR * 0.72]}>
                <meshStandardMaterial {...mechMat(darkAccent, selected, 0.8, 0.2)} />
              </Cylinder>
            );
          })}
          {/* Crosshair markings */}
          <Box args={[flangeR * 1.5, h * 0.002, flangeR * 0.02]}
            position={[0, j6L * 0.565, 0]}>
            <meshStandardMaterial color="#dc2626" metalness={0.3} roughness={0.7} />
          </Box>
          <Box args={[flangeR * 0.02, h * 0.002, flangeR * 1.5]}
            position={[0, j6L * 0.565, 0]}>
            <meshStandardMaterial color="#dc2626" metalness={0.3} roughness={0.7} />
          </Box>
          {/* Locating pin */}
          <Cylinder args={[flangeR * 0.06, flangeR * 0.06, h * 0.015, 8]}
            position={[flangeR * 0.5, j6L * 0.58, 0]}>
            <meshStandardMaterial {...mechMat('#94a3b8', selected, 0.7, 0.2)} />
          </Cylinder>
        </group>
      </group>
    );
  };

  const shoulderTop = h * 0.04 + baseTowerH + shoulderShellH;

  if (xray) {
    return (
      <group>
        {/* Base */}
        <Cylinder args={[baseR * 1.1, baseR * 1.15, baseFlangeH, 24]} position={[0, baseFlangeH / 2, 0]}>
          <meshBasicMaterial {...xrayMat(darkAccent)} />
        </Cylinder>
        <Cylinder args={[baseR, baseR * 0.95, baseTowerH, 24]} position={[0, baseFlangeH + baseTowerH / 2, 0]}>
          <meshBasicMaterial {...xrayMat(baseColor)} />
        </Cylinder>
        <ShoulderHousing />
        {/* Arm chain */}
        <group position={[0, shoulderTop, 0]} rotation={[0, 0, 1.05]}>
          <UpperArm />
          <group position={[0, arm1L, 0]}>
            <Cylinder args={[jointR * 0.85, jointR * 0.85, jointR * 0.5, 20]}>
              <meshBasicMaterial {...xrayMat(jointColor)} />
            </Cylinder>
          </group>
          <group position={[0, arm1L, 0]} rotation={[0, 0, -1.8]}>
            <Forearm />
            <group position={[0, arm2L, 0]}>
              <Cylinder args={[jointR * 0.6, jointR * 0.6, jointR * 0.35, 16]}>
                <meshBasicMaterial {...xrayMat(jointColor)} />
              </Cylinder>
            </group>
            <group position={[0, arm2L, 0]} rotation={[0, 0, -0.5]}>
              <CompactWrist />
            </group>
          </group>
        </group>
      </group>
    );
  }

  return (
    <group>
      {/* ===== BASE FLANGE (底部安装法兰) ===== */}
      <Cylinder args={[baseR * 1.1, baseR * 1.15, baseFlangeH, 28]} position={[0, baseFlangeH / 2, 0]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.25)} />
      </Cylinder>
      {/* Hex bolt pattern */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <Cylinder key={`bb-${i}`} args={[baseR * 0.04, baseR * 0.04, baseFlangeH * 0.5, 6]}
            position={[Math.cos(angle) * baseR * 1.08, baseFlangeH * 0.8, Math.sin(angle) * baseR * 1.08]}>
            <meshStandardMaterial {...mechMat('#94a3b8', selected, 0.8, 0.2)} />
          </Cylinder>
        );
      })}

      {/* ===== BASE TOWER (锥形底座塔) ===== */}
      <Cylinder args={[baseR * 0.95, baseR, baseTowerH, 28]} position={[0, baseFlangeH + baseTowerH / 2, 0]}>
        <meshStandardMaterial {...mechMat(baseColor, selected, 0.6, 0.35)} />
      </Cylinder>
      {/* Base accent rings */}
      <Cylinder args={[baseR * 1.02, baseR * 1.02, h * 0.01, 28]} position={[0, baseFlangeH + baseTowerH * 0.3, 0]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.3)} />
      </Cylinder>
      {/* Turntable ring at top */}
      <SealRing r={baseR * 0.98} y={baseFlangeH + baseTowerH} />

      {/* ===== SHOULDER HOUSING (肩部包裹外壳) ===== */}
      <ShoulderHousing />

      {/* ===== SHOULDER JOINT (J2) ===== */}
      <group position={[0, shoulderTop, 0]}>
        <IndustrialJoint r={jointR} thickness={jointR * 0.6} showMotor={true} />
      </group>

      {/* ===== KINEMATIC CHAIN ===== */}
      <group position={[0, shoulderTop, 0]} rotation={[0, 0, 1.05]}>
        {/* Upper arm */}
        <UpperArm />

        {/* Elbow joint (J3) */}
        <group position={[0, arm1L, 0]}>
          <IndustrialJoint r={jointR * 0.85} thickness={jointR * 0.5} showMotor={true} />
          <SealRing r={jointR * 0.9} y={jointR * 0.3} />
        </group>

        {/* Forearm chain */}
        <group position={[0, arm1L, 0]} rotation={[0, 0, -1.8]}>
          <Forearm />

          {/* Wrist joint (J4 entry) */}
          <group position={[0, arm2L, 0]}>
            <IndustrialJoint r={jointR * 0.6} thickness={jointR * 0.35} showMotor={false} />
          </group>

          {/* Compact 3-axis wrist */}
          <group position={[0, arm2L, 0]} rotation={[0, 0, -0.5]}>
            <CompactWrist />
          </group>
        </group>
      </group>
    </group>
  );
}

function ConveyorModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  const rollerR = Math.min(h, d) * 0.25;
  const rollerCount = 5;

  // High-contrast: green belt, light gray frame
  const beltColor = '#22c55e';
  const beltStripe = '#16a34a';
  const frameColor = '#e2e8f0';
  const legColor = '#1e293b';

  if (xray) {
    return (
      <group>
        <Box args={[w, h * 0.28, d]} position={[0, h * 0.5, 0]}>
          <meshBasicMaterial {...xrayMat(beltColor)} />
        </Box>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <Box key={`leg-${i}`} args={[w * 0.06, h * 0.35, d * 0.06]}
            position={[sx * w * 0.4, h * 0.175, sz * d * 0.4]}>
            <meshBasicMaterial {...xrayMat(frameColor)} />
          </Box>
        ))}
      </group>
    );
  }

  return (
    <group>
      <Box args={[w, h * 0.28, d]} position={[0, h * 0.5, 0]}>
        <meshStandardMaterial {...rubberMat(beltColor, selected)} />
      </Box>
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={`stripe-${i}`} args={[w * 0.01, h * 0.29, d * 0.98]}
          position={[-w * 0.4 + (i / 7) * w * 0.8, h * 0.5, 0]}>
          <meshStandardMaterial {...rubberMat(beltStripe, selected)} />
        </Box>
      ))}
      {Array.from({ length: rollerCount }).map((_, i) => {
        const xPos = -w * 0.42 + (i / (rollerCount - 1)) * w * 0.84;
        return (
          <Cylinder key={`roller-${i}`} args={[rollerR, rollerR, d * 0.92, 12]}
            rotation={[Math.PI / 2, 0, 0]} position={[xPos, h * 0.35, 0]}>
            <meshStandardMaterial {...mechMat('#94a3b8', selected, 0.5, 0.35)} />
          </Cylinder>
        );
      })}
      <Box args={[w * 1.02, h * 0.15, d * 0.04]} position={[0, h * 0.58, -d * 0.52]}>
        <meshStandardMaterial {...mechMat(frameColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 1.02, h * 0.15, d * 0.04]} position={[0, h * 0.58, d * 0.52]}>
        <meshStandardMaterial {...mechMat(frameColor, selected, 0.6, 0.3)} />
      </Box>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={`leg-${i}`} args={[w * 0.06, h * 0.35, d * 0.06]}
          position={[sx * w * 0.4, h * 0.175, sz * d * 0.4]}>
          <meshStandardMaterial {...mechMat(legColor, selected, 0.6, 0.35)} />
        </Box>
      ))}
      <Box args={[w * 0.86, h * 0.04, d * 0.04]} position={[0, h * 0.08, -d * 0.4]}>
        <meshStandardMaterial {...mechMat(legColor, selected, 0.6, 0.35)} />
      </Box>
      <Box args={[w * 0.86, h * 0.04, d * 0.04]} position={[0, h * 0.08, d * 0.4]}>
        <meshStandardMaterial {...mechMat(legColor, selected, 0.6, 0.35)} />
      </Box>
    </group>
  );
}

function CylinderModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  const r = Math.min(w, d) * 0.35;

  // High-contrast: sky blue body, silver piston
  const bodyColor = '#0ea5e9';
  const capColor = '#1e293b';
  const pistonColor = '#e5e7eb';

  if (xray) {
    return (
      <group>
        <Cylinder args={[r, r, h, 20]} position={[0, h * 0.5, 0]}>
          <meshBasicMaterial {...xrayMat(bodyColor)} />
        </Cylinder>
        <Cylinder args={[r * 0.22, r * 0.22, h * 0.4, 10]} position={[0, h * 0.9, 0]}>
          <meshBasicMaterial {...xrayMat(pistonColor)} />
        </Cylinder>
      </group>
    );
  }

  return (
    <group>
      <Cylinder args={[r, r, h, 20]} position={[0, h * 0.5, 0]}>
        <meshStandardMaterial {...mechMat(bodyColor, selected, 0.55, 0.3)} />
      </Cylinder>
      <Cylinder args={[r * 1.08, r * 1.08, h * 0.06, 20]} position={[0, h * 0.97, 0]}>
        <meshStandardMaterial {...mechMat(capColor, selected, 0.65, 0.25)} />
      </Cylinder>
      <Cylinder args={[r * 1.08, r * 1.08, h * 0.06, 20]} position={[0, h * 0.03, 0]}>
        <meshStandardMaterial {...mechMat(capColor, selected, 0.65, 0.25)} />
      </Cylinder>
      <Cylinder args={[r * 0.22, r * 0.22, h * 0.4, 10]} position={[0, h * 0.9, 0]}>
        <meshStandardMaterial {...mechMat(pistonColor, selected, 0.75, 0.15)} />
      </Cylinder>
      <Cylinder args={[r * 0.2, r * 0.2, d * 0.15, 10]} rotation={[Math.PI / 2, 0, 0]} position={[-r * 0.05, h * 0.03, r * 1.2]}>
        <meshStandardMaterial {...mechMat(capColor, selected, 0.6, 0.3)} />
      </Cylinder>
      <Cylinder args={[r * 0.2, r * 0.2, d * 0.15, 10]} rotation={[Math.PI / 2, 0, 0]} position={[-r * 0.05, h * 0.03, -r * 1.2]}>
        <meshStandardMaterial {...mechMat(capColor, selected, 0.6, 0.3)} />
      </Cylinder>
      <Cylinder args={[r * 0.1, r * 0.08, h * 0.08, 8]} position={[r * 0.8, h * 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial {...mechMat('#d4a017', selected, 0.7, 0.2)} />
      </Cylinder>
      <Cylinder args={[r * 0.1, r * 0.08, h * 0.08, 8]} position={[r * 0.8, h * 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial {...mechMat('#d4a017', selected, 0.7, 0.2)} />
      </Cylinder>
    </group>
  );
}

function GripperModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  const jawW = w * 0.15;

  // High-contrast: purple body, light purple jaws
  const bodyColor = '#8b5cf6';
  const jawColor = '#c4b5fd';
  const darkAccent = '#1e293b';

  if (xray) {
    return (
      <group>
        <Box args={[w * 0.4, h * 0.5, d * 0.6]} position={[0, h * 0.5, 0]}>
          <meshBasicMaterial {...xrayMat(bodyColor)} />
        </Box>
        <Box args={[jawW, h * 0.65, d * 0.2]} position={[-w * 0.35, h * 0.35, 0]}>
          <meshBasicMaterial {...xrayMat(jawColor)} />
        </Box>
        <Box args={[jawW, h * 0.65, d * 0.2]} position={[w * 0.35, h * 0.35, 0]}>
          <meshBasicMaterial {...xrayMat(jawColor)} />
        </Box>
      </group>
    );
  }

  return (
    <group>
      <Cylinder args={[w * 0.18, w * 0.18, h * 0.06, 16]} position={[0, h * 0.82, 0]}>
        <meshStandardMaterial {...mechMat('#c0c0c0', selected, 0.6, 0.3)} />
      </Cylinder>
      <Box args={[w * 0.4, h * 0.5, d * 0.6]} position={[0, h * 0.5, 0]}>
        <meshStandardMaterial {...mechMat(bodyColor, selected, 0.55, 0.35)} />
      </Box>
      <Box args={[w * 0.75, h * 0.04, d * 0.08]} position={[0, h * 0.4, d * 0.2]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.75, h * 0.04, d * 0.08]} position={[0, h * 0.4, -d * 0.2]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[jawW, h * 0.65, d * 0.2]} position={[-w * 0.35, h * 0.35, 0]}>
        <meshStandardMaterial {...mechMat(jawColor, selected, 0.55, 0.35)} />
      </Box>
      <Cone args={[jawW * 0.5, h * 0.12, 8]} position={[-w * 0.35, h * 0.02, 0]}>
        <meshStandardMaterial {...mechMat('#e2e8f0', selected, 0.6, 0.25)} />
      </Cone>
      <Box args={[jawW, h * 0.65, d * 0.2]} position={[w * 0.35, h * 0.35, 0]}>
        <meshStandardMaterial {...mechMat(jawColor, selected, 0.55, 0.35)} />
      </Box>
      <Cone args={[jawW * 0.5, h * 0.12, 8]} position={[w * 0.35, h * 0.02, 0]}>
        <meshStandardMaterial {...mechMat('#e2e8f0', selected, 0.6, 0.25)} />
      </Cone>
      <Cylinder args={[w * 0.04, w * 0.03, h * 0.08, 6]} position={[w * 0.22, h * 0.72, d * 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial {...mechMat('#d4a017', selected, 0.7, 0.2)} />
      </Cylinder>
    </group>
  );
}

function TurntableModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  const r = Math.max(w, d) * 0.45;

  // High-contrast: blue disc, light blue base
  const discColor = '#2563eb';
  const baseColor = '#bfdbfe';
  const darkAccent = '#1e293b';

  if (xray) {
    return (
      <group>
        <Cylinder args={[r * 0.8, r, h * 0.4, 24]} position={[0, h * 0.2, 0]}>
          <meshBasicMaterial {...xrayMat(baseColor)} />
        </Cylinder>
        <Cylinder args={[r, r, h * 0.08, 24]} position={[0, h * 0.46, 0]}>
          <meshBasicMaterial {...xrayMat(discColor)} />
        </Cylinder>
      </group>
    );
  }

  return (
    <group>
      <Cylinder args={[r * 0.8, r, h * 0.4, 24]} position={[0, h * 0.2, 0]}>
        <meshStandardMaterial {...mechMat(baseColor, selected, 0.55, 0.35)} />
      </Cylinder>
      {[0, 1, 2, 3].map(i => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <Cylinder key={`mount-${i}`} args={[r * 0.06, r * 0.06, h * 0.02, 8]}
            position={[Math.cos(angle) * r * 0.88, h * 0.01, Math.sin(angle) * r * 0.88]}>
            <meshStandardMaterial {...mechMat(darkAccent, selected, 0.3, 0.5)} />
          </Cylinder>
        );
      })}
      <Cylinder args={[r * 0.55, r * 0.55, h * 0.04, 24]} position={[0, h * 0.4, 0]}>
        <meshStandardMaterial {...mechMat('#94a3b8', selected, 0.7, 0.2)} />
      </Cylinder>
      <Cylinder args={[r * 0.45, r * 0.45, h * 0.05, 24]} position={[0, h * 0.4, 0]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.7, 0.2)} />
      </Cylinder>
      <Cylinder args={[r, r, h * 0.08, 24]} position={[0, h * 0.46, 0]}>
        <meshStandardMaterial {...mechMat(discColor, selected, 0.5, 0.35)} />
      </Cylinder>
      {[0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <Cylinder key={`pin-${i}`} args={[r * 0.04, r * 0.04, h * 0.08, 8]}
            position={[Math.cos(angle) * r * 0.75, h * 0.54, Math.sin(angle) * r * 0.75]}>
            <meshStandardMaterial {...mechMat('#e5e7eb', selected, 0.7, 0.2)} />
          </Cylinder>
        );
      })}
    </group>
  );
}

function LiftModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  const pillarW = w * 0.1;

  // High-contrast: yellow frame, light yellow platform
  const frameColor = '#f59e0b';
  const platformColor = '#fef3c7';
  const darkAccent = '#1e293b';
  const scissorColor = '#94a3b8';

  if (xray) {
    return (
      <group>
        <Box args={[pillarW, h, pillarW]} position={[-w * 0.35, h * 0.5, 0]}>
          <meshBasicMaterial {...xrayMat(frameColor)} />
        </Box>
        <Box args={[pillarW, h, pillarW]} position={[w * 0.35, h * 0.5, 0]}>
          <meshBasicMaterial {...xrayMat(frameColor)} />
        </Box>
        <Box args={[w * 0.8, h * 0.06, d * 0.8]} position={[0, h * 0.6, 0]}>
          <meshBasicMaterial {...xrayMat(platformColor)} />
        </Box>
      </group>
    );
  }

  return (
    <group>
      <Box args={[w * 0.9, h * 0.04, d * 0.7]} position={[0, h * 0.02, 0]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[pillarW, h, pillarW]} position={[-w * 0.35, h * 0.5, 0]}>
        <meshStandardMaterial {...mechMat(frameColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[pillarW * 0.3, h * 0.9, pillarW * 0.3]} position={[-w * 0.35 + pillarW * 0.4, h * 0.5, 0]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[pillarW, h, pillarW]} position={[w * 0.35, h * 0.5, 0]}>
        <meshStandardMaterial {...mechMat(frameColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[pillarW * 0.3, h * 0.9, pillarW * 0.3]} position={[w * 0.35 - pillarW * 0.4, h * 0.5, 0]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.55, h * 0.03, d * 0.06]} position={[0, h * 0.35, d * 0.15]} rotation={[0, 0, 0.4]}>
        <meshStandardMaterial {...mechMat(scissorColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.55, h * 0.03, d * 0.06]} position={[0, h * 0.35, d * 0.15]} rotation={[0, 0, -0.4]}>
        <meshStandardMaterial {...mechMat(scissorColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.55, h * 0.03, d * 0.06]} position={[0, h * 0.35, -d * 0.15]} rotation={[0, 0, 0.4]}>
        <meshStandardMaterial {...mechMat(scissorColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.55, h * 0.03, d * 0.06]} position={[0, h * 0.35, -d * 0.15]} rotation={[0, 0, -0.4]}>
        <meshStandardMaterial {...mechMat(scissorColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.8, h * 0.06, d * 0.8]} position={[0, h * 0.6, 0]}>
        <meshStandardMaterial {...mechMat(platformColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.78, h * 0.01, d * 0.78]} position={[0, h * 0.635, 0]}>
        <meshStandardMaterial {...mechMat('#fde68a', selected, 0.5, 0.4)} />
      </Box>
    </group>
  );
}

function StopModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  // High-contrast: bright red blocker, light red base
  const blockerColor = '#ef4444';
  const baseColor = '#fca5a5';
  const darkAccent = '#1e293b';

  if (xray) {
    return (
      <group>
        <Box args={[w * 0.5, h * 0.4, d * 0.5]} position={[0, h * 0.2, 0]}>
          <meshBasicMaterial {...xrayMat(baseColor)} />
        </Box>
        <Box args={[w * 0.8, h * 0.7, d * 0.08]} position={[0, h * 0.55, d * 0.25]}>
          <meshBasicMaterial {...xrayMat(blockerColor)} />
        </Box>
      </group>
    );
  }

  return (
    <group>
      <Box args={[w * 0.5, h * 0.4, d * 0.5]} position={[0, h * 0.2, 0]}>
        <meshStandardMaterial {...mechMat(baseColor, selected, 0.5, 0.4)} />
      </Box>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Cylinder key={`bolt-${i}`} args={[w * 0.025, w * 0.025, h * 0.06, 6]}
          position={[sx * w * 0.2, h * 0.01, sz * d * 0.2]}>
          <meshStandardMaterial {...mechMat('#c0c0c0', selected, 0.7, 0.2)} />
        </Cylinder>
      ))}
      <Cylinder args={[w * 0.04, w * 0.04, h * 0.35, 8]} position={[0, h * 0.4 + h * 0.175, -d * 0.1]}>
        <meshStandardMaterial {...mechMat('#94a3b8', selected, 0.7, 0.2)} />
      </Cylinder>
      <Box args={[w * 0.8, h * 0.7, d * 0.08]} position={[0, h * 0.55, d * 0.25]}>
        <meshStandardMaterial {...mechMat(blockerColor, selected, 0.5, 0.35)} />
      </Box>
      <Box args={[w * 0.7, h * 0.5, d * 0.04]} position={[0, h * 0.55, d * 0.31]}>
        <meshStandardMaterial {...rubberMat(darkAccent, selected)} />
      </Box>
    </group>
  );
}

function CameraMountModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  // High-contrast: silver-white bracket, gray details
  const bracketColor = '#e2e8f0';
  const detailColor = '#94a3b8';
  const darkAccent = '#1e293b';

  if (xray) {
    return (
      <group>
        <Box args={[w * 0.12, h, d * 0.12]} position={[0, h * 0.5, -d * 0.3]}>
          <meshBasicMaterial {...xrayMat(bracketColor)} />
        </Box>
        <Box args={[w * 0.6, h * 0.08, d * 0.1]} position={[0, h * 0.9, 0]}>
          <meshBasicMaterial {...xrayMat(detailColor)} />
        </Box>
      </group>
    );
  }

  return (
    <group>
      <Box args={[w * 0.35, h * 0.04, d * 0.35]} position={[0, h * 0.02, -d * 0.3]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.12, h, d * 0.12]} position={[0, h * 0.5, -d * 0.3]}>
        <meshStandardMaterial {...mechMat(bracketColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.6, h * 0.08, d * 0.1]} position={[0, h * 0.9, 0]}>
        <meshStandardMaterial {...mechMat(detailColor, selected, 0.6, 0.3)} />
      </Box>
      <Box args={[w * 0.04, h * 0.35, d * 0.04]}
        position={[0, h * 0.72, -d * 0.12]}
        rotation={[0.6, 0, 0]}>
        <meshStandardMaterial {...mechMat(bracketColor, selected, 0.6, 0.3)} />
      </Box>
      <Sphere args={[w * 0.04, 10, 10]} position={[w * 0.08, h * 0.9, -d * 0.08]}>
        <meshStandardMaterial {...mechMat(darkAccent, selected, 0.3, 0.6)} />
      </Sphere>
      <Cylinder args={[w * 0.025, w * 0.025, h * 0.7, 6]} position={[w * 0.1, h * 0.55, -d * 0.3]}>
        <meshStandardMaterial {...rubberMat('#1a1a1a', selected)} />
      </Cylinder>
    </group>
  );
}

function DefaultMechanismModel({ w, h, d, selected, xray }: { w: number; h: number; d: number; selected: boolean; xray?: boolean }) {
  const baseColor = '#f97316';
  const highlightColor = '#facc15';

  if (xray) {
    return (
      <group position={[0, h / 2, 0]}>
        <Box args={[w, h, d]}>
          <meshBasicMaterial {...xrayMat(baseColor)} />
        </Box>
      </group>
    );
  }

  return (
    <group position={[0, h / 2, 0]}>
      <Box args={[w, h, d]}>
        <meshStandardMaterial {...mechMat(baseColor, selected)} />
      </Box>
      <Box args={[w, h, d]}>
        <meshBasicMaterial color={selected ? highlightColor : baseColor} wireframe />
      </Box>
    </group>
  );
}

type ModelLoadErrorBoundaryProps = {
  loadKey: string;
  fallback: ReactNode;
  children: ReactNode;
  onError?: (loadKey: string, error: unknown) => void;
};

class ModelLoadErrorBoundary extends Component<ModelLoadErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onError?.(this.props.loadKey, error);
  }

  componentDidUpdate(prevProps: ModelLoadErrorBoundaryProps) {
    if (prevProps.loadKey !== this.props.loadKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// --- GLB Model Renderer (isolated instances via useRef) ---
function GLBModelRenderer({
  url,
  w,
  h,
  d,
  loadKey,
  onLoaded,
  fitMode = 'contain',
}: {
  url: string;
  w: number;
  h: number;
  d: number;
  loadKey: string;
  onLoaded?: (loadKey: string) => void;
  fitMode?: 'contain' | 'stretch';
}) {
  const proxied = toLocalProxyUrl(url);
  useGLTF.preload(proxied);
  const { scene } = useGLTF(proxied, undefined, undefined, (loader) => {
    loader.setCrossOrigin('anonymous');
  });
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    while (groupRef.current.children.length) {
      const child = groupRef.current.children[0];
      groupRef.current.remove(child);
    }
    const cloned = scene.clone(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const scaleX = size.x > 0 ? w / size.x : 1;
    const scaleY = size.y > 0 ? h / size.y : 1;
    const scaleZ = size.z > 0 ? d / size.z : 1;
    if (fitMode === 'stretch') {
      cloned.scale.set(scaleX, scaleY, scaleZ);
      cloned.position.set(-center.x * scaleX, -center.y * scaleY + h / 2, -center.z * scaleZ);
    } else {
      const uniformScale = Math.min(scaleX, scaleY, scaleZ);
      cloned.scale.setScalar(uniformScale);
      cloned.position.set(-center.x * uniformScale, -center.y * uniformScale + h / 2, -center.z * uniformScale);
    }

    groupRef.current.add(cloned);
    onLoaded?.(loadKey);
  }, [scene, w, h, d, loadKey, onLoaded, fitMode]);

  return <group ref={groupRef} />;
}

// --- Mechanism model with interaction type badge ---
function Mechanism3DModel({ obj, selected, dimmed, hasIllegalMount, objects, xrayMode, onModelLoaded, onModelFailed }: {
  obj: LayoutObject;
  selected: boolean;
  dimmed: boolean;
  hasIllegalMount: boolean;
  objects: LayoutObject[];
  xrayMode: boolean;
  onModelLoaded?: (loadKey: string) => void;
  onModelFailed?: (loadKey: string, error: unknown) => void;
}) {
  const w = (obj.width || 100) * SCALE;
  const h = (obj.height || 100) * SCALE;
  const d = ((obj as any).depth || 80) * SCALE;
  const mechType = obj.mechanismType || '';
  const highlightColor = '#facc15';
  const isCamType = isCameraMountable(mechType);
  const isProdType = isProductInteraction(mechType);

  let model: React.ReactNode;
  // Prioritize custom GLB model if available
  const modelLoadKey = getIsometricModelLoadKey(obj);
  const effectiveModelUrl = (obj as any).model3dUrl
    || (mechType === 'robot_arm' ? '/models/default-robot-arm.glb' : null);
  if (effectiveModelUrl && modelLoadKey) {
    const fallback = <DefaultMechanismModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />;
    model = (
      <ModelLoadErrorBoundary loadKey={modelLoadKey} fallback={fallback} onError={onModelFailed}>
        <Suspense fallback={fallback}>
          <GLBModelRenderer
            url={effectiveModelUrl}
            w={w}
            h={h}
            d={d}
            loadKey={modelLoadKey}
            onLoaded={onModelLoaded}
          />
        </Suspense>
      </ModelLoadErrorBoundary>
    );
  } else {
    switch (mechType) {
      case 'robot_arm': model = <RobotArmModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      case 'conveyor': model = <ConveyorModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      case 'cylinder': model = <CylinderModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      case 'gripper': model = <GripperModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      case 'turntable': model = <TurntableModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      case 'lift': model = <LiftModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      case 'stop': model = <StopModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      case 'camera_mount': model = <CameraMountModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
      default: model = <DefaultMechanismModel w={w} h={h} d={d} selected={selected} xray={xrayMode} />; break;
    }
  }

  const mountedCameras = objects.filter(o => o.type === 'camera' && o.mountedToMechanismId === obj.id);

  return (
    <group>
      {dimmed && !xrayMode && (
        <Box args={[w + 0.02, h + 0.02, d + 0.02]} position={[0, h / 2, 0]}>
          <meshBasicMaterial color="#0f172a" transparent opacity={0.7} depthWrite={false} />
        </Box>
      )}
      {model}
      {selected && !xrayMode && (
        <Box args={[w + 0.06, h + 0.06, d + 0.06]} position={[0, h / 2, 0]}>
          <meshBasicMaterial color={highlightColor} wireframe transparent opacity={0.5} />
        </Box>
      )}
      {hasIllegalMount && !xrayMode && (
        <Box args={[w + 0.08, h + 0.08, d + 0.08]} position={[0, h / 2, 0]}>
          <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.6} />
        </Box>
      )}
      <Billboard position={[0, h + 0.15, 0]}>
        <Text
          fontSize={0.16}
          color="#fafafa"
          anchorX="center"
          anchorY="bottom"
        >
          {obj.name || '机构'}
        </Text>
      </Billboard>
      <Billboard position={[0, h + 0.32, 0]}>
        <Text
          fontSize={0.12}
          color={isCamType ? '#60a5fa' : isProdType ? '#34d399' : '#94a3b8'}
          anchorX="center"
          anchorY="bottom"
        >
          {isCamType ? '📷 相机交互' : isProdType ? '📦 产品交互' : ''}
        </Text>
      </Billboard>
      {mountedCameras.length > 0 && isCamType && (
        <Billboard position={[0, h + 0.46, 0]}>
          <Text
            fontSize={0.10}
            color="#60a5fa"
            anchorX="center"
            anchorY="bottom"
          >
            {`已挂载 ${mountedCameras.length} 台相机`}
          </Text>
        </Billboard>
      )}
      {hasIllegalMount && (
        <Billboard position={[0, h + 0.46, 0]}>
          <Text
            fontSize={0.11}
            color="#ef4444"
            anchorX="center"
            anchorY="bottom"
          >
            ⚠ 非法相机挂载!
          </Text>
        </Billboard>
      )}
    </group>
  );
}

function ProductBox({
  dimensions,
  selected,
  dimmed,
  name,
  color,
}: {
  dimensions: { length: number; width: number; height: number };
  selected: boolean;
  dimmed: boolean;
  name: string;
  color: string;
}) {
  const w = dimensions.length * SCALE;
  const h = dimensions.height * SCALE;
  const d = dimensions.width * SCALE;
  const highlightColor = '#facc15';
  const edgeR = 0.008;

  const edges: { pos: [number, number, number]; rot: [number, number, number]; len: number }[] = [
    { pos: [-w/2, 0, -d/2], rot: [0, 0, 0], len: h },
    { pos: [w/2, 0, -d/2], rot: [0, 0, 0], len: h },
    { pos: [-w/2, 0, d/2], rot: [0, 0, 0], len: h },
    { pos: [w/2, 0, d/2], rot: [0, 0, 0], len: h },
    { pos: [0, h, -d/2], rot: [0, 0, Math.PI/2], len: w },
    { pos: [0, h, d/2], rot: [0, 0, Math.PI/2], len: w },
    { pos: [0, 0, -d/2], rot: [0, 0, Math.PI/2], len: w },
    { pos: [0, 0, d/2], rot: [0, 0, Math.PI/2], len: w },
    { pos: [-w/2, h, 0], rot: [Math.PI/2, 0, 0], len: d },
    { pos: [w/2, h, 0], rot: [Math.PI/2, 0, 0], len: d },
    { pos: [-w/2, 0, 0], rot: [Math.PI/2, 0, 0], len: d },
    { pos: [w/2, 0, 0], rot: [Math.PI/2, 0, 0], len: d },
  ];

  return (
    <>
      {dimmed && (
        <Box args={[w + 0.02, h + 0.02, d + 0.02]} position={[0, h / 2, 0]}>
          <meshBasicMaterial color="#0f172a" transparent opacity={0.7} depthWrite={false} />
        </Box>
      )}
      <group position={[0, h / 2, 0]}>
        <Box args={[w, h, d]}>
          <meshStandardMaterial
            color={selected ? highlightColor : color}
            transparent opacity={selected ? 0.7 : 0.4}
            emissive={selected ? highlightColor : '#000000'}
            emissiveIntensity={selected ? 0.3 : 0}
            metalness={0.1}
            roughness={0.6}
          />
        </Box>
        {edges.map((edge, i) => (
          <Cylinder key={`edge-${i}`} args={[edgeR, edgeR, edge.len, 4]}
            position={edge.pos} rotation={edge.rot}>
            <meshStandardMaterial color={selected ? highlightColor : color} metalness={0.3} roughness={0.5} />
          </Cylinder>
        ))}
        <Box args={[w * 0.15, h * 0.15, d * 0.01]} position={[0, 0, d / 2 + 0.005]}>
          <meshStandardMaterial color="#0891b2" metalness={0.2} roughness={0.5} />
        </Box>
        {selected && (
          <Box args={[w + 0.06, h + 0.06, d + 0.06]}>
            <meshBasicMaterial color={highlightColor} wireframe transparent opacity={0.5} />
          </Box>
        )}
      </group>
      <Billboard position={[0, h + 0.15, 0]}>
        <Text
          fontSize={0.18}
          color="#fafafa"
          anchorX="center"
          anchorY="bottom"
        >
          {name}
        </Text>
      </Billboard>
    </>
  );
}

const PRODUCT_COLORS = ['#06b6d4', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#14b8a6'];

function getStableProductColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  }
  return PRODUCT_COLORS[Math.abs(hash) % PRODUCT_COLORS.length];
}

function Product3DObject({
  obj,
  index,
  selected,
  dimmed,
  onModelLoaded,
  onModelFailed,
}: {
  obj: LayoutObject;
  index: number;
  selected: boolean;
  dimmed: boolean;
  onModelLoaded?: (loadKey: string) => void;
  onModelFailed?: (loadKey: string, error: unknown) => void;
}) {
  const dimensions = {
    length: Math.max(obj.productLength ?? 100, 1),
    width: Math.max(obj.productWidth ?? 100, 1),
    height: Math.max(obj.productHeight ?? 50, 1),
  };
  const w = dimensions.length * SCALE;
  const h = dimensions.height * SCALE;
  const d = dimensions.width * SCALE;
  const color = getStableProductColor(obj.productAssetId || obj.id);
  const label = `${obj.productIsPrimary ? '★ ' : ''}${index + 1}. ${obj.name || `产品 ${index + 1}`} · ${dimensions.length}×${dimensions.width}×${dimensions.height}mm`;
  const fallback = (
    <ProductBox dimensions={dimensions} selected={selected} dimmed={dimmed} name={label} color={color} />
  );
  const loadKey = getIsometricModelLoadKey(obj);

  if (!obj.model3dUrl || !loadKey) return fallback;

  return (
    <ModelLoadErrorBoundary loadKey={loadKey} fallback={fallback} onError={onModelFailed}>
      <Suspense fallback={fallback}>
        <group>
          {dimmed && (
            <Box args={[w + 0.02, h + 0.02, d + 0.02]} position={[0, h / 2, 0]}>
              <meshBasicMaterial color="#0f172a" transparent opacity={0.7} depthWrite={false} />
            </Box>
          )}
          <GLBModelRenderer
            url={obj.model3dUrl}
            w={w}
            h={h}
            d={d}
            loadKey={loadKey}
            onLoaded={onModelLoaded}
            fitMode="stretch"
          />
          {selected && (
            <Box args={[w + 0.06, h + 0.06, d + 0.06]} position={[0, h / 2, 0]}>
              <meshBasicMaterial color="#facc15" wireframe transparent opacity={0.6} />
            </Box>
          )}
          <Billboard position={[0, h + 0.15, 0]}>
            <Text fontSize={0.18} color="#fafafa" anchorX="center" anchorY="bottom">{label}</Text>
          </Billboard>
        </group>
      </Suspense>
    </ModelLoadErrorBoundary>
  );
}

function CameraProceduralModel({ obj, selected, dimmed }: { obj: LayoutObject; selected: boolean; dimmed: boolean }) {
  const isMounted = !!obj.mountedToMechanismId;
  const baseColor = isMounted ? '#16a34a' : '#3b82f6';
  const baseDark = isMounted ? '#15803d' : '#1d4ed8';
  const highlightColor = '#facc15';

  return (
    <group>
      {dimmed && (
        <Box args={[0.42, 0.37, 0.52]}>
          <meshBasicMaterial color="#0f172a" transparent opacity={0.7} depthWrite={false} />
        </Box>
      )}
      <Box args={[0.3, 0.25, 0.4]}>
        <meshStandardMaterial
          color={selected ? highlightColor : baseColor}
          emissive={selected ? highlightColor : '#000000'}
          emissiveIntensity={selected ? 0.3 : 0}
          metalness={0.5}
          roughness={0.35}
        />
      </Box>
      <Box args={[0.28, 0.22, 0.02]} position={[0, 0, 0.21]}>
        <meshStandardMaterial {...mechMat('#1a1a1a', selected, 0.3, 0.6)} />
      </Box>
      {Array.from({ length: 5 }).map((_, i) => (
        <Box key={`fin-${i}`} args={[0.26, 0.03, 0.015]}
          position={[0, -0.09 + i * 0.045, 0.2]}>
          <meshStandardMaterial {...mechMat('#2a2a2a', selected, 0.5, 0.4)} />
        </Box>
      ))}
      <group position={[0, -0.25, 0]} rotation={[Math.PI, 0, 0]}>
        <Cylinder args={[0.16, 0.16, 0.04, 16]} position={[0, -0.02, 0]}>
          <meshStandardMaterial {...mechMat('#374151', selected, 0.6, 0.25)} />
        </Cylinder>
        <Cone args={[0.14, 0.28, 12]}>
          <meshStandardMaterial
            color={selected ? highlightColor : baseDark}
            emissive={selected ? highlightColor : '#000000'}
            emissiveIntensity={selected ? 0.2 : 0}
            metalness={0.5}
            roughness={0.3}
          />
        </Cone>
        <Cylinder args={[0.04, 0.04, 0.02, 12]} position={[0, 0.15, 0]}>
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.1} transparent opacity={0.7} />
        </Cylinder>
      </group>
      <Sphere args={[0.02, 8, 8]} position={[0.12, 0.1, -0.2]}>
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.8}
          metalness={0.1}
          roughness={0.3}
        />
      </Sphere>
      {selected && (
        <Box args={[0.4, 0.35, 0.5]}>
          <meshBasicMaterial color={highlightColor} wireframe transparent opacity={0.5} />
        </Box>
      )}
    </group>
  );
}

function CameraObject({ obj, selected, dimmed }: { obj: LayoutObject; selected: boolean; dimmed: boolean }) {
  const w = (obj.width || 50) / 100;
  const h = (obj.height || 55) / 100;
  const d = w * 0.8; // approximate depth from width

  return (
    <group>
      {obj.model3dUrl ? (
        <Suspense fallback={<CameraProceduralModel obj={obj} selected={selected} dimmed={dimmed} />}>
          <GLBModelRenderer url={obj.model3dUrl} w={w} h={h} d={d} loadKey={`camera-${obj.id}`} />
        </Suspense>
      ) : (
        <CameraProceduralModel obj={obj} selected={selected} dimmed={dimmed} />
      )}
      <Billboard position={[0, 0.25, 0]}>
        <Text
          fontSize={0.16}
          color="#fafafa"
          anchorX="center"
          anchorY="bottom"
        >
          {obj.name || 'CAM'}
        </Text>
      </Billboard>
    </group>
  );
}

// --- Categorized relationship lines ---
interface RelLine {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  dashed: boolean;
  label: string;
  midpoint: [number, number, number];
  isIllegal: boolean;
  lineType: 'camera' | 'product' | 'illegal';
}

function getRobotArmFlangePosition(parent: LayoutObject): [number, number, number] {
  const h = (parent.height ?? 120) / 100;

  const waistH = h * 0.12;
  const baseTop = h * 0.09 + waistH;
  const arm1L = h * 0.30;
  const arm2L = h * 0.25;
  const arm3L = h * 0.18;
  const flangeLen = arm3L + h * 0.06;

  const theta1 = 0.5;
  const theta2 = theta1 - 1.2;
  const theta3 = theta2 - 0.6;

  const elbowX = -arm1L * Math.sin(theta1);
  const elbowY = baseTop + arm1L * Math.cos(theta1);

  const wristX = elbowX - arm2L * Math.sin(theta2);
  const wristY = elbowY + arm2L * Math.cos(theta2);

  const flangeX = wristX - flangeLen * Math.sin(theta3);
  const flangeY = wristY + flangeLen * Math.cos(theta3);

  const localFlange = new THREE.Vector3(flangeX, flangeY, 0);
  const rotatedFlange = applyWorldRotation(localFlange, parent.rotX ?? 0, parent.rotY ?? 0, parent.rotZ ?? 0);

  const parentX = (parent.posX ?? 0) * SCALE;
  const parentYWorld = (parent.posZ ?? 0) * SCALE;
  const parentZ = (parent.posY ?? 0) * SCALE;

  return [
    parentX + rotatedFlange.x,
    parentYWorld + rotatedFlange.y,
    parentZ + rotatedFlange.z,
  ];
}

// Precise 3D mount offset for mechanism types, matching actual model geometry
// Models are bottom-aligned: Y=0 is base, Y=h is top
function getMechMountOffset3D(
  mechType: string,
  w: number, h: number, d: number
): THREE.Vector3 {
  switch (mechType) {
    case 'conveyor':
      return new THREE.Vector3(0, h * 0.64, 0);       // belt surface
    case 'turntable':
      return new THREE.Vector3(0, h * 0.50, 0);       // disc surface
    case 'lift':
      return new THREE.Vector3(0, h * 0.63, 0);       // platform surface
    case 'stop':
      return new THREE.Vector3(w * 0.5, h * 0.40, 0); // stopper side center
    case 'cylinder':
      return new THREE.Vector3(w * 0.5, h * 0.50, 0); // cylinder side center
    case 'gripper':
      return new THREE.Vector3(0, 0, 0);               // grip bottom end
    case 'camera_mount':
      return new THREE.Vector3(0, h * 0.80, 0);       // bracket top area
    default:
      return new THREE.Vector3(0, h * 0.50, 0);       // geometric center
  }
}

// Get connection endpoint using precise mechanism-type-aware offsets with rotation
function getConnectionEndpoint3D(
  obj: LayoutObject,
  localOffset: THREE.Vector3,
): [number, number, number] {
  const cx = (obj.posX ?? 0) * SCALE;
  const cy = (obj.posZ ?? 0) * SCALE;
  const cz = (obj.posY ?? 0) * SCALE;

  const rotatedOffset = applyWorldRotation(localOffset, obj.rotX ?? 0, obj.rotY ?? 0, obj.rotZ ?? 0);

  return [cx + rotatedOffset.x, cy + rotatedOffset.y, cz + rotatedOffset.z];
}

// Camera center offset (cameras are origin-centered in 3D)
function getCameraEndpoint(obj: LayoutObject): [number, number, number] {
  return getConnectionEndpoint3D(obj, new THREE.Vector3(0, 0, 0));
}

function computeRelLines(objects: LayoutObject[]): RelLine[] {
  const result: RelLine[] = [];

  objects.forEach(obj => {
    if (!obj.mountedToMechanismId) return;
    const parent = objects.find(o => o.id === obj.mountedToMechanismId);
    if (!parent) return;

    const parentMechType = parent.mechanismType || '';
    const isRobotArm = parentMechType === 'robot_arm';

    const start = getCameraEndpoint(obj);
    const parentW = (parent.width ?? 100) / 100;
    const parentH = (parent.height ?? 100) / 100;
    const parentD = (parent.width ?? 100) / 100;
    const end: [number, number, number] = isRobotArm
      ? getRobotArmFlangePosition(parent)
      : getConnectionEndpoint3D(parent, getMechMountOffset3D(parentMechType, parentW, parentH, parentD));

    const mid: [number, number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2 + 0.15,
      (start[2] + end[2]) / 2,
    ];

    if (obj.type === 'camera') {
      const isLegal = isCameraMountable(parentMechType);
      result.push({
        start, end, midpoint: mid,
        color: isLegal ? '#3b82f6' : '#ef4444',
        dashed: !isLegal,
        label: isLegal ? (isRobotArm ? '法兰挂载' : '相机挂载') : '非法挂载',
        isIllegal: !isLegal,
        lineType: isLegal ? 'camera' : 'illegal',
      });
    } else {
      const isProductMech = isProductInteraction(parentMechType);
      result.push({
        start, end, midpoint: mid,
        color: isProductMech ? '#22d3ee' : '#f97316',
        dashed: false,
        label: '产品定位',
        isIllegal: false,
        lineType: 'product',
      });
    }
  });

  return result;
}

function RelationshipLineSegment({ line, baseWidth }: { line: RelLine; baseWidth: number }) {
  const lineRef = useRef<any>(null);
  const startMarkerRef = useRef<THREE.Group>(null);
  const endMarkerRef = useRef<THREE.Group>(null);
  const labelGroupRef = useRef<THREE.Group>(null);

  // Store current line data for useFrame updates
  const lineDataRef = useRef(line);
  lineDataRef.current = line;

  useFrame(() => {
    const l = lineDataRef.current;
    if (lineRef.current?.geometry) {
      const positions = lineRef.current.geometry.attributes.position;
      if (positions) {
        positions.setXYZ(0, l.start[0], l.start[1], l.start[2]);
        positions.setXYZ(1, l.end[0], l.end[1], l.end[2]);
        positions.needsUpdate = true;
        lineRef.current.geometry.computeBoundingSphere();
      }
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.position.set(l.start[0], l.start[1], l.start[2]);
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.position.set(l.end[0], l.end[1], l.end[2]);
    }
    if (labelGroupRef.current) {
      labelGroupRef.current.position.set(l.midpoint[0], l.midpoint[1], l.midpoint[2]);
    }
  });

  return (
    <group>
      <Line
        ref={lineRef}
        points={[line.start, line.end]}
        color={line.color}
        lineWidth={line.lineType === 'camera' ? baseWidth + 1 : baseWidth}
        dashed={line.dashed}
        dashSize={line.dashed ? 0.12 : undefined}
        gapSize={line.dashed ? 0.08 : undefined}
      />
      <group ref={startMarkerRef} position={line.start}>
        {line.lineType === 'illegal' ? (
          <Box args={[0.06, 0.06, 0.06]}>
            <meshBasicMaterial color="#ef4444" />
          </Box>
        ) : line.lineType === 'product' ? (
          <Box args={[0.07, 0.07, 0.07]}>
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} />
          </Box>
        ) : (
          <Sphere args={[0.04, 8, 8]}>
            <meshBasicMaterial color={line.color} />
          </Sphere>
        )}
      </group>
      <group ref={endMarkerRef} position={line.end}>
        {line.lineType === 'camera' ? (
          <Sphere args={[0.06, 8, 8]}>
            <meshBasicMaterial color="#f97316" transparent opacity={0.7} />
          </Sphere>
        ) : (
          <Sphere args={[0.04, 8, 8]}>
            <meshBasicMaterial color={line.color} />
          </Sphere>
        )}
      </group>
      <group ref={labelGroupRef} position={line.midpoint}>
        <Billboard>
          <Text
            fontSize={0.08}
            color={line.color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.005}
            outlineColor="#000000"
          >
            {line.label}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

function RelationshipLines({ objects, xrayMode }: { objects: LayoutObject[]; xrayMode: boolean }) {
  // Compute lines every render (no useMemo) to ensure real-time sync with drag
  const lines = computeRelLines(objects);
  const baseWidth = xrayMode ? 3.5 : 2.5;

  return (
    <>
      {lines.map((line, i) => (
        <RelationshipLineSegment key={`rel-${i}-${line.lineType}`} line={line} baseWidth={baseWidth} />
      ))}
    </>
  );
}

const VIEW_PRESETS = [
  { label: '正视', icon: '🎯', position: [0, 3, 10] as [number, number, number], target: [0, 1.5, 0] as [number, number, number] },
  { label: '侧视', icon: '📐', position: [10, 3, 0] as [number, number, number], target: [0, 1.5, 0] as [number, number, number] },
  { label: '俯视', icon: '🔍', position: [0, 12, 0.01] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { label: '等轴测', icon: '🧊', position: [7, 6, 7] as [number, number, number], target: [0, 1, 0] as [number, number, number] },
] as const;

function CameraController({
  cameraRef,
  isDragging,
  spaceHeld,
}: {
  cameraRef: React.MutableRefObject<IsometricCameraAction | null>;
  isDragging: boolean;
  spaceHeld: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useFrame(() => {
    if (cameraRef.current) {
      const { position, target } = cameraRef.current;
      camera.position.set(...position);
      if ('updateProjectionMatrix' in camera) {
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      }
      if (controlsRef.current) {
        controlsRef.current.target.set(...target);
        controlsRef.current.update();
      }
      cameraRef.current = null;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={2}
      maxDistance={200}
      enabled={!isDragging}
      mouseButtons={{
        LEFT: spaceHeld ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: undefined as any,
      }}
    />
  );
}

function DragPlane({
  dragStateRef,
  dragMovedRef,
  objectClickedRef,
  onDragMove,
  onDragEnd,
  onDeselect,
}: {
  dragStateRef: React.MutableRefObject<DragState>;
  dragMovedRef: React.MutableRefObject<boolean>;
  objectClickedRef: React.MutableRefObject<boolean>;
  onDragMove: (point: THREE.Vector3) => void;
  onDragEnd: () => void;
  onDeselect: () => void;
}) {
  return (
    <Plane
      args={[200, 200]}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      visible={false}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (dragStateRef.current.isDragging) {
          e.stopPropagation();
          onDragMove(e.point);
        }
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        if (dragStateRef.current.isDragging) {
          e.stopPropagation();
          onDragEnd();
        }
        objectClickedRef.current = false;
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!dragStateRef.current.isDragging && !dragMovedRef.current && e.delta < 3) {
          e.stopPropagation();
          onDeselect();
        }
      }}
    >
      <meshBasicMaterial transparent opacity={0} />
    </Plane>
  );
}

// --- Compact dimension input ---
function DimInput({ label, value, onChange, allowNegative }: { label: string; value: number; onChange: (v: number) => void; allowNegative?: boolean }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => {
    const n = allowNegative ? Math.round(Number(local) || value) : Math.max(10, Math.round(Number(local) || value));
    setLocal(String(n));
    if (n !== value) onChange(n);
  };
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-400 w-3">{label}</span>
      <input
        type="number"
        className="w-[52px] h-5 text-[10px] text-slate-100 bg-slate-700/80 border border-slate-600 rounded px-1 text-center focus:outline-none focus:border-yellow-500/60"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
      />
      <span className="text-[9px] text-slate-500">mm</span>
    </div>
  );
}

// SelectedInfoPanel removed — all info now shown in ObjectPropertyPanel sidebar

// --- FitAll helper: calculates scene bounding box and moves camera ---
function FitAllHelper({
  objects,
  cameraRef,
  onFitAllReady,
}: {
  objects: LayoutObject[];
  cameraRef: React.MutableRefObject<IsometricCameraAction | null>;
  onFitAllReady?: (fn: IsometricFitAllFn) => void;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!onFitAllReady) return;
    onFitAllReady((options = {}) => {
      const perspCam = camera as THREE.PerspectiveCamera;
      cameraRef.current = calculateIsometricFitCamera({
        objects,
        fov: perspCam.fov,
        aspect: perspCam.aspect || 1,
        padding: options.padding,
      });
    });
  }, [objects, camera, cameraRef, onFitAllReady]);

  return null;
}

export const Layout3DPreview = memo(function Layout3DPreview({
  objects,
  onSelectObject,
  selectedObjectId,
  onUpdateObject,
  onScreenshotReady,
  onFitAllReady,
  onIsometricSceneStatusChange,
  onStageLayout,
}: Layout3DPreviewProps) {
  const cameraActionRef = useRef<IsometricCameraAction | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const fitAllFnRef = useRef<IsometricFitAllFn | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [xrayMode, setXrayMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [loadedModelKeys, setLoadedModelKeys] = useState<Set<string>>(() => new Set());
  const [failedModelKeys, setFailedModelKeys] = useState<Set<string>>(() => new Set());
  const SNAP_GRID = 10;
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    objectId: null,
    startPoint: null,
    startPos: null,
  });
  const dragMovedRef = useRef(false);
  const objectClickedRef = useRef(false);

  // Global pointerup guard reset - ensures objectClickedRef never stays stuck
  useEffect(() => {
    const resetGuard = () => { objectClickedRef.current = false; };
    window.addEventListener('pointerup', resetGuard);
    return () => window.removeEventListener('pointerup', resetGuard);
  }, []);

  const activeSelectedId = selectedObjectId !== undefined ? selectedObjectId : localSelectedId;

  const relatedIds = useMemo(() => getRelatedIds(activeSelectedId, objects), [activeSelectedId, objects]);
  const hasFocus = !!activeSelectedId;
  const expectedModelKeys = useMemo(() => getIsometricModelLoadKeys(objects), [objects]);
  const isometricSceneStatus = useMemo(
    () => deriveIsometricSceneStatus(objects, loadedModelKeys, failedModelKeys),
    [objects, loadedModelKeys, failedModelKeys],
  );

  useEffect(() => {
    setLoadedModelKeys(prev => pruneModelKeySet(prev, expectedModelKeys));
    setFailedModelKeys(prev => pruneModelKeySet(prev, expectedModelKeys));
  }, [expectedModelKeys]);

  useEffect(() => {
    onIsometricSceneStatusChange?.(isometricSceneStatus);
  }, [isometricSceneStatus, onIsometricSceneStatusChange]);

  const markModelLoaded = useCallback((loadKey: string) => {
    setFailedModelKeys(prev => {
      if (!prev.has(loadKey)) return prev;
      const next = new Set(prev);
      next.delete(loadKey);
      return next;
    });
    setLoadedModelKeys(prev => {
      if (prev.has(loadKey)) return prev;
      const next = new Set(prev);
      next.add(loadKey);
      return next;
    });
  }, []);

  const markModelFailed = useCallback((loadKey: string, error: unknown) => {
    console.warn('3D model failed to load for isometric capture:', loadKey, error);
    setLoadedModelKeys(prev => {
      if (!prev.has(loadKey)) return prev;
      const next = new Set(prev);
      next.delete(loadKey);
      return next;
    });
    setFailedModelKeys(prev => {
      if (prev.has(loadKey)) return prev;
      const next = new Set(prev);
      next.add(loadKey);
      return next;
    });
  }, []);

  const illegalMountMechIds = useMemo(() => {
    const ids = new Set<string>();
    objects.forEach(obj => {
      if (obj.type === 'camera' && obj.mountedToMechanismId) {
        const parent = objects.find(o => o.id === obj.mountedToMechanismId);
        if (parent && !isCameraMountable(parent.mechanismType || '')) {
          ids.add(parent.id);
        }
      }
    });
    return ids;
  }, [objects]);

  const handleSelect = useCallback((id: string | null) => {
    const newId = activeSelectedId === id ? null : id;
    setLocalSelectedId(newId);
    onSelectObject?.(newId);
  }, [activeSelectedId, onSelectObject]);

  const handleDeselect = useCallback(() => {
    setLocalSelectedId(null);
    onSelectObject?.(null);
  }, [onSelectObject]);

  const handleViewPreset = useCallback((position: [number, number, number], target: [number, number, number]) => {
    cameraActionRef.current = { position, target };
    if (canvasRef.current) {
      canvasRef.current.dispatchEvent(new Event('resize'));
    }
  }, []);

  const handleDragStart = useCallback((id: string, point: THREE.Vector3) => {
    // Guard: only allow drag in edit mode and for already-selected objects
    if (!editMode) return;
    if (id !== activeSelectedId) return;
    if (!onUpdateObject) return;
    const obj = objects.find(o => o.id === id);
    if (!obj || obj.locked) return;
    dragStateRef.current = {
      isDragging: true,
      objectId: id,
      startPoint: point.clone(),
      startPos: { posX: obj.posX ?? 0, posY: obj.posY ?? 0, posZ: obj.posZ ?? 0 },
    };
    dragMovedRef.current = false;
  }, [editMode, activeSelectedId, onUpdateObject, objects]);

  const handleDragMove = useCallback((point: THREE.Vector3) => {
    const state = dragStateRef.current;
    if (!state.isDragging || !state.objectId || !state.startPoint || !state.startPos) return;

    const dx = point.x - state.startPoint.x;
    const dz = point.z - state.startPoint.z;

    if (Math.abs(dx) > 0.02 || Math.abs(dz) > 0.02) {
      dragMovedRef.current = true;
    }

    let newPosX = Math.round(state.startPos.posX + dx * INV_SCALE);
    let newPosY = Math.round(state.startPos.posY + dz * INV_SCALE);

    if (snapEnabled) {
      newPosX = Math.round(newPosX / SNAP_GRID) * SNAP_GRID;
      newPosY = Math.round(newPosY / SNAP_GRID) * SNAP_GRID;
    }

    onUpdateObject?.(state.objectId, { posX: newPosX, posY: newPosY });
  }, [onUpdateObject, snapEnabled, SNAP_GRID]);

  const handleDragEnd = useCallback(() => {
    dragStateRef.current = {
      isDragging: false,
      objectId: null,
      startPoint: null,
      startPos: null,
    };
    objectClickedRef.current = false;
    setTimeout(() => { dragMovedRef.current = false; }, 0);
  }, []);

  // ============================================================
  // ARROW KEY MOVEMENT + R-KEY ROTATION
  // ============================================================
  const rKeyHeld = useRef(false);
  
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rKeyHeld.current = false;
      if (e.key === ' ' || e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, []);

  useEffect(() => {
    if (!onUpdateObject) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Space key: enable pan mode
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) setSpaceHeld(true);
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (!e.repeat) rKeyHeld.current = true;
        return;
      }

      // Block movement/rotation in preview mode
      if (!editMode) return;

      const id = activeSelectedId;
      if (!id) return;

      // R + arrows = rotate
      if (rKeyHeld.current && (e.key.startsWith('Arrow'))) {
        const obj = objects.find(o => o.id === id);
        if (!obj || obj.locked) return;
        e.preventDefault();
        e.stopPropagation();
        const rotStep = 15;
        const updates: Partial<LayoutObject> = {};
        switch (e.key) {
          case 'ArrowLeft': updates.rotY = ((obj.rotY ?? 0) - rotStep + 360) % 360; break;
          case 'ArrowRight': updates.rotY = ((obj.rotY ?? 0) + rotStep) % 360; break;
          case 'ArrowUp':
            if (e.shiftKey) { updates.rotZ = ((obj.rotZ ?? 0) + rotStep) % 360; }
            else { updates.rotX = ((obj.rotX ?? 0) - rotStep + 360) % 360; }
            break;
          case 'ArrowDown':
            if (e.shiftKey) { updates.rotZ = ((obj.rotZ ?? 0) - rotStep + 360) % 360; }
            else { updates.rotX = ((obj.rotX ?? 0) + rotStep) % 360; }
            break;
        }
        onUpdateObject(id, updates);
        return;
      }

      const obj = objects.find(o => o.id === id);
      if (!obj || obj.locked) return;

      const step = snapEnabled ? SNAP_GRID : 5;
      let dx = 0, dy = 0, dz = 0;

      switch (e.key) {
        case 'ArrowLeft': dx = -step; break;
        case 'ArrowRight': dx = step; break;
        case 'ArrowUp':
          if (e.shiftKey) { dz = step; } else { dy = -step; }
          break;
        case 'ArrowDown':
          if (e.shiftKey) { dz = -step; } else { dy = step; }
          break;
        default: return;
      }

      e.preventDefault();
      e.stopPropagation();

      const updates: Partial<LayoutObject> = {};
      if (dx !== 0) updates.posX = (obj.posX ?? 0) + dx;
      if (dy !== 0) updates.posY = (obj.posY ?? 0) + dy;
      if (dz !== 0) updates.posZ = (obj.posZ ?? 0) + dz;

      if (snapEnabled) {
        if (updates.posX !== undefined) updates.posX = Math.round(updates.posX / SNAP_GRID) * SNAP_GRID;
        if (updates.posY !== undefined) updates.posY = Math.round(updates.posY / SNAP_GRID) * SNAP_GRID;
        if (updates.posZ !== undefined) updates.posZ = Math.round(updates.posZ / SNAP_GRID) * SNAP_GRID;
      }

      onUpdateObject(id, updates);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, activeSelectedId, objects, onUpdateObject, snapEnabled, SNAP_GRID]);

  const selectedObj = activeSelectedId
    ? objects.find(o => o.id === activeSelectedId) || null
    : null;

  const products = objects.filter(isProductLayoutObject);
  const mechanisms = objects.filter(o => o.type === 'mechanism');
  const cameras = objects.filter(o => o.type === 'camera');

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Canvas
        ref={canvasRef}
        camera={{ position: [7, 6, 7], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => { gl.setClearColor('#0f172a'); }}
        onPointerMissed={() => {
          if (!dragStateRef.current.isDragging && !objectClickedRef.current) {
            dragMovedRef.current = false;
            handleSelect(null);
          }
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <hemisphereLight args={['#dbeafe', '#334155', 0.6]} />
          <directionalLight position={[5, 8, 5]} intensity={0.9} castShadow />
          <directionalLight position={[-3, 5, -3]} intensity={0.4} />
          <pointLight position={[8, 10, 8]} intensity={0.7} distance={30} decay={2} />

          <Grid
            args={[20, 20]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#334155"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#475569"
            fadeDistance={30}
            position={[0, -0.01, 0]}
          />

          <AxisLabels />

          <DragPlane
            dragStateRef={dragStateRef}
            dragMovedRef={dragMovedRef}
            objectClickedRef={objectClickedRef}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDeselect={() => handleSelect(null)}
          />

          {/* Products */}
          {products.map((obj, index) => {
            const isSelected = activeSelectedId === obj.id;
            const isDimmed = hasFocus && !relatedIds.has(obj.id) && !isSelected;
            return (
              <DraggableGroup
                key={obj.id}
                objectId={obj.id}
                position={[(obj.posX ?? 0) * SCALE, (obj.posZ ?? 0) * SCALE, (obj.posY ?? 0) * SCALE]}
                rotation={computeWorldRotation(obj.rotX ?? 0, obj.rotY ?? 0, obj.rotZ ?? 0)}
                dragState={dragStateRef}
                onDragStart={handleDragStart}
                onClick={(id) => { handleSelect(id); }}
                objectClickedRef={objectClickedRef}
                selectedObjectId={activeSelectedId}
                editMode={editMode}
                spaceHeld={spaceHeld}
                onDragEnd={handleDragEnd}
              >
                <Product3DObject
                  obj={obj}
                  index={index}
                  selected={isSelected}
                  dimmed={isDimmed}
                  onModelLoaded={markModelLoaded}
                  onModelFailed={markModelFailed}
                />
              </DraggableGroup>
            );
          })}

          {/* Mechanisms */}
          {mechanisms.map(obj => {
            const isSelected = activeSelectedId === obj.id;
            const isDimmed = hasFocus && !relatedIds.has(obj.id) && !isSelected;
            return (
              <DraggableGroup
                key={obj.id}
                objectId={obj.id}
                position={[(obj.posX ?? 0) * SCALE, (obj.posZ ?? 0) * SCALE, (obj.posY ?? 0) * SCALE]}
                rotation={computeWorldRotation(obj.rotX ?? 0, obj.rotY ?? 0, obj.rotZ ?? 0)}
                dragState={dragStateRef}
                onDragStart={handleDragStart}
                onClick={(id) => { handleSelect(id); }}
                objectClickedRef={objectClickedRef}
                selectedObjectId={activeSelectedId}
                editMode={editMode}
                spaceHeld={spaceHeld}
                onDragEnd={handleDragEnd}
              >
                <Mechanism3DModel
                  obj={obj}
                  selected={isSelected}
                  dimmed={isDimmed}
                  hasIllegalMount={illegalMountMechIds.has(obj.id)}
                  objects={objects}
                  xrayMode={xrayMode}
                  onModelLoaded={markModelLoaded}
                  onModelFailed={markModelFailed}
                />
              </DraggableGroup>
            );
          })}

          {/* Cameras — always opaque even in xray */}
          {cameras.map(obj => {
            const isSelected = activeSelectedId === obj.id;
            const isDimmed = hasFocus && !relatedIds.has(obj.id) && !isSelected;
            return (
              <DraggableGroup
                key={obj.id}
                objectId={obj.id}
                position={[(obj.posX ?? 0) * SCALE, (obj.posZ ?? 0) * SCALE, (obj.posY ?? 0) * SCALE]}
                rotation={computeWorldRotation(obj.rotX ?? 0, obj.rotY ?? 0, obj.rotZ ?? 0)}
                dragState={dragStateRef}
                onDragStart={handleDragStart}
                onClick={(id) => { handleSelect(id); }}
                objectClickedRef={objectClickedRef}
                selectedObjectId={activeSelectedId}
                editMode={editMode}
                spaceHeld={spaceHeld}
                onDragEnd={handleDragEnd}
              >
                <CameraObject obj={obj} selected={isSelected} dimmed={isDimmed} />
              </DraggableGroup>
            );
          })}

          <RelationshipLines objects={objects} xrayMode={xrayMode} />
          <CameraController cameraRef={cameraActionRef} isDragging={dragStateRef.current.isDragging} spaceHeld={spaceHeld} />
          {onScreenshotReady && (
            <ScreenshotHelper
              enabled={isometricSceneStatus.ready}
              onScreenshotReady={onScreenshotReady}
            />
          )}
          <FitAllHelper
            objects={objects}
            cameraRef={cameraActionRef}
            onFitAllReady={(fn) => {
              fitAllFnRef.current = fn;
              onFitAllReady?.(fn);
            }}
          />
        </Suspense>
      </Canvas>

      {products.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="rounded-xl border border-slate-600/60 bg-slate-900/80 px-5 py-4 text-center shadow-xl backdrop-blur-sm">
            <Package className="mx-auto mb-2 h-7 w-7 text-slate-400" />
            <div className="text-sm font-medium text-slate-200">暂无产品</div>
            <div className="mt-1 text-xs text-slate-400">请点击“添加产品”创建布局对象</div>
          </div>
        </div>
      )}

      {/* SelectedInfoPanel removed — info now in ObjectPropertyPanel */}

      {/* Toolbar: xray + snap */}
      {onUpdateObject && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-600/50 overflow-hidden">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                editMode
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={editMode ? '编辑模式：可拖拽和键盘移动硬件' : '预览模式：仅查看，不可移动硬件'}
            >
              {editMode ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {editMode ? '编辑' : '预览'}
            </button>
            <button
              onClick={() => setXrayMode(!xrayMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                xrayMode
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="透视模式：机构半透明线框，相机/产品保持可见"
            >
              {xrayMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              透视
            </button>
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l border-slate-600/50 ${
                snapEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Magnet className="h-3.5 w-3.5" />
              网格吸附 ({SNAP_GRID}mm)
            </button>
            <div className="px-2.5 py-1.5 text-[10px] text-slate-400 border-l border-slate-600/50 whitespace-nowrap">
              {activeSelectedId && editMode
                ? '←→↑↓ 移动 · Shift+↑↓ 升降 · R旋转 · 拖拽旋转视角 · 空格+拖拽平移'
                : '拖拽旋转 · 滚轮缩放 · 空格+拖拽平移'}
            </div>
        </div>
      )}

      {/* View presets */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        {VIEW_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="secondary"
            size="sm"
            className="gap-1.5 h-7 text-xs bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 backdrop-blur-sm"
            onClick={() => handleViewPreset(preset.position, preset.target)}
          >
            <span>{preset.icon}</span>
            {preset.label}
          </Button>
        ))}
        <div className="h-px bg-slate-600/50 my-0.5" />
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 h-7 text-xs bg-sky-900/60 hover:bg-sky-800/70 border border-sky-600/50 backdrop-blur-sm text-sky-300"
          onClick={() => fitAllFnRef.current?.()}
          title="自动适配视角以包含所有对象"
        >
          <Maximize2 className="h-3 w-3" />
          适配
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 h-7 text-xs bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 backdrop-blur-sm"
          onClick={() => handleViewPreset([7, 6, 7], [0, 1, 0])}
        >
          <RotateCcw className="h-3 w-3" />
          重置
        </Button>
        {onStageLayout && (
          <>
            <div className="h-px bg-slate-600/50 my-0.5" />
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 h-7 text-xs bg-emerald-900/60 hover:bg-emerald-800/70 border border-emerald-600/50 backdrop-blur-sm text-emerald-300"
              onClick={onStageLayout}
            >
              <Save className="h-3 w-3" />
              暂存布局
            </Button>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-600/50 p-2.5 z-10">
        <div className="text-[10px] font-semibold text-slate-400 mb-1.5">图例</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-300"><span className="w-3 h-3 rounded-sm bg-cyan-500/70" />产品</div>
          <div className="flex items-center gap-2 text-xs text-slate-300"><span className="w-3 h-3 rounded-sm bg-orange-500/70" />机构</div>
          <div className="flex items-center gap-2 text-xs text-slate-300"><span className="w-3 h-3 rounded-sm bg-blue-500/70" />相机 (📷交互)</div>
          <div className="flex items-center gap-2 text-xs text-slate-300"><span className="w-3 h-3 rounded-sm bg-green-500/70" />已挂载</div>
          <div className="flex items-center gap-2 text-xs text-slate-300"><span className="w-3 h-3 rounded-sm bg-yellow-400/70" />选中</div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-3 h-0.5 bg-blue-500" />📷 相机连线
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-3 h-0.5 bg-cyan-400" />📦 产品连线
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-3 h-0.5 bg-red-500 border-dashed" style={{ borderTop: '2px dashed' }} />⚠ 非法挂载
          </div>
          {xrayMode && (
            <div className="flex items-center gap-2 text-xs text-violet-300">
              <span className="w-3 h-3 rounded-sm border border-violet-400/50" />透视模式
            </div>
          )}
        </div>
      </div>

    </div>
  );
});
