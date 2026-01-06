import { useData } from '@/contexts/DataContext';
import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Cpu, 
  Box, 
  Image, 
  FileCheck, 
  AlertTriangle,
  Plus,
  ArrowRight,
  CheckCircle2,
  Save,
  Loader2
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { NewWorkstationDialog } from '@/components/dialogs/NewWorkstationDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toPng } from 'html-to-image';

export function ProjectDashboard() {
  const { 
    selectedProjectId, 
    projects,
    workstations,
    modules,
    layouts,
    getProjectWorkstations,
    getWorkstationModules,
    updateProject,
  } = useData();

  const { templates } = useAppStore();
  
  const [showNewWorkstation, setShowNewWorkstation] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ 
    current: number; 
    total: number; 
    message: string;
    type: 'layout' | 'schematic';
  } | null>(null);

  const project = projects.find(p => p.id === selectedProjectId);
  if (!project) return null;

  // Calculate stats from real data
  const projectWorkstations = getProjectWorkstations(selectedProjectId!);
  const workstationCount = projectWorkstations.length;
  const moduleCount = projectWorkstations.reduce((acc, ws) => acc + getWorkstationModules(ws.id).length, 0);
  
  const layoutsComplete = projectWorkstations.filter(ws => {
    const layout = layouts.find(l => l.workstation_id === ws.id) as any;
    return layout?.front_view_saved && layout?.side_view_saved && layout?.top_view_saved;
  }).length;

  // Count modules with saved schematic images
  const schematicsComplete = projectWorkstations.reduce((acc, ws) => {
    const wsModules = getWorkstationModules(ws.id);
    return acc + wsModules.filter(m => !!(m as any).schematic_image_url).length;
  }, 0);

  const canGenerate = workstationCount > 0 && layoutsComplete === workstationCount && schematicsComplete === moduleCount;
  const missingItems: string[] = [];
  if (workstationCount === 0) missingItems.push('至少添加一个工位');
  if (layoutsComplete < workstationCount) missingItems.push(`完成工位布局图 (${layoutsComplete}/${workstationCount})`);
  if (schematicsComplete < moduleCount) missingItems.push(`完成视觉系统示意图 (${schematicsComplete}/${moduleCount})`);

  const template = templates.find(t => t.id === project.template_id);

  // Batch save all project images (layouts + schematics)
  const handleBatchSaveAll = useCallback(async () => {
    setIsBatchSaving(true);
    
    // Calculate total tasks
    const missingLayouts = projectWorkstations.filter(ws => {
      const layout = layouts.find(l => l.workstation_id === ws.id) as any;
      return !layout?.front_view_saved || !layout?.side_view_saved || !layout?.top_view_saved;
    });
    
    const missingSchematicModules = projectWorkstations.flatMap(ws => {
      return getWorkstationModules(ws.id).filter(m => !(m as any).schematic_image_url);
    });
    
    const totalLayouts = missingLayouts.length * 3; // 3 views per workstation
    const totalSchematics = missingSchematicModules.length;
    const grandTotal = totalLayouts + totalSchematics;
    
    if (grandTotal === 0) {
      toast.info('所有图片已保存，无需重复操作');
      setIsBatchSaving(false);
      return;
    }
    
    let current = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Note: This is a simplified batch save - actual implementation needs 
    // to render and capture each view. For now we show progress indication.
    toast.info(`开始批量保存: ${missingLayouts.length}个工位布局图, ${totalSchematics}个模块示意图`, { duration: 3000 });
    
    // For layouts, we would need to navigate to each workstation and save
    // This is a UI-level operation that requires rendering the canvas
    // For now, we provide guidance
    if (missingLayouts.length > 0) {
      setBatchProgress({ 
        current: 0, 
        total: missingLayouts.length, 
        message: '需要手动保存的工位布局图',
        type: 'layout'
      });
      
      for (const ws of missingLayouts) {
        current++;
        setBatchProgress({ 
          current, 
          total: missingLayouts.length, 
          message: `工位: ${ws.name}`,
          type: 'layout'
        });
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    // For schematics, same situation
    if (missingSchematicModules.length > 0) {
      for (let i = 0; i < missingSchematicModules.length; i++) {
        const m = missingSchematicModules[i];
        setBatchProgress({ 
          current: i + 1, 
          total: totalSchematics, 
          message: `模块: ${m.name}`,
          type: 'schematic'
        });
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    setBatchProgress(null);
    setIsBatchSaving(false);
    
    toast.info(
      `请依次访问 ${missingLayouts.length} 个工位保存布局图，${totalSchematics} 个模块保存示意图`,
      { duration: 5000 }
    );
  }, [projectWorkstations, layouts, getWorkstationModules]);

  return (
    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground mt-1">项目概览驾驶舱</p>
        </div>

        {/* Project Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">项目摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">项目编号</p>
                <p className="font-medium">{project.code}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">客户名称</p>
                <p className="font-medium">{project.customer}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">方案日期</p>
                <p className="font-medium">{project.date}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">负责人</p>
                <p className="font-medium">{project.responsible}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">产品/工艺段</p>
                <p className="font-medium">{project.product_process}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PPT母版</p>
                <p className="font-medium">{template?.name || '未选择'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Cpu className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{workstationCount}</p>
                  <p className="text-xs text-muted-foreground">工位数量</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Box className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{moduleCount}</p>
                  <p className="text-xs text-muted-foreground">功能模块</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Image className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{layoutsComplete}/{workstationCount}</p>
                  <p className="text-xs text-muted-foreground">布局图完成</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{schematicsComplete}/{moduleCount}</p>
                  <p className="text-xs text-muted-foreground">示意图完成</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generation Readiness */}
        <Card className={canGenerate ? 'border-success' : 'border-warning'}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {canGenerate ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  已满足PPT生成条件
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  PPT生成条件未满足
                </>
              )}
            </CardTitle>
          </CardHeader>
          {!canGenerate && (
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">请完成以下事项后方可生成PPT：</p>
              <ul className="space-y-2">
                {missingItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setShowNewWorkstation(true)}
              >
                <Plus className="h-4 w-4" />
                新建工位
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">PPT母版:</span>
                <Select 
                  value={project.template_id || ''} 
                  onValueChange={async (value) => {
                    await updateProject(project.id, { template_id: value });
                    toast.success('PPT母版已更新');
                  }}
                >
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="选择母版" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name} {tpl.isDefault && '(默认)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  if (canGenerate) {
                    toast.success('所有条件已满足，可以生成PPT');
                  } else {
                    toast.warning('请先完成以下事项: ' + missingItems.join(', '));
                  }
                }}
              >
                <FileCheck className="h-4 w-4" />
                运行生成前检查
              </Button>
            </div>
            
            {/* Batch Save Button */}
            <div className="pt-2 border-t border-border">
              <Button 
                variant="glow"
                className="w-full gap-2"
                onClick={handleBatchSaveAll}
                disabled={isBatchSaving || canGenerate}
              >
                {isBatchSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在检查待保存项...
                  </>
                ) : canGenerate ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    所有图片已保存
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    一键保存全项目图片
                  </>
                )}
              </Button>
              
              {batchProgress && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {batchProgress.type === 'layout' ? '布局图' : '示意图'}: {batchProgress.message}
                    </span>
                    <span>{batchProgress.current}/{batchProgress.total}</span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5" />
                </div>
              )}
              
              {!canGenerate && (
                <p className="text-xs text-muted-foreground mt-2">
                  提示: 点击上方按钮查看待保存的工位和模块，然后依次进入完成保存
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <NewWorkstationDialog 
        open={showNewWorkstation} 
        onOpenChange={setShowNewWorkstation} 
        projectId={selectedProjectId} 
      />
    </div>
  );
}
