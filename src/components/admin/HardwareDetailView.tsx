import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, CircleDot, Sun, Cpu, Folder, Box, Layers, BarChart3, Loader2 } from 'lucide-react';
import { Camera as CameraType, Lens, Light, Controller } from '@/hooks/useHardware';
import { isTelecentricHardware, getOpticalFieldLabels } from '@/utils/telecentric';

type HardwareType = 'cameras' | 'lenses' | 'lights' | 'controllers';
type HardwareItem = CameraType | Lens | Light | Controller;

interface UsageInfo {
  projectName: string;
  projectCode: string;
  workstationName: string;
  moduleName: string;
  moduleType: string;
}

interface HardwareDetailViewProps {
  type: HardwareType;
  item: HardwareItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig = {
  cameras: {
    label: '相机',
    icon: Camera,
    specs: [
      { key: 'brand', label: '品牌' },
      { key: 'model', label: '型号' },
      { key: 'resolution', label: '分辨率' },
      { key: 'frame_rate', label: '帧率', suffix: 'fps' },
      { key: 'interface', label: '接口类型' },
      { key: 'sensor_size', label: '传感器尺寸' },
      { key: 'pixel_size_um', label: '像元尺寸', suffix: 'μm' },
      { key: 'sensor_width_mm', label: '靶面宽度', suffix: 'mm' },
      { key: 'sensor_height_mm', label: '靶面高度', suffix: 'mm' },
    ],
    fieldName: 'selected_camera',
  },
  lenses: {
    label: '镜头',
    icon: CircleDot,
    specs: [
      { key: 'brand', label: '品牌' },
      { key: 'model', label: '型号' },
      { key: 'focal_length', label: '焦距' },
      { key: 'aperture', label: '光圈' },
      { key: 'max_sensor_size', label: '靶面尺寸' },
      { key: 'mount', label: '卡口类型' },
    ],
    fieldName: 'selected_lens',
  },
  lights: {
    label: '光源',
    icon: Sun,
    specs: [
      { key: 'brand', label: '品牌' },
      { key: 'model', label: '型号' },
      { key: 'type', label: '光源类型' },
      { key: 'color', label: '光源颜色' },
      { key: 'power', label: '功率' },
    ],
    fieldName: 'selected_light',
  },
  controllers: {
    label: '工控机',
    icon: Cpu,
    specs: [
      { key: 'brand', label: '品牌' },
      { key: 'model', label: '型号' },
      { key: 'cpu', label: 'CPU' },
      { key: 'gpu', label: 'GPU' },
      { key: 'memory', label: '内存' },
      { key: 'storage', label: '存储' },
      { key: 'performance', label: '性能等级' },
    ],
    fieldName: 'selected_controller',
  },
};

const moduleTypeLabels: Record<string, string> = {
  ocr: '识别',
  measurement: '测量',
  positioning: '定位',
  defect: '检测',
  deeplearning: '深度学习（算法手段）',
};

export function HardwareDetailView({ type, item, open, onOpenChange }: HardwareDetailViewProps) {
  const [usageData, setUsageData] = useState<UsageInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const config = typeConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (open && item) {
      fetchUsageData();
    }
  }, [open, item]);

  const fetchUsageData = async () => {
    if (!item) return;

    setLoading(true);
    try {
      // Query modules that use this hardware item
      const searchValue = `${item.brand} ${item.model}`;
      
      // Build the query based on type
      const fieldName = {
        cameras: 'selected_camera',
        lenses: 'selected_lens',
        lights: 'selected_light',
        controllers: 'selected_controller',
      }[type];
      
      // Use direct fetch to avoid type instantiation issues
      const { data: modules, error } = await supabase
        .from('function_modules')
        .select('id, name, workstation_id') as { data: any[] | null; error: any };

      if (error) throw error;

      // Filter modules manually since eq on dynamic field causes type issues
      const filteredModules = (modules || []).filter((m: any) => m[fieldName] === searchValue);

      if (filteredModules.length === 0) {
        setUsageData([]);
        setLoading(false);
        return;
      }

      // Get workstation IDs
      const workstationIds = [...new Set(filteredModules.map((m: any) => m.workstation_id))] as string[];
      
      // Fetch workstations
      const { data: workstations, error: wsError } = await supabase
        .from('workstations')
        .select('id, name, project_id')
        .in('id', workstationIds);

      if (wsError) throw wsError;

      // Get project IDs
      const projectIds = [...new Set(workstations?.map((w) => w.project_id) || [])] as string[];
      
      // Fetch projects
      const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds);

      if (projError) throw projError;

      // Map data - use type assertion for extended fields
      const usage: UsageInfo[] = filteredModules.map((mod: any) => {
        const ws = workstations?.find((w) => w.id === mod.workstation_id);
        const proj = projects?.find((p: any) => p.id === ws?.project_id) as any;
        return {
          projectName: proj?.name || '未知项目',
          projectCode: proj?.code || '',
          workstationName: ws?.name || '未知工位',
          moduleName: mod.name,
          moduleType: mod.type || 'positioning',
        };
      });

      setUsageData(usage);
    } catch (err) {
      console.error('Failed to fetch usage data:', err);
      setUsageData([]);
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  const itemData = item as Record<string, any>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg">{item.brand} {item.model}</p>
              <p className="text-sm font-normal text-muted-foreground">{config.label}详情</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)] overflow-y-auto">
          <div className="space-y-6 pr-4 pb-4">
            {/* Product Image */}
            {item.image_url && (
              <div className="flex justify-center">
                <div className="w-48 h-48 rounded-lg overflow-hidden bg-secondary">
                  <img
                    src={item.image_url}
                    alt={`${item.brand} ${item.model}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Specifications */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  规格参数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                   {config.specs.map((spec) => {
                    const value = itemData[spec.key];
                    if (value === null || value === undefined || value === '') return null;
                    const telecentricLabels = getOpticalFieldLabels(type === 'lenses' && isTelecentricHardware(item));
                    const label = spec.key === 'focal_length'
                      ? telecentricLabels.focalLabel
                      : spec.key === 'aperture'
                        ? telecentricLabels.apertureLabel
                        : spec.label;
                    return (
                      <div key={spec.key} className="space-y-1">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium">
                          {value}
                          {spec.suffix ? ` ${spec.suffix}` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">标签</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usage Statistics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  使用统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : usageData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    暂未在任何项目中使用
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant="outline" className="gap-1">
                        <Folder className="h-3 w-3" />
                        {new Set(usageData.map((u) => u.projectCode)).size} 个项目
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Box className="h-3 w-3" />
                        {usageData.length} 个模块
                      </Badge>
                    </div>
                    <Separator />
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {usageData.map((usage, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded-md bg-secondary/50 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate font-medium">{usage.projectName}</span>
                            <span className="text-muted-foreground">›</span>
                            <span className="truncate">{usage.workstationName}</span>
                            <span className="text-muted-foreground">›</span>
                            <span className="truncate">{usage.moduleName}</span>
                          </div>
                          <Badge variant="secondary" className="shrink-0 ml-2">
                            {moduleTypeLabels[usage.moduleType] || usage.moduleType}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status & Metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">状态信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">启用状态</p>
                    <Badge variant={item.enabled ? 'default' : 'secondary'}>
                      {item.enabled ? '已启用' : '已禁用'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">创建时间</p>
                    <p className="font-medium">
                      {new Date(item.created_at).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">更新时间</p>
                    <p className="font-medium">
                      {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
