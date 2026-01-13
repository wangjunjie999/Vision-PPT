import { memo, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Camera, Settings2, Ruler } from 'lucide-react';
import type { LayoutObject } from './ObjectPropertyPanel';

type ViewType = 'front' | 'side' | 'top';

interface DimensionTableProps {
  objects: LayoutObject[];
  centerX: number;
  centerY: number;
  scale: number;
  currentView: ViewType;
  selectedId: string | null;
  onSelectObject: (id: string) => void;
}

interface DeviceCoordinates {
  id: string;
  name: string;
  type: 'camera' | 'mechanism';
  // 3D coordinates in mm (relative to product center)
  posX: number;
  posY: number;
  posZ: number;
  // Distance from product center
  distanceToCenter: number;
  // Current view coordinates
  viewX: number;
  viewY: number;
}

export const DimensionTable = memo(function DimensionTable({
  objects,
  centerX,
  centerY,
  scale,
  currentView,
  selectedId,
  onSelectObject,
}: DimensionTableProps) {
  
  // Get 3D coordinates directly from objects (now stored as primary data)
  const deviceCoordinates = useMemo((): DeviceCoordinates[] => {
    return objects.map(obj => {
      // Use stored 3D coordinates directly
      const posX = obj.posX ?? 0;
      const posY = obj.posY ?? 0;
      const posZ = obj.posZ ?? 0;
      
      // Canvas coordinates to mm (relative to center) for current view display
      const canvasXmm = (obj.x - centerX) / scale;
      const canvasYmm = (centerY - obj.y) / scale;
      
      const distanceToCenter = Math.round(
        Math.sqrt(posX * posX + posY * posY + posZ * posZ)
      );
      
      return {
        id: obj.id,
        name: obj.name,
        type: obj.type,
        posX: Math.round(posX),
        posY: Math.round(posY),
        posZ: Math.round(posZ),
        distanceToCenter,
        viewX: Math.round(canvasXmm),
        viewY: Math.round(canvasYmm),
      };
    });
  }, [objects, centerX, centerY, scale]);

  // Calculate camera spacing
  const cameraSpacing = useMemo(() => {
    const cameras = deviceCoordinates.filter(d => d.type === 'camera');
    const spacings: { from: string; to: string; distance: number }[] = [];
    
    for (let i = 0; i < cameras.length; i++) {
      for (let j = i + 1; j < cameras.length; j++) {
        const dx = cameras[j].viewX - cameras[i].viewX;
        const dy = cameras[j].viewY - cameras[i].viewY;
        const distance = Math.round(Math.sqrt(dx * dx + dy * dy));
        spacings.push({
          from: cameras[i].name,
          to: cameras[j].name,
          distance,
        });
      }
    }
    
    return spacings;
  }, [deviceCoordinates]);

  const exportToCSV = () => {
    const headers = ['设备名称', '类型', 'X (mm)', 'Y (mm)', 'Z (mm)', '距中心 (mm)'];
    const rows = deviceCoordinates.map(d => [
      d.name,
      d.type === 'camera' ? '相机' : '机构',
      d.posX,
      d.posY,
      d.posZ,
      d.distanceToCenter,
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      '',
      '相机间距',
      ...cameraSpacing.map(s => `${s.from} - ${s.to},${s.distance}mm`),
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `设备安装尺寸表_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cameras = deviceCoordinates.filter(d => d.type === 'camera');
  const mechanisms = deviceCoordinates.filter(d => d.type === 'mechanism');

  return (
    <div className="absolute left-4 top-20 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden z-10 w-64">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-muted/80 to-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">设备位置表</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={exportToCSV}
          title="导出CSV"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      <ScrollArea className="max-h-[400px]">
        <div className="p-3 space-y-4">
          {/* Cameras Section */}
          {cameras.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5 text-blue-500" />
                <span>相机 ({cameras.length})</span>
              </div>
              <div className="space-y-1">
                {cameras.map(cam => (
                  <button
                    key={cam.id}
                    onClick={() => onSelectObject(cam.id)}
                    className={`w-full p-2 rounded-lg text-left transition-all ${
                      selectedId === cam.id 
                        ? 'bg-primary/20 border border-primary/50' 
                        : 'bg-muted/50 hover:bg-muted border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-blue-400">{cam.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {cam.distanceToCenter}mm
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <div className="text-center">
                        <span className="text-red-400">X:</span>
                        <span className="text-foreground ml-1 font-mono">{cam.posX}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-green-400">Y:</span>
                        <span className="text-foreground ml-1 font-mono">{cam.posY}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-blue-400">Z:</span>
                        <span className="text-foreground ml-1 font-mono">{cam.posZ}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Camera Spacing */}
          {cameraSpacing.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>📏</span>
                <span>相机间距</span>
              </div>
              <div className="space-y-1">
                {cameraSpacing.map((spacing, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {spacing.from} ↔ {spacing.to}
                    </span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {spacing.distance}mm
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Mechanisms Section */}
          {mechanisms.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5 text-orange-500" />
                <span>机构 ({mechanisms.length})</span>
              </div>
              <div className="space-y-1">
                {mechanisms.map(mech => (
                  <button
                    key={mech.id}
                    onClick={() => onSelectObject(mech.id)}
                    className={`w-full p-2 rounded-lg text-left transition-all ${
                      selectedId === mech.id 
                        ? 'bg-primary/20 border border-primary/50' 
                        : 'bg-muted/50 hover:bg-muted border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-orange-400">{mech.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {mech.distanceToCenter}mm
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <div className="text-center">
                        <span className="text-red-400">X:</span>
                        <span className="text-foreground ml-1 font-mono">{mech.posX}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-green-400">Y:</span>
                        <span className="text-foreground ml-1 font-mono">{mech.posY}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-blue-400">Z:</span>
                        <span className="text-foreground ml-1 font-mono">{mech.posZ}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {objects.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              暂无设备
              <br />
              <span className="text-xs">点击上方按钮添加相机或机构</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
