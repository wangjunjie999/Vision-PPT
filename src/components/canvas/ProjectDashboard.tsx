import { useData } from '@/contexts/DataContext';
import { usePPTTemplates } from '@/hooks/usePPTTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Cpu, 
  Box, 
  Image, 
  FileCheck, 
  AlertTriangle,
  Plus,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useState } from 'react';
import { NewWorkstationDialog } from '@/components/dialogs/NewWorkstationDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CircularProgress } from '@/components/ui/circular-progress';
import { motion } from 'framer-motion';
import { StaggerList, StaggerItem } from '@/components/transitions/AnimatedLayout';
import { BatchImageSaveButton } from './BatchImageSaveButton';

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

  const { templates, isLoading: templatesLoading } = usePPTTemplates();
  
  const [showNewWorkstation, setShowNewWorkstation] = useState(false);

  const project = projects.find(p => p.id === selectedProjectId);
  if (!project) return null;

  // Calculate stats from real data
  const projectWorkstations = getProjectWorkstations(selectedProjectId!);
  const workstationCount = projectWorkstations.length;
  const moduleCount = projectWorkstations.reduce((acc, ws) => acc + getWorkstationModules(ws.id).length, 0);
  
  const layoutsComplete = projectWorkstations.filter(ws => {
    const layout = layouts.find(l => l.workstation_id === ws.id);
    return !!layout; // Layout exists
  }).length;

  // Count modules with saved schematic images
  const schematicsComplete = projectWorkstations.reduce((acc, ws) => {
    const wsModules = getWorkstationModules(ws.id);
    return acc + wsModules.filter(m => !!(m as any).schematic_image_url).length;
  }, 0);

  const canGenerate = workstationCount > 0 && layoutsComplete === workstationCount && schematicsComplete === moduleCount;
  const missingItems: string[] = [];
  if (workstationCount === 0) missingItems.push('至少添加一个工位');
  if (layoutsComplete < workstationCount) missingItems.push(`完成工位布局配置 (${layoutsComplete}/${workstationCount})`);
  if (schematicsComplete < moduleCount) missingItems.push(`完成视觉系统示意图 (${schematicsComplete}/${moduleCount})`);

  // Find selected template from database templates
  const selectedTemplate = templates.find(t => t.id === project.template_id);

  // Calculate overall progress
  const totalTasks = workstationCount + moduleCount;
  const completedTasks = layoutsComplete + schematicsComplete;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate missing images count for display
  const missingLayoutsCount = projectWorkstations.filter(ws => {
    const layout = layouts.find(l => l.workstation_id === ws.id);
    if (!layout) return false;
    return !layout.front_view_image_url || !layout.side_view_image_url || !layout.top_view_image_url;
  }).length;
  
  const missingSchematicsCount = projectWorkstations.reduce((acc, ws) => {
    const wsModules = getWorkstationModules(ws.id);
    return acc + wsModules.filter(m => !(m as any).schematic_image_url).length;
  }, 0);
  
  const totalMissingImages = missingLayoutsCount * 3 + missingSchematicsCount; // Approximate

  return (
    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with overall progress */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <p className="text-muted-foreground mt-1">项目概览驾驶舱</p>
          </div>
          
          {/* Overall Progress Ring */}
          <motion.div 
            className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <CircularProgress
              value={overallProgress}
              size="lg"
              color={overallProgress === 100 ? 'success' : 'primary'}
              animated
            />
            <div>
              <p className="text-sm font-medium text-foreground">整体进度</p>
              <p className="text-xs text-muted-foreground">
                {completedTasks}/{totalTasks} 任务完成
              </p>
              {overallProgress === 100 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1 mt-1 text-xs text-success"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>已就绪</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Project Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="elevated">
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
                  <p className="font-medium">
                    {selectedTemplate?.name || (project.template_id && templatesLoading ? '加载中...' : '未选择')}
                    {selectedTemplate?.is_default && <span className="text-xs text-muted-foreground ml-1">(默认)</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Cards with Circular Progress */}
        <StaggerList className="grid grid-cols-2 md:grid-cols-4 gap-4" staggerDelay={0.08}>
          <StaggerItem>
            <Card variant="interactive" className="group">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <CircularProgress
                      value={workstationCount}
                      max={Math.max(workstationCount, 1)}
                      size="md"
                      color="accent"
                      showValue={false}
                    >
                      <Cpu className="h-5 w-5 text-accent" />
                    </CircularProgress>
                  </div>
                  <div>
                    <motion.p 
                      className="text-2xl font-bold"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={workstationCount}
                    >
                      {workstationCount}
                    </motion.p>
                    <p className="text-xs text-muted-foreground">工位数量</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          
          <StaggerItem>
            <Card variant="interactive" className="group">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <CircularProgress
                      value={moduleCount}
                      max={Math.max(moduleCount, 1)}
                      size="md"
                      color="success"
                      showValue={false}
                    >
                      <Box className="h-5 w-5 text-success" />
                    </CircularProgress>
                  </div>
                  <div>
                    <motion.p 
                      className="text-2xl font-bold"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={moduleCount}
                    >
                      {moduleCount}
                    </motion.p>
                    <p className="text-xs text-muted-foreground">功能模块</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          
          <StaggerItem>
            <Card variant="interactive" className="group">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <CircularProgress
                    value={layoutsComplete}
                    max={Math.max(workstationCount, 1)}
                    size="md"
                    color={layoutsComplete === workstationCount && workstationCount > 0 ? 'success' : 'primary'}
                    valueFormat="fraction"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-primary" />
                      <p className="text-xs text-muted-foreground">布局图</p>
                    </div>
                    <p className="text-sm font-medium mt-1">
                      {layoutsComplete === workstationCount && workstationCount > 0 ? (
                        <span className="text-success flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          已完成
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          待完成 {workstationCount - layoutsComplete} 个
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          
          <StaggerItem>
            <Card variant="interactive" className="group">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <CircularProgress
                    value={schematicsComplete}
                    max={Math.max(moduleCount, 1)}
                    size="md"
                    color={schematicsComplete === moduleCount && moduleCount > 0 ? 'success' : 'warning'}
                    valueFormat="fraction"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-warning" />
                      <p className="text-xs text-muted-foreground">示意图</p>
                    </div>
                    <p className="text-sm font-medium mt-1">
                      {schematicsComplete === moduleCount && moduleCount > 0 ? (
                        <span className="text-success flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          已完成
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          待完成 {moduleCount - schematicsComplete} 个
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        </StaggerList>

        {/* Generation Readiness */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card 
            className={canGenerate 
              ? 'border-success bg-success/5' 
              : 'border-warning/50 bg-warning/5'
            }
            variant="glow"
          >
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {canGenerate ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </motion.div>
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
                    <motion.li 
                      key={i} 
                      className="flex items-center gap-2 text-sm"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        </motion.div>

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
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">PPT母版:</span>
                <Select 
                  value={project.template_id || ''} 
                  onValueChange={async (value) => {
                    await updateProject(project.id, { template_id: value });
                    toast.success('PPT母版已更新');
                  }}
                  disabled={templatesLoading}
                >
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder={templatesLoading ? '加载中...' : (templates.length === 0 ? '暂无模板' : '选择母版')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        暂无模板，请先在管理中心创建
                      </SelectItem>
                    ) : (
                      templates.map(tpl => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name} {tpl.is_default && '(默认)'}
                        </SelectItem>
                      ))
                    )}
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
            
            {/* Batch Save Button - New Component */}
            <div className="pt-2 border-t border-border">
              <div className="w-full">
                <BatchImageSaveButton projectId={selectedProjectId!} />
              </div>
              {totalMissingImages > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  提示: 点击按钮自动渲染并保存所有缺失的三视图和示意图
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
