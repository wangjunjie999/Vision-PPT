import { useData } from '@/contexts/DataContext';
import { useAppStore } from '@/store/useAppStore';
import { useCameras, useLights, useLenses, useControllers } from '@/hooks/useHardware';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Save,
  AlertCircle,
  Crosshair,
  ScanLine,
  Type,
  Brain,
  Box,
  Download,
  FileImage,
  FileText,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { VisionSystemDiagram } from './VisionSystemDiagram';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

const moduleTypeIcons = {
  positioning: Crosshair,
  defect: ScanLine,
  ocr: Type,
  deeplearning: Brain,
};

const moduleTypeLabels = {
  positioning: '引导定位',
  defect: '缺陷检测',
  ocr: 'OCR识别',
  deeplearning: '深度学习',
};

export function ModuleSchematic() {
  const { 
    selectedModuleId, 
    selectedWorkstationId,
    modules, 
    workstations, 
    layouts,
    updateModule,
    selectModule
  } = useData();

  const { cameras } = useCameras();
  const { lights } = useLights();
  const { lenses } = useLenses();
  const { controllers } = useControllers();
  const { getPixelRatio } = useAppStore();
  const diagramRef = useRef<HTMLDivElement>(null);
  
  // FOV state for interactive editing
  const [fovAngle, setFovAngle] = useState(45);
  const [lightDistance, setLightDistance] = useState(335);
  
  const module = modules.find(m => m.id === selectedModuleId) as any;
  const workstation = workstations.find(w => w.id === selectedWorkstationId) as any;
  const layout = layouts.find(l => l.workstation_id === selectedWorkstationId) as any;
  
  if (!module || !workstation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">未选择模块</p>
      </div>
    );
  }

  // Check if workstation has saved top view
  const hasTopView = layout?.top_view_saved as boolean;
  
  if (!hasTopView) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-16 w-16 text-warning" />
        <h3 className="text-lg font-semibold">请先完成工位布局</h3>
        <p className="text-muted-foreground text-center max-w-md">
          模块2D示意图需要以工位俯视图作为底图。请先选择工位"{workstation.name}"并保存机械布局三视图。
        </p>
        <Button variant="outline" onClick={() => selectModule(null)}>
          返回工位配置
        </Button>
      </div>
    );
  }

  const selectedCamera = cameras.find(c => c.id === module.selected_camera);
  const selectedLens = lenses.find(l => l.id === module.selected_lens);
  const selectedLight = lights.find(l => l.id === module.selected_light);
  const selectedController = controllers.find(c => c.id === module.selected_controller);
  
  const ModuleIcon = moduleTypeIcons[(module.type || 'positioning') as keyof typeof moduleTypeIcons] || Box;

  // Hardware selection handlers - use camera_id, lens_id, light_id, controller_id fields
  const handleCameraSelect = useCallback((cameraId: string) => {
    updateModule(module.id, { camera_id: cameraId } as any);
    toast.success('相机已更新');
  }, [module.id, updateModule]);

  const handleLensSelect = useCallback((lensId: string) => {
    updateModule(module.id, { lens_id: lensId } as any);
    toast.success('镜头已更新');
  }, [module.id, updateModule]);

  const handleLightSelect = useCallback((lightId: string) => {
    updateModule(module.id, { light_id: lightId } as any);
    toast.success('光源已更新');
  }, [module.id, updateModule]);

  const handleControllerSelect = useCallback((controllerId: string) => {
    updateModule(module.id, { controller_id: controllerId } as any);
    toast.success('工控机已更新');
  }, [module.id, updateModule]);

  const handleFovAngleChange = useCallback((angle: number) => {
    setFovAngle(Math.max(10, Math.min(120, angle)));
  }, []);

  const handleLightDistanceChange = useCallback((distance: number) => {
    setLightDistance(Math.max(50, Math.min(1000, distance)));
  }, []);

  // Export as PNG
  const handleExportPNG = useCallback(async () => {
    if (!diagramRef.current) return;
    
    try {
      toast.loading('正在生成PNG...');
      const pixelRatio = getPixelRatio();
      const dataUrl = await toPng(diagramRef.current, {
        quality: 1,
        pixelRatio,
        backgroundColor: '#1a1a2e',
      });
      
      // Download the image
      const link = document.createElement('a');
      link.download = `${module.name}-视觉系统示意图.png`;
      link.href = dataUrl;
      link.click();
      
      toast.dismiss();
      toast.success('PNG已导出');
    } catch (error) {
      toast.dismiss();
      toast.error('导出PNG失败');
      console.error(error);
    }
  }, [module.name]);

  // Export as PDF
  const handleExportPDF = useCallback(async () => {
    if (!diagramRef.current) return;
    
    try {
      toast.loading('正在生成PDF...');
      const pixelRatio = getPixelRatio();
      const dataUrl = await toPng(diagramRef.current, {
        quality: 1,
        pixelRatio,
        backgroundColor: '#1a1a2e',
      });
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgWidth = 280;
      const imgHeight = (diagramRef.current.offsetHeight / diagramRef.current.offsetWidth) * imgWidth;
      
      pdf.setFillColor(26, 26, 46);
      pdf.rect(0, 0, 297, 210, 'F');
      
      pdf.addImage(dataUrl, 'PNG', 8, 10, imgWidth, imgHeight);
      
      // Add title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text(`${module.name} - 视觉系统示意图`, 148, 200, { align: 'center' });
      
      pdf.save(`${module.name}-视觉系统示意图.pdf`);
      
      toast.dismiss();
      toast.success('PDF已导出');
    } catch (error) {
      toast.dismiss();
      toast.error('导出PDF失败');
      console.error(error);
    }
  }, [module.name]);

  const [savingSchematic, setSavingSchematic] = useState(false);
  const [schematicSaved, setSchematicSaved] = useState(!!(module as any).schematic_image_url);

  const handleSaveSchematic = async () => {
    if (!diagramRef.current) return;
    
    setSavingSchematic(true);
    
    try {
      // Wait for SVG to fully render using requestAnimationFrame
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
      
      const pixelRatio = getPixelRatio();
      const dataUrl = await toPng(diagramRef.current, {
        quality: 1,
        pixelRatio,
        backgroundColor: '#1a1a2e',
      });
      
      // Convert base64 to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Upload to Supabase Storage
      const fileName = `module-schematic-${module.id}.png`;
      
      // Remove old file if exists
      await supabase.storage.from('module-schematics').remove([fileName]);
      
      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('module-schematics')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('module-schematics')
        .getPublicUrl(fileName);
      
      // Update module with schematic URL
      await updateModule(module.id, { 
        schematic_image_url: publicUrl,
        status: 'complete'
      });
      
      setSchematicSaved(true);
      toast.success('视觉系统示意图已保存，可用于PPT生成');
    } catch (error) {
      console.error('Failed to save schematic:', error);
      toast.error('保存示意图失败');
    } finally {
      setSavingSchematic(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ModuleIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{module.name}</h3>
            <p className="text-sm text-muted-foreground">
              {moduleTypeLabels[(module.type || 'positioning') as keyof typeof moduleTypeLabels] || module.type || 'positioning'} · {workstation.name} · 视觉系统示意图
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                导出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={handleExportPNG} className="gap-2 cursor-pointer">
                <FileImage className="h-4 w-4" />
                导出为 PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                导出为 PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleSaveSchematic} className="gap-2" disabled={savingSchematic}>
            {savingSchematic ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : schematicSaved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {schematicSaved ? '已保存' : '保存示意图'}
          </Button>
        </div>
      </div>

      {/* Schematic Canvas */}
      <div className="flex-1 p-6 overflow-auto">
        <div 
          ref={diagramRef}
          className="relative w-full max-w-5xl mx-auto bg-background rounded-xl border-2 border-border overflow-hidden" 
          style={{ minHeight: '500px' }}
        >
          {/* Vision System Diagram */}
          <VisionSystemDiagram
            camera={selectedCamera || null}
            lens={selectedLens || null}
            light={selectedLight || null}
            controller={selectedController || null}
            cameras={cameras}
            lenses={lenses}
            lights={lights}
            controllers={controllers}
            onCameraSelect={handleCameraSelect}
            onLensSelect={handleLensSelect}
            onLightSelect={handleLightSelect}
            onControllerSelect={handleControllerSelect}
            lightDistance={lightDistance}
            fovAngle={fovAngle}
            onFovAngleChange={handleFovAngleChange}
            onLightDistanceChange={handleLightDistanceChange}
            roiStrategy={module.roi_strategy || 'full'}
            moduleType={module.type || 'positioning'}
            interactive={true}
            className="w-full h-full"
          />

          {/* Module Info Badge */}
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 border shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ModuleIcon className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{module.name}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>类型: {moduleTypeLabels[(module.type || 'positioning') as keyof typeof moduleTypeLabels] || module.type || 'positioning'}</div>
              {module.processing_time_limit && <div>处理时限: {module.processing_time_limit}ms</div>}
              <div>ROI: {(module.roi_strategy || 'full') === 'full' ? '全图检测' : '自定义区域'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
