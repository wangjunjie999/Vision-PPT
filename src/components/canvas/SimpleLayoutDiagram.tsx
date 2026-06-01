/**
 * SimpleLayoutDiagram - Topological layout diagram for PPT export.
 * Product centered, mechanisms around it, cameras near their mounted mechanisms.
 * Enlarged icons (~2.5x) with clear relationship lines. No coordinate grids.
 */
import { MECHANISM_LABELS, CAMERA_MOUNT_LABELS, getLabel } from '@/services/labelMaps';

// ===== Enlarged Icon SVG components =====

function CameraIcon({ label, name, x, y, selected, fovTarget }: {
  label: string; name?: string; x: number; y: number; selected?: boolean;
  fovTarget?: { x: number; y: number };
}) {
  // Calculate rotation angle toward product if fovTarget provided
  let rotation = 0;
  if (fovTarget) {
    rotation = Math.atan2(fovTarget.y - y, fovTarget.x - x) * (180 / Math.PI);
  }

  // FOV cone: triangle pointing from camera toward product
  const fovCone = fovTarget ? (() => {
    const dx = fovTarget.x - x;
    const dy = fovTarget.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const fovLen = Math.min(dist * 0.45, 70);
    const fovHalfAngle = 22; // degrees
    const baseAngle = Math.atan2(dy, dx);
    const a1 = baseAngle - (fovHalfAngle * Math.PI) / 180;
    const a2 = baseAngle + (fovHalfAngle * Math.PI) / 180;
    const p1x = Math.cos(a1) * fovLen;
    const p1y = Math.sin(a1) * fovLen;
    const p2x = Math.cos(a2) * fovLen;
    const p2y = Math.sin(a2) * fovLen;
    return `M 0,0 L ${p1x},${p1y} L ${p2x},${p2y} Z`;
  })() : null;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {selected && <rect x={-40} y={-32} width={80} height={64} rx={8} fill="none" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4 2" opacity={0.6} />}
      {/* FOV cone */}
      {fovCone && (
        <path d={fovCone} fill="#06b6d4" opacity={0.12} stroke="#06b6d4" strokeWidth={0.8} strokeOpacity={0.3} />
      )}
      <rect x={-35} y={-27} width={70} height={54} rx={6} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={2} />
      <circle cx={0} cy={0} r={16} fill="none" stroke="#3b82f6" strokeWidth={2} />
      <circle cx={0} cy={0} r={7} fill="#3b82f6" />
      {/* Label badge */}
      <circle cx={0} cy={-40} r={16} fill="#3b82f6" fillOpacity={0.95} />
      <text y={-35} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="bold">{label}</text>
      {/* Name below */}
      {name && <text y={42} textAnchor="middle" fill="#93c5fd" fontSize={11} fontWeight="500">{name}</text>}
    </g>
  );
}

function MechanismIcon({ type, label, name, x, y, color }: { type: string; label: string; name?: string; x: number; y: number; color: string }) {
  const shapes: Record<string, JSX.Element> = {
    conveyor: <rect x={-45} y={-12} width={90} height={24} rx={12} fill="none" stroke={color} strokeWidth={2.5} />,
    cylinder: <rect x={-12} y={-35} width={24} height={70} rx={4} fill="none" stroke={color} strokeWidth={2.5} />,
    gripper: (
      <>
        <rect x={-7} y={-25} width={14} height={30} rx={2} fill="none" stroke={color} strokeWidth={2.5} />
        <line x1={-18} y1={5} x2={-7} y2={-5} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={18} y1={5} x2={7} y2={-5} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      </>
    ),
    lift: (
      <>
        <rect x={-30} y={-7} width={60} height={14} rx={4} fill="none" stroke={color} strokeWidth={2.5} />
        <polygon points="-7,-24 7,-24 0,-32" fill={color} />
        <line x1={0} y1={-24} x2={0} y2={-7} stroke={color} strokeWidth={2} />
      </>
    ),
    turntable: <circle cx={0} cy={0} r={34} fill="none" stroke={color} strokeWidth={2.5} />,
    stopper: <rect x={-20} y={-25} width={40} height={50} rx={4} fill="none" stroke={color} strokeWidth={2.5} />,
    stop: <rect x={-20} y={-25} width={40} height={50} rx={4} fill="none" stroke={color} strokeWidth={2.5} />,
    robot_arm: (
      <>
        <line x1={0} y1={-30} x2={-20} y2={0} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <line x1={-20} y1={0} x2={10} y2={20} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <circle cx={0} cy={-30} r={6} fill={color} />
      </>
    ),
    camera_mount: (
      <>
        <line x1={0} y1={-34} x2={0} y2={10} stroke={color} strokeWidth={3} />
        <line x1={0} y1={10} x2={30} y2={10} stroke={color} strokeWidth={3} />
      </>
    ),
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
      {shapes[type] || shapes.stopper}
      {/* Label badge */}
      <circle cx={0} cy={-48} r={16} fill={color} fillOpacity={0.95} />
      <text y={-43} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="bold">{label}</text>
      {/* Name below */}
      {name && <text y={48} textAnchor="middle" fill="#cbd5e1" fontSize={11} fontWeight="500">{name.slice(0, 12)}</text>}
    </g>
  );
}

function ProductIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={-75} y={-45} width={150} height={90} rx={8} fill="#1e3a5f" stroke="#06b6d4" strokeWidth={2.5} strokeDasharray="10 5" />
      <line x1={-20} y1={0} x2={20} y2={0} stroke="#06b6d4" strokeWidth={1} opacity={0.5} />
      <line x1={0} y1={-20} x2={0} y2={20} stroke="#06b6d4" strokeWidth={1} opacity={0.5} />
      {/* Label badge */}
      <circle cx={0} cy={-60} r={16} fill="#06b6d4" fillOpacity={0.95} />
      <text y={-55} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="bold">P</text>
      <text y={62} textAnchor="middle" fill="#67e8f9" fontSize={11} fontWeight="500">待测件</text>
    </g>
  );
}

// ===== Types =====

interface LayoutObject {
  id: string;
  type: string;
  name?: string;
  mechanismType?: string;
  posX?: number;
  posY?: number;
  posZ?: number;
  mountedToMechanismId?: string;
}

interface ModuleInfo {
  name: string;
  type: string;
  trigger_type?: string | null;
  processing_time_limit?: number | null;
}

interface HardwareSummary {
  cameras: Array<{ brand: string; model: string; resolution?: string }>;
  lenses: Array<{ brand: string; model: string; focal_length?: string }>;
  lights: Array<{ brand: string; model: string; type?: string }>;
  controller?: { brand: string; model: string } | null;
}

interface SimpleLayoutDiagramProps {
  layoutObjects: LayoutObject[];
  mechanisms: string[];
  cameraMounts: string[];
  cameraCount: number;
  workstationName: string;
  cycleTime?: number | string | null;
  shotCount?: number | null;
  modules: ModuleInfo[];
  hardware: HardwareSummary;
  width?: number;
  height?: number;
}

const CYCLE_UNIT_RE = /(s\s*\/\s*pcs|s\s*\/\s*pc|秒\s*\/\s*件|秒|s\s*\/\s*次)$/i;

function formatCycleTimeLabel(cycleTime: number | string | null | undefined): string {
  if (cycleTime === null || cycleTime === undefined || cycleTime === '') return '待定';
  const text = String(cycleTime).trim();
  if (!text) return '待定';
  return CYCLE_UNIT_RE.test(text) ? text : `${text} s/pcs`;
}

const MODULE_TYPE_LABELS_ZH: Record<string, string> = {
  ocr: '识别',
  measurement: '测量',
  positioning: '定位',
  defect: '检测',
  deeplearning: '深度学习（算法手段）',
};

const MECH_COLORS: Record<string, string> = {
  conveyor: '#22c55e',
  cylinder: '#f59e0b',
  gripper: '#ec4899',
  lift: '#06b6d4',
  turntable: '#8b5cf6',
  stopper: '#ef4444',
  stop: '#ef4444',
  robot_arm: '#a855f7',
  camera_mount: '#64748b',
};

const MOUNT_TYPE_ZH: Record<string, string> = {
  top: '顶装',
  side: '侧装',
  angled: '斜装',
  bracket: '支架',
};

// ===== Topological layout engine =====

interface PlacedNode {
  id: string;
  type: string;
  mechType?: string;
  label: string;
  name?: string;
  color: string;
  x: number;
  y: number;
  mountedToId?: string;
  mountType?: string;
}

function buildTopologicalLayout(
  layoutObjects: LayoutObject[],
  mechanisms: string[],
  cameraCount: number,
  cameraMounts: string[],
  cx: number,
  cy: number,
  radiusMech: number,
  radiusCam: number,
): PlacedNode[] {
  const nodes: PlacedNode[] = [];

  // Extract cameras
  const cameraObjects = layoutObjects.filter(o => o.type === 'camera');
  const cameras = cameraObjects.length > 0
    ? cameraObjects
    : Array.from({ length: cameraCount || 1 }, (_, i) => ({
        id: `cam-${i}`, type: 'camera', name: `CAM${i + 1}`,
      } as LayoutObject));

  // Extract mechanisms
  const mechObjects = layoutObjects.filter(o => o.type !== 'camera' && o.type !== 'product');
  const mechs = mechObjects.length > 0
    ? mechObjects
    : mechanisms.map((m, i) => ({
        id: `mech-${i}`, type: m, mechanismType: m,
        name: getLabel(m, MECHANISM_LABELS, 'zh'),
      }));

  // Place product at center
  nodes.push({ id: 'product', type: 'product', label: 'P', name: '待测件', color: '#06b6d4', x: cx, y: cy });

  // Place mechanisms in a circle around product
  const mechCount = mechs.length;
  let mechIdx = 1;
  const mechMap = new Map<string, PlacedNode>();

  mechs.forEach((m, i) => {
    const mechType = m.mechanismType || m.type;
    const angle = mechCount === 1 ? -Math.PI / 2 : -Math.PI / 2 + (2 * Math.PI * i) / mechCount;
    const mx = cx + Math.cos(angle) * radiusMech;
    const my = cy + Math.sin(angle) * radiusMech;
    const node: PlacedNode = {
      id: m.id,
      type: 'mechanism',
      mechType,
      label: `M${mechIdx++}`,
      name: m.name || getLabel(mechType, MECHANISM_LABELS, 'zh'),
      color: MECH_COLORS[mechType] || '#a855f7',
      x: mx,
      y: my,
    };
    nodes.push(node);
    mechMap.set(m.id, node);
  });

  // Place cameras: if mounted, near their mechanism; otherwise around product at larger radius
  let camIdx = 1;
  let unmountedIdx = 0;
  const unmountedCount = cameras.filter(c => !c.mountedToMechanismId).length;

  cameras.forEach((c, i) => {
    const mounted = c.mountedToMechanismId ? mechMap.get(c.mountedToMechanismId) : null;
    let camX: number, camY: number;

    // Determine mount type for this camera
    const mountType = cameraMounts[i] || cameraMounts[0] || '';

    if (mounted) {
      // Place camera directly above its mechanism (camera on top layer)
      camX = mounted.x;
      camY = mounted.y - 120;
    } else {
      // Unmounted cameras placed in an arc above the product
      const angle = unmountedCount === 1 ? -Math.PI / 2
        : -Math.PI / 2 - Math.PI / 4 + (Math.PI / 2 * unmountedIdx) / Math.max(unmountedCount - 1, 1);
      camX = cx + Math.cos(angle) * radiusCam;
      camY = cy + Math.sin(angle) * radiusCam;
      unmountedIdx++;
    }

    nodes.push({
      id: c.id,
      type: 'camera',
      label: `C${camIdx++}`,
      name: c.name || `CAM${camIdx - 1}`,
      color: '#3b82f6',
      x: camX,
      y: camY,
      mountedToId: c.mountedToMechanismId,
      mountType,
    });
  });

  return nodes;
}

// ===== Arrow marker definition =====

function ArrowDefs() {
  return (
    <defs>
      <marker id="arrow-blue" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <polygon points="0,0 10,4 0,8" fill="#3b82f6" opacity={0.8} />
      </marker>
      <marker id="arrow-cyan" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
        <polygon points="0,0 10,4 0,8" fill="#22d3ee" opacity={1.0} />
      </marker>
      {/* Gradient for mount lines */}
      <linearGradient id="mount-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
  );
}

// ===== Main Component =====

export function SimpleLayoutDiagram({
  layoutObjects,
  mechanisms,
  cameraMounts,
  cameraCount,
  workstationName,
  cycleTime,
  shotCount,
  modules,
  hardware,
  width = 900,
  height = 500,
}: SimpleLayoutDiagramProps) {
  // Layout area: left 60% for diagram, right 40% for info panel
  const diagramW = width * 0.6;
  const infoW = width * 0.4;
  const diagramCx = diagramW / 2;
  const diagramCy = height / 2;
  const radiusMech = Math.min(diagramW, height) * 0.28;
  const radiusCam = Math.min(diagramW, height) * 0.42;

  const nodes = buildTopologicalLayout(layoutObjects, mechanisms, cameraCount, cameraMounts, diagramCx, diagramCy, radiusMech, radiusCam);

  const product = nodes.find(n => n.type === 'product')!;
  const mechNodes = nodes.filter(n => n.type === 'mechanism');
  const camNodes = nodes.filter(n => n.type === 'camera');

  // Info panel data
  const cameraInfo = hardware.cameras.map(c => `${c.brand} ${c.model}${c.resolution ? ` (${c.resolution})` : ''}`);
  const lensInfo = hardware.lenses.map(l => `${l.brand} ${l.model}${l.focal_length ? ` ${l.focal_length}` : ''}`);
  const lightInfo = hardware.lights.map(l => `${l.brand} ${l.model}${l.type ? ` ${l.type}` : ''}`);
  const moduleTypes = modules.map(m => MODULE_TYPE_LABELS_ZH[m.type] || m.type);

  const infoX = diagramW + 8;
  const infoContentW = infoW - 16;

  // Build mount groups for visual grouping
  const mountGroups = camNodes
    .filter(c => c.mountedToId)
    .map(cam => {
      const mech = mechNodes.find(m => m.id === cam.mountedToId);
      if (!mech) return null;
      const minX = Math.min(cam.x, mech.x) - 55;
      const minY = Math.min(cam.y, mech.y) - 60;
      const maxX = Math.max(cam.x, mech.x) + 55;
      const maxY = Math.max(cam.y, mech.y) + 60;
      return { camId: cam.id, mechId: mech.id, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    })
    .filter(Boolean);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ backgroundColor: '#0f172a' }}
    >
      <ArrowDefs />

      {/* ===== Diagram Area ===== */}
      <rect x={0} y={0} width={diagramW} height={height} fill="#0f172a" stroke="#334155" strokeWidth={0.5} />

      {/* Title */}
      <rect x={0} y={0} width={diagramW} height={28} fill="#1e293b" />
      <text x={diagramW / 2} y={19} textAnchor="middle" fill="#f1f5f9" fontSize={13} fontWeight="bold">
        {workstationName} — 机械布局拓扑图
      </text>

      {/* ===== Install Group backgrounds (behind everything) ===== */}
      {mountGroups.map((g, i) => g && (
        <rect
          key={`group-${i}`}
          x={g.x} y={g.y} width={g.w} height={g.h}
          rx={12}
          fill="#3b82f6" fillOpacity={0.04}
          stroke="#3b82f6" strokeWidth={1} strokeDasharray="6 3" strokeOpacity={0.25}
        />
      ))}

      {/* ===== Connection lines (behind objects) ===== */}

      {/* Camera → mounted mechanism: thick solid gradient line with mount type label */}
      {camNodes.filter(c => c.mountedToId).map(cam => {
        const mech = mechNodes.find(m => m.id === cam.mountedToId);
        if (!mech) return null;
        const midX = (cam.x + mech.x) / 2;
        const midY = (cam.y + mech.y) / 2;
        const mountLabel = cam.mountType
          ? (MOUNT_TYPE_ZH[cam.mountType] || cam.mountType)
          : '安装于';
        return (
          <g key={`mount-${cam.id}`}>
            <line x1={cam.x} y1={cam.y} x2={mech.x} y2={mech.y}
              stroke="url(#mount-grad)" strokeWidth={3} opacity={0.75} markerEnd="url(#arrow-blue)" />
            <rect x={midX - 26} y={midY - 10} width={52} height={20} rx={4} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} opacity={0.95} />
            <text x={midX} y={midY + 5} textAnchor="middle" fill="#93c5fd" fontSize={10} fontWeight="bold">{mountLabel}</text>
          </g>
        );
      })}

      {/* Camera → product: dashed cyan line (shooting direction) - enhanced visibility */}
      {camNodes.map(cam => {
        // Compute label position at 30% from camera to product
        const labelX = cam.x + (product.x - cam.x) * 0.3;
        const labelY = cam.y + (product.y - cam.y) * 0.3;
        return (
          <g key={`shoot-${cam.id}`}>
            <line x1={cam.x} y1={cam.y} x2={product.x} y2={product.y}
              stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="8 4" opacity={0.9} markerEnd="url(#arrow-cyan)" />
            {/* Target dot on product surface */}
            <circle cx={product.x} cy={product.y} r={4} fill="#22d3ee" opacity={1.0} />
            {/* "拍摄" label on the line */}
            <rect x={labelX - 18} y={labelY - 9} width={36} height={18} rx={3} fill="#0f172a" fillOpacity={0.9} />
            <text x={labelX} y={labelY + 4} textAnchor="middle" fill="#ffffff" fontSize={10} fontWeight="bold">拍摄</text>
          </g>
        );
      })}

      {/* ===== Render objects ===== */}
      <ProductIcon x={product.x} y={product.y} />

      {mechNodes.map(m => (
        <MechanismIcon
          key={m.id}
          type={m.mechType || 'stopper'}
          label={m.label}
          name={m.name}
          x={m.x}
          y={m.y}
          color={m.color}
        />
      ))}

      {camNodes.map(c => (
        <CameraIcon
          key={c.id}
          label={c.label}
          name={c.name}
          x={c.x}
          y={c.y}
          fovTarget={{ x: product.x, y: product.y }}
        />
      ))}

      {/* ===== Info Panel (right side) ===== */}
      <rect x={diagramW} y={0} width={infoW} height={height} fill="#1e293b" stroke="#334155" strokeWidth={0.5} />

      {/* Panel title */}
      <rect x={diagramW} y={0} width={infoW} height={28} fill="#334155" />
      <text x={diagramW + infoW / 2} y={19} textAnchor="middle" fill="#f1f5f9" fontSize={13} fontWeight="bold">
        关键参数
      </text>

      {/* Label legend */}
      {renderLabelLegend(nodes, infoX, 38, infoContentW)}

      {/* Hardware summary */}
      {renderInfoSection(infoX, 38 + Math.min(nodes.length, 10) * 20 + 12, infoContentW, '光学配置', [
        ...cameraInfo.slice(0, 2),
        ...lensInfo.slice(0, 1),
        ...lightInfo.slice(0, 1),
        ...(hardware.controller ? [`IPC: ${hardware.controller.brand} ${hardware.controller.model}`] : []),
      ])}

      {/* Detection methods */}
      {renderInfoSection(infoX, 38 + Math.min(nodes.length, 10) * 20 + 12 + (Math.min(cameraInfo.length + lensInfo.length + lightInfo.length + (hardware.controller ? 1 : 0), 5) + 1) * 18 + 20, infoContentW, '模块分类', moduleTypes)}

      {/* Cycle info */}
      {renderInfoSection(infoX, height - 110, infoContentW, '工位节拍信息', [
        `目标工位节拍: ${formatCycleTimeLabel(cycleTime)}`,
        `拍照次数: ${shotCount || camNodes.length} 次`,
        `相机数量: ${camNodes.length} 台`,
      ])}

      {/* Line type legend */}
      {renderLineLegend(infoX, height - 30, infoContentW)}

      {/* Camera mount labels */}
      {cameraMounts.length > 0 && (
        <text x={diagramW + infoW / 2} y={height - 6} textAnchor="middle" fill="#64748b" fontSize={9}>
          安装方式: {cameraMounts.map(m => getLabel(m, CAMERA_MOUNT_LABELS, 'zh')).join(' / ')}
        </text>
      )}
    </svg>
  );
}

// ===== Helper renderers =====

function renderLabelLegend(nodes: PlacedNode[], x: number, y: number, w: number): JSX.Element {
  const rowH = 20;
  const items = nodes.slice(0, 10);
  return (
    <>
      {items.map((obj, i) => {
        const ry = y + i * rowH;
        return (
          <g key={`legend-${obj.id}`}>
            <circle cx={x + 10} cy={ry + 7} r={8} fill={obj.color} fillOpacity={0.9} />
            <text x={x + 10} y={ry + 11} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="bold">{obj.label}</text>
            <text x={x + 24} y={ry + 11} fill="#e2e8f0" fontSize={10}>
              {String(obj.name || obj.label || '').slice(0, 16)}
            </text>
            {obj.mountedToId && (
              <text x={x + w - 4} y={ry + 11} textAnchor="end" fill="#60a5fa" fontSize={8}>⛓ 已安装</text>
            )}
          </g>
        );
      })}
    </>
  );
}

function renderInfoSection(x: number, y: number, w: number, title: string, items: string[]): JSX.Element {
  return (
    <>
      <rect x={x - 2} y={y} width={w + 4} height={18} fill="#1b3b70" fillOpacity={0.5} rx={3} />
      <text x={x + 6} y={y + 13} fill="#93c5fd" fontSize={11} fontWeight="bold">{title}</text>
      {items.map((item, i) => (
        <text key={i} x={x + 6} y={y + 32 + i * 18} fill="#e2e8f0" fontSize={10}>
          • {item.length > 32 ? item.slice(0, 31) + '…' : item}
        </text>
      ))}
    </>
  );
}

function renderLineLegend(x: number, y: number, w: number): JSX.Element {
  const midX = x + w / 2;
  return (
    <>
      {/* Solid line = mount */}
      <line x1={x + 4} y1={y} x2={x + 30} y2={y} stroke="#3b82f6" strokeWidth={2.5} />
      <text x={x + 34} y={y + 4} fill="#93c5fd" fontSize={9}>安装关系</text>
      {/* Dashed line = shooting */}
      <line x1={midX} y1={y} x2={midX + 26} y2={y} stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="6 3" />
      <text x={midX + 30} y={y + 4} fill="#ffffff" fontSize={9}>拍摄方向</text>
    </>
  );
}

export type { SimpleLayoutDiagramProps, LayoutObject, ModuleInfo, HardwareSummary };
