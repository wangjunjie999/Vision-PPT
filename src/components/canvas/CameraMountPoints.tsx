import React, { useMemo } from 'react';
import { type LayoutObject } from './ObjectPropertyPanel';
import { getMechanismMountPoints, type CameraMountPoint } from './MechanismSVG';

interface CameraMountPointsProps {
  mechanismObject: LayoutObject;
  currentView: 'front' | 'side' | 'top';
  cameras: LayoutObject[];
  onSnapCamera?: (cameraId: string, mountPoint: CameraMountPoint, mechanismId: string) => void;
  draggingCameraId?: string | null;
  scale: number;
}

interface MountedCamera {
  camera: LayoutObject;
  mountPoint: CameraMountPoint;
}

export function CameraMountPoints({
  mechanismObject,
  currentView,
  cameras,
  onSnapCamera,
  draggingCameraId,
  scale,
}: CameraMountPointsProps) {
  const mechanismType = mechanismObject.mechanismType || 'camera_mount';
  const mountPoints = useMemo(
    () => getMechanismMountPoints(mechanismType, currentView),
    [mechanismType, currentView]
  );

  // Calculate which cameras are close to mount points
  const nearbyMounts = useMemo(() => {
    if (!draggingCameraId) return [];
    
    const draggingCamera = cameras.find(c => c.id === draggingCameraId);
    if (!draggingCamera) return [];

    const snapThreshold = 70; // pixels - increased for easier interaction
    
    return mountPoints.map(mp => {
      const mountWorldX = mechanismObject.x + mp.position.x * (mechanismObject.width / 2);
      const mountWorldY = mechanismObject.y + mp.position.y * (mechanismObject.height / 2);
      
      const dx = draggingCamera.x - mountWorldX;
      const dy = draggingCamera.y - mountWorldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      return {
        mountPoint: mp,
        distance,
        isNear: distance < snapThreshold,
        worldX: mountWorldX,
        worldY: mountWorldY,
      };
    }).filter(m => m.isNear);
  }, [draggingCameraId, cameras, mountPoints, mechanismObject]);

  // Find cameras that are "mounted" to this mechanism
  const mountedCameras = useMemo(() => {
    const mounted: MountedCamera[] = [];
    
    cameras.forEach(camera => {
      if (camera.mountedToMechanismId === mechanismObject.id) {
        const mp = mountPoints.find(p => p.id === camera.mountPointId);
        if (mp) {
          mounted.push({ camera, mountPoint: mp });
        }
      }
    });
    
    return mounted;
  }, [cameras, mechanismObject.id, mountPoints]);

  const handleMountPointClick = (mp: CameraMountPoint) => {
    if (draggingCameraId && onSnapCamera) {
      onSnapCamera(draggingCameraId, mp, mechanismObject.id);
    }
  };

  return (
    <g>
      {/* Render mount point indicators */}
      {mountPoints.map(mp => {
        const mpX = mp.position.x * (mechanismObject.width / 2);
        const mpY = mp.position.y * (mechanismObject.height / 2);
        const isNearby = nearbyMounts.some(n => n.mountPoint.id === mp.id);
        const hasMountedCamera = mountedCameras.some(m => m.mountPoint.id === mp.id);
        
        return (
          <g
            key={mp.id}
            transform={`translate(${mpX}, ${mpY})`}
            onClick={() => handleMountPointClick(mp)}
            style={{ cursor: draggingCameraId ? 'pointer' : 'default' }}
          >
            {/* Larger transparent click area for easier interaction */}
            <circle
              r={40}
              fill="transparent"
              style={{ cursor: 'pointer' }}
            />
            
            {/* Outer glow ring */}
            <circle
              r={isNearby ? 40 : 28}
              fill="none"
              stroke={isNearby ? '#22c55e' : '#f97316'}
              strokeWidth={2}
              strokeDasharray="8 4"
              opacity={isNearby ? 0.8 : 0.4}
              style={{ 
                animation: isNearby ? 'spin 8s linear infinite' : undefined,
                transformOrigin: 'center'
              }}
            />
            
            {/* Main mount point circle - enlarged */}
            <circle
              r={isNearby ? 28 : hasMountedCamera ? 20 : 16}
              fill={isNearby ? 'rgba(34, 197, 94, 0.4)' : hasMountedCamera ? 'rgba(59, 130, 246, 0.3)' : 'rgba(249, 115, 22, 0.2)'}
              stroke={isNearby ? '#22c55e' : hasMountedCamera ? '#3b82f6' : '#f97316'}
              strokeWidth={isNearby ? 4 : 3}
              strokeDasharray={hasMountedCamera ? 'none' : '6 3'}
              className={isNearby ? 'animate-pulse' : ''}
              style={{
                filter: isNearby ? 'drop-shadow(0 0 12px rgba(34, 197, 94, 0.7))' : 
                        hasMountedCamera ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 
                        'drop-shadow(0 0 6px rgba(249, 115, 22, 0.4))'
              }}
            />
            
            {/* Mount type indicator - enlarged */}
            <text
              textAnchor="middle"
              dy={6}
              fill={isNearby ? '#22c55e' : hasMountedCamera ? '#3b82f6' : '#f97316'}
              fontSize={18}
              style={{ pointerEvents: 'none' }}
            >
              {hasMountedCamera ? '🔗' : '📷'}
            </text>
            
            {/* Snap hint when dragging near - enlarged */}
            {isNearby && (
              <g transform="translate(0, -38)">
                <rect 
                  x={-55} 
                  y={-16} 
                  width={110} 
                  height={28} 
                  rx={6} 
                  fill="rgba(34, 197, 94, 0.95)"
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
                />
                <text x={0} y={2} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="bold">
                  释放吸附
                </text>
              </g>
            )}
          </g>
        );
      })}
      
      {/* Connection lines for mounted cameras */}
      {mountedCameras.map(({ camera, mountPoint }) => {
        const mpX = mountPoint.position.x * (mechanismObject.width / 2);
        const mpY = mountPoint.position.y * (mechanismObject.height / 2);
        
        // Camera position relative to mechanism
        const camRelX = camera.x - mechanismObject.x;
        const camRelY = camera.y - mechanismObject.y;
        
        return (
          <g key={`connection-${camera.id}`}>
            {/* Connection line */}
            <line
              x1={mpX}
              y1={mpY}
              x2={camRelX}
              y2={camRelY}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="6 3"
              opacity={0.7}
            />
            
            {/* Mount indicator at connection point */}
            <circle
              cx={mpX}
              cy={mpY}
              r={4}
              fill="#3b82f6"
            />
          </g>
        );
      })}
    </g>
  );
}

// Helper function to check if a camera is near any mount point
export function findNearestMountPoint(
  cameraX: number,
  cameraY: number,
  mechanisms: LayoutObject[],
  currentView: 'front' | 'side' | 'top',
  snapThreshold: number = 70
): { mechanism: LayoutObject; mountPoint: CameraMountPoint; distance: number } | null {
  let nearest: { mechanism: LayoutObject; mountPoint: CameraMountPoint; distance: number } | null = null;
  
  mechanisms.forEach(mech => {
    if (mech.type !== 'mechanism') return;
    
    const mechanismType = mech.mechanismType || 'camera_mount';
    const mountPoints = getMechanismMountPoints(mechanismType, currentView);
    
    mountPoints.forEach(mp => {
      const mountWorldX = mech.x + mp.position.x * (mech.width / 2);
      const mountWorldY = mech.y + mp.position.y * (mech.height / 2);
      
      const dx = cameraX - mountWorldX;
      const dy = cameraY - mountWorldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < snapThreshold) {
        if (!nearest || distance < nearest.distance) {
          nearest = { mechanism: mech, mountPoint: mp, distance };
        }
      }
    });
  });
  
  return nearest;
}

// Helper function to get the world position of a mount point
export function getMountPointWorldPosition(
  mechanism: LayoutObject,
  mountPointId: string,
  currentView: 'front' | 'side' | 'top'
): { x: number; y: number } | null {
  const mechanismType = mechanism.mechanismType || 'camera_mount';
  const mountPoints = getMechanismMountPoints(mechanismType, currentView);
  const mp = mountPoints.find(p => p.id === mountPointId);
  
  if (!mp) return null;
  
  return {
    x: mechanism.x + mp.position.x * (mechanism.width / 2),
    y: mechanism.y + mp.position.y * (mechanism.height / 2),
  };
}

export default CameraMountPoints;
