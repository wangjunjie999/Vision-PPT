/**
 * 幻灯片布局映射配置组件
 * 用于将模板幻灯片映射到工位页面类型
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowRight, 
  Layers, 
  FileText, 
  Image, 
  Layout, 
  Box, 
  Gauge, 
  Eye, 
  List,
  Package,
  RefreshCw,
  Wand2,
  Info,
  GripVertical
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// 工位页面类型定义
export const WORKSTATION_SLIDE_TYPES = [
  { 
    id: 'workstation_title', 
    label: '工位标题页', 
    icon: FileText,
    description: 'DB号 + 工位名称 + 负责人',
    required: false,
  },
  { 
    id: 'basic_info', 
    label: '基本信息页', 
    icon: Info,
    description: '工位类型、节拍、尺寸等基础参数',
    required: true,
  },
  { 
    id: 'product_schematic', 
    label: '产品示意图页', 
    icon: Image,
    description: '检测对象产品图及标注',
    required: true,
  },
  { 
    id: 'technical_requirements', 
    label: '技术要求页', 
    icon: List,
    description: '检测项、精度要求、验收标准',
    required: true,
  },
  { 
    id: 'three_view', 
    label: '机械布局三视图', 
    icon: Layout,
    description: '正视图、侧视图、俯视图 (等比例)',
    required: true,
  },
  { 
    id: 'schematic_diagram', 
    label: '示意图/布置图', 
    icon: Box,
    description: '设备布局示意图',
    required: false,
  },
  { 
    id: 'motion_method', 
    label: '运动/检测方式页', 
    icon: Gauge,
    description: '运动描述、触发方式、检测流程',
    required: true,
  },
  { 
    id: 'optical_solution', 
    label: '光学方案页', 
    icon: Eye,
    description: '相机、镜头、光源选型方案',
    required: true,
  },
  { 
    id: 'vision_list', 
    label: '测量方法及视觉清单', 
    icon: List,
    description: '各模块检测方法与配置清单',
    required: true,
  },
  { 
    id: 'bom', 
    label: 'BOM清单及审核', 
    icon: Package,
    description: '硬件物料清单与审核签字',
    required: true,
  },
];

export interface SlideMapping {
  templateSlideIndex: number;
  slideType: string;
  enabled: boolean;
}

export interface LayoutMappingConfig {
  mappings: SlideMapping[];
  duplicateForEachWorkstation: boolean;
  preserveUnmappedSlides: boolean;
}

interface SlideInfo {
  index: number;
  detectedType: string;
  customFields: string[];
  hasImages?: boolean;
}

interface SlideLayoutMappingProps {
  templateSlides: SlideInfo[];
  config: LayoutMappingConfig;
  onChange: (config: LayoutMappingConfig) => void;
  disabled?: boolean;
}

export function SlideLayoutMapping({
  templateSlides,
  config,
  onChange,
  disabled = false,
}: SlideLayoutMappingProps) {
  const [hoveredSlide, setHoveredSlide] = useState<number | null>(null);

  const handleMappingChange = (slideIndex: number, slideType: string) => {
    const newMappings = [...config.mappings];
    const existingIndex = newMappings.findIndex(m => m.templateSlideIndex === slideIndex);
    
    if (existingIndex >= 0) {
      if (slideType === 'none') {
        newMappings.splice(existingIndex, 1);
      } else {
        newMappings[existingIndex] = { ...newMappings[existingIndex], slideType };
      }
    } else if (slideType !== 'none') {
      newMappings.push({ templateSlideIndex: slideIndex, slideType, enabled: true });
    }
    
    onChange({ ...config, mappings: newMappings });
  };

  const handleEnableToggle = (slideIndex: number, enabled: boolean) => {
    const newMappings = config.mappings.map(m => 
      m.templateSlideIndex === slideIndex ? { ...m, enabled } : m
    );
    onChange({ ...config, mappings: newMappings });
  };

  const autoMapSlides = () => {
    const newMappings: SlideMapping[] = [];
    
    templateSlides.forEach((slide) => {
      const detectedType = slide.detectedType;
      // 尝试根据检测到的类型自动匹配
      const matchedType = WORKSTATION_SLIDE_TYPES.find(t => 
        t.id === detectedType || 
        t.id.includes(detectedType) ||
        detectedType.includes(t.id.replace('_', ''))
      );
      
      if (matchedType) {
        newMappings.push({
          templateSlideIndex: slide.index,
          slideType: matchedType.id,
          enabled: true,
        });
      }
    });
    
    onChange({ ...config, mappings: newMappings });
  };

  const getMappingForSlide = (slideIndex: number) => {
    return config.mappings.find(m => m.templateSlideIndex === slideIndex);
  };

  const getMappedSlidesCount = () => {
    return config.mappings.filter(m => m.enabled).length;
  };

  const getTypeIcon = (typeId: string) => {
    const type = WORKSTATION_SLIDE_TYPES.find(t => t.id === typeId);
    const Icon = type?.icon || FileText;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              幻灯片布局映射
            </CardTitle>
            <CardDescription className="mt-1">
              指定模板幻灯片对应的工位页面类型，生成时将按此顺序复制
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoMapSlides}
                  disabled={disabled || templateSlides.length === 0}
                  className="gap-1"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  自动识别
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                根据幻灯片内容自动推断页面类型
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 全局选项 */}
        <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Switch
              id="duplicate-ws"
              checked={config.duplicateForEachWorkstation}
              onCheckedChange={(checked) => 
                onChange({ ...config, duplicateForEachWorkstation: checked })
              }
              disabled={disabled}
            />
            <Label htmlFor="duplicate-ws" className="text-sm cursor-pointer">
              为每个工位复制幻灯片
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="preserve-unmapped"
              checked={config.preserveUnmappedSlides}
              onCheckedChange={(checked) => 
                onChange({ ...config, preserveUnmappedSlides: checked })
              }
              disabled={disabled}
            />
            <Label htmlFor="preserve-unmapped" className="text-sm cursor-pointer">
              保留未映射的幻灯片
            </Label>
          </div>
        </div>

        {/* 映射统计 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>模板幻灯片: {templateSlides.length} 页</span>
          <span>•</span>
          <span>已映射: {getMappedSlidesCount()} 页</span>
          <span>•</span>
          <span>页面类型: {WORKSTATION_SLIDE_TYPES.length} 种</span>
        </div>

        {/* 映射列表 */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {templateSlides.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">请先上传并解析PPTX模板</p>
                <p className="text-xs mt-1">解析后将显示模板幻灯片列表</p>
              </div>
            ) : (
              templateSlides.map((slide) => {
                const mapping = getMappingForSlide(slide.index);
                const isHovered = hoveredSlide === slide.index;
                
                return (
                  <div
                    key={slide.index}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${mapping?.enabled ? 'bg-primary/5 border-primary/20' : 'bg-background'}
                      ${isHovered ? 'shadow-sm' : ''}
                    `}
                    onMouseEnter={() => setHoveredSlide(slide.index)}
                    onMouseLeave={() => setHoveredSlide(null)}
                  >
                    {/* 拖拽手柄 (未来功能) */}
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    
                    {/* 幻灯片信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          #{slide.index + 1}
                        </Badge>
                        {slide.detectedType !== 'unknown' && (
                          <Badge variant="secondary" className="text-xs">
                            {slide.detectedType}
                          </Badge>
                        )}
                        {slide.customFields.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {slide.customFields.length} 占位符
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 箭头 */}
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                    {/* 页面类型选择 */}
                    <Select
                      value={mapping?.slideType || 'none'}
                      onValueChange={(value) => handleMappingChange(slide.index, value)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="选择页面类型">
                          {mapping?.slideType ? (
                            <div className="flex items-center gap-2">
                              {getTypeIcon(mapping.slideType)}
                              <span className="truncate">
                                {WORKSTATION_SLIDE_TYPES.find(t => t.id === mapping.slideType)?.label}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">不映射</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">不映射</span>
                        </SelectItem>
                        {WORKSTATION_SLIDE_TYPES.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              <span>{type.label}</span>
                              {type.required && (
                                <Badge variant="outline" className="text-[10px] ml-1">必需</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 启用开关 */}
                    {mapping && (
                      <Switch
                        checked={mapping.enabled}
                        onCheckedChange={(checked) => handleEnableToggle(slide.index, checked)}
                        disabled={disabled}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* 生成顺序预览 */}
        {config.mappings.filter(m => m.enabled).length > 0 && (
          <div className="pt-3 border-t">
            <Label className="text-xs text-muted-foreground mb-2 block">生成顺序预览</Label>
            <div className="flex flex-wrap gap-1">
              {config.mappings
                .filter(m => m.enabled)
                .sort((a, b) => a.templateSlideIndex - b.templateSlideIndex)
                .map((mapping, idx) => {
                  const type = WORKSTATION_SLIDE_TYPES.find(t => t.id === mapping.slideType);
                  return (
                    <TooltipProvider key={mapping.templateSlideIndex}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary" className="gap-1 cursor-default">
                            <span className="text-xs font-mono">{idx + 1}</span>
                            {type && <type.icon className="h-3 w-3" />}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{type?.label}</p>
                          <p className="text-xs text-muted-foreground">模板第 {mapping.templateSlideIndex + 1} 页</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SlideLayoutMapping;
