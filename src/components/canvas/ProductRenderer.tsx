import { memo } from 'react';
import type { LayoutObject } from './ObjectPropertyPanel';
import { ResizeHandles } from './ResizeHandles';

interface ProductRendererProps {
  objects: LayoutObject[];
  selectedId: string | null;
  secondSelectedId: string | null;
  panMode: boolean;
  isIsometric: boolean;
  onMouseDown: (e: React.MouseEvent, obj: LayoutObject) => void;
  onResize: (id: string, width: number, height: number, x: number, y: number) => void;
  productDimensions: { length: number; width: number; height: number };
  productW: number;
  productH: number;
  productD: number;
  currentView: string;
  isoProject: (px: number, py: number, pz: number) => { x: number; y: number };
}

export const ProductRenderer = memo(function ProductRenderer({
  objects, selectedId, secondSelectedId, panMode, isIsometric,
  onMouseDown, onResize, productDimensions, productW, productH, productD, currentView, isoProject,
}: ProductRendererProps) {
  return (
    <>
      {/* Isometric 3D cube */}
      {isIsometric && (() => {
        const productObjs = objects.filter(o => o.type === 'product');
        if (productObjs.length === 0) return null;
        return productObjs.map((productObj) => {
        const isMounted = !!productObj?.mountedToMechanismId;
        const parentMech = isMounted ? objects.find(o => o.id === productObj?.mountedToMechanismId) : null;

        const pLen = productObj.productLength ?? productDimensions.length;
        const pWid = productObj.productWidth ?? productDimensions.width;
        const pHei = productObj.productHeight ?? productDimensions.height;

        const pPosX = isMounted && parentMech ? (parentMech.posX ?? 0) : (productObj?.posX ?? 0);
        const pPosY = isMounted && parentMech ? (parentMech.posY ?? 0) : (productObj?.posY ?? 0);
        const mechHeight = isMounted && parentMech ? (parentMech.height ?? 80) : 0;
        const pPosZ = isMounted && parentMech ? (parentMech.posZ ?? 0) + mechHeight / 2 + pHei / 2 : (productObj?.posZ ?? 0);

        const hL = pLen / 2;
        const hW = pWid / 2;
        const hH = pHei / 2;
        const p = (x: number, y: number, z: number) => isoProject(pPosX + x, pPosY + y, pPosZ + z);
        const t0 = p(-hL, -hW, hH), t1 = p(hL, -hW, hH), t2 = p(hL, hW, hH), t3 = p(-hL, hW, hH);
        const b0 = p(-hL, -hW, -hH), b1 = p(hL, -hW, -hH), b2 = p(hL, hW, -hH), b3 = p(-hL, hW, -hH);

        const topFace = `${t0.x},${t0.y} ${t1.x},${t1.y} ${t2.x},${t2.y} ${t3.x},${t3.y}`;
        const frontFace = `${t0.x},${t0.y} ${t1.x},${t1.y} ${b1.x},${b1.y} ${b0.x},${b0.y}`;
        const rightFace = `${t1.x},${t1.y} ${t2.x},${t2.y} ${b2.x},${b2.y} ${b1.x},${b1.y}`;
        const leftFace = `${t0.x},${t0.y} ${t3.x},${t3.y} ${b3.x},${b3.y} ${b0.x},${b0.y}`;

        const fillLeft = isMounted ? '#15803d' : '#0891b2';
        const fillFront = isMounted ? '#16a34a' : '#06b6d4';
        const fillRight = isMounted ? '#166534' : '#0e7490';
        const fillTop = isMounted ? '#4ade80' : '#67e8f9';
        const strokeColor = isMounted ? '#22c55e' : '#22d3ee';
        const textColor = isMounted ? '#bbf7d0' : '#e0f2fe';
        const labelColor = isMounted ? '#86efac' : '#94a3b8';

        const connectionLine = isMounted && parentMech ? (() => {
          const prodCenter = isoProject(pPosX, pPosY, pPosZ);
          const mechCenter = isoProject(parentMech.posX ?? 0, parentMech.posY ?? 0, parentMech.posZ ?? 0);
          return (
            <g>
              <line x1={prodCenter.x} y1={prodCenter.y} x2={mechCenter.x} y2={mechCenter.y}
                stroke="#22c55e" strokeWidth={2} strokeDasharray="6 3" opacity={0.5} />
              <circle cx={mechCenter.x} cy={mechCenter.y} r={3} fill="#ea580c" opacity={0.8} />
            </g>
          );
        })() : null;

        return (
          <g key={productObj.id} opacity={isMounted ? 0.7 : 1}>
            {connectionLine}
            <g filter="url(#drop-shadow)">
              <line x1={t2.x} y1={t2.y} x2={t3.x} y2={t3.y} stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.35} />
              <line x1={t3.x} y1={t3.y} x2={b3.x} y2={b3.y} stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.35} />
              <line x1={b3.x} y1={b3.y} x2={b2.x} y2={b2.y} stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.35} />
              <line x1={b0.x} y1={b0.y} x2={b3.x} y2={b3.y} stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.35} />
              <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.35} />
              <line x1={b1.x} y1={b1.y} x2={b2.x} y2={b2.y} stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" opacity={0.35} />
              <polygon points={leftFace} fill={fillLeft} fillOpacity="0.3" stroke={strokeColor} strokeWidth="1.5" />
              <polygon points={frontFace} fill={fillFront} fillOpacity="0.5" stroke={strokeColor} strokeWidth="1.5" />
              <polygon points={rightFace} fill={fillRight} fillOpacity="0.5" stroke={strokeColor} strokeWidth="1.5" />
              <polygon points={topFace} fill={fillTop} fillOpacity="0.4" stroke={strokeColor} strokeWidth="1.5" />
              <text x={(t0.x + t1.x + b1.x + b0.x) / 4} y={(t0.y + t1.y + b1.y + b0.y) / 4 + 4} textAnchor="middle" fill={textColor} fontSize="10" fontWeight="500" opacity="0.8">正面</text>
              <text x={(t1.x + t2.x + b2.x + b1.x) / 4} y={(t1.y + t2.y + b2.y + b1.y) / 4 + 4} textAnchor="middle" fill={textColor} fontSize="10" fontWeight="500" opacity="0.8">侧面</text>
              <text x={(t0.x + t1.x + t2.x + t3.x) / 4} y={(t0.y + t1.y + t2.y + t3.y) / 4 + 4} textAnchor="middle" fill={textColor} fontSize="10" fontWeight="500" opacity="0.8">顶面</text>
              <text
                x={(t0.x + t1.x + t2.x + t3.x) / 4}
                y={Math.max(b0.y, b1.y, b2.y) + 25}
                textAnchor="middle" fill={labelColor} fontSize="11"
              >
                {isMounted ? '📦 ' : ''}{productObj.name || '产品'} {pLen}×{pWid}×{pHei}mm
              </text>
            </g>
          </g>
        );
        });
      })()}

      {/* 2D product rendering */}
      {!isIsometric && objects.filter(obj => obj.type === 'product').map(obj => {
        const isSelected = obj.id === selectedId;
        const isSecondSelected = obj.id === secondSelectedId;
        const isMounted = !!obj.mountedToMechanismId;
        // Per-object dimensions override the workstation defaults so each product can be different.
        const objLen = obj.productLength;
        const objWid = obj.productWidth;
        const objHei = obj.productHeight;
        const hasCustomDims = objLen != null || objWid != null || objHei != null;
        const scale = productW / Math.max(productDimensions.length, 1);
        const localW = (objLen ?? productDimensions.length) * scale;
        const localH = (objHei ?? productDimensions.height) * scale;
        const localD = (objWid ?? productDimensions.width) * scale;
        const pW = currentView === 'side' ? localD : localW;
        const pH = currentView === 'top' ? localD : localH;
        const dimsLabel = hasCustomDims
          ? `${objLen ?? productDimensions.length}×${objWid ?? productDimensions.width}×${objHei ?? productDimensions.height}mm`
          : `${productDimensions.length}×${productDimensions.width}×${productDimensions.height}mm`;

        return (
          <g
            key={obj.id}
            transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation})`}
            onMouseDown={(e) => onMouseDown(e, obj)}
            style={{ cursor: obj.locked ? 'not-allowed' : panMode ? 'inherit' : 'move' }}
            filter={isSelected ? "url(#glow)" : "url(#drop-shadow)"}
            opacity={isMounted ? 0.7 : 1}
          >
            {(isSelected || isSecondSelected) && (
              <rect
                x={-pW / 2 - 6} y={-pH / 2 - 6} width={pW + 12} height={pH + 12}
                fill="none" stroke={isMounted ? '#22c55e' : '#22d3ee'}
                strokeWidth="2" strokeDasharray="6 3" rx={8} className="animate-pulse"
              />
            )}
            <rect
              x={-pW / 2} y={-pH / 2} width={pW} height={pH}
              fill={isMounted ? '#16a34a' : 'url(#product-grad)'}
              stroke={isMounted ? '#22c55e' : '#22d3ee'}
              strokeWidth={isSelected ? 3 : 2} rx={6}
            />
            <line x1={-15} y1={0} x2={15} y2={0} stroke="#fff" strokeWidth="1" opacity="0.5" />
            <line x1={0} y1={-15} x2={0} y2={15} stroke="#fff" strokeWidth="1" opacity="0.5" />
            <circle cx={0} cy={0} r={4} fill="#fff" opacity="0.7" />
            <text x={0} y={pH / 2 + 20} textAnchor="middle" fill={isMounted ? '#86efac' : '#94a3b8'} fontSize="11">
              {isMounted ? '📦 ' : ''}{obj.name || '产品'} {dimsLabel}
            </text>
            <ResizeHandles object={{ ...obj, width: pW, height: pH }} isSelected={isSelected} onResize={onResize} />
          </g>
        );
      })}
    </>
  );
});
