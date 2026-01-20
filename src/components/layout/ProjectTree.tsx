import { useData } from '@/contexts/DataContext';
import { 
  ChevronDown, 
  ChevronRight, 
  FolderOpen, 
  Cpu, 
  Box,
  Plus,
  Copy,
  Trash2,
  Edit3,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Loader2,
  Layers,
  Zap,
  Search,
  X
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { NewProjectDialog } from '../dialogs/NewProjectDialog';
import { NewWorkstationDialog } from '../dialogs/NewWorkstationDialog';
import { NewModuleDialog } from '../dialogs/NewModuleDialog';
import { toast } from 'sonner';

// Industrial-styled tree node component
interface TreeNodeProps {
  icon: React.ReactNode;
  code?: string;
  label: string;
  status: string;
  isSelected: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  depth: 0 | 1 | 2;
  onClick: () => void;
  onToggle?: () => void;
  onAction?: () => void;
  actionMenu?: React.ReactNode;
}

function TreeNode({ 
  icon, 
  code,
  label, 
  status, 
  isSelected, 
  isExpanded,
  hasChildren,
  depth,
  onClick,
  onToggle,
  actionMenu
}: TreeNodeProps) {
  const depthStyles = {
    0: 'pl-2',
    1: 'pl-4',
    2: 'pl-6',
  };

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 pr-2 py-2 cursor-pointer rounded transition-all duration-200',
        depthStyles[depth],
        // Base state
        'border-l-3 border-transparent',
        'hover:bg-secondary/60',
        // Selected state with industrial accent
        isSelected && [
          'bg-primary/8 border-l-primary',
          'shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]',
        ],
        // Click animation
        'active:animate-click-shake'
      )}
    >
      {/* Expand/Collapse Button */}
      {hasChildren !== undefined && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className={cn(
            'p-0.5 rounded transition-all duration-200',
            'hover:bg-secondary',
            'active:scale-90'
          )}
        >
          <div className={cn(
            'transition-transform duration-200',
            isExpanded && 'rotate-0',
            !isExpanded && '-rotate-90'
          )}>
            {hasChildren ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>
        </button>
      )}
      
      {/* Icon with glow effect when selected */}
      <div className={cn(
        'relative shrink-0 transition-all duration-200',
        isSelected && 'drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]'
      )}>
        {icon}
        {/* Pulse ring on selection */}
        {isSelected && (
          <div className="absolute inset-0 animate-ping opacity-30">
            {icon}
          </div>
        )}
      </div>
      
      {/* Label with code */}
      <div 
        className="flex-1 min-w-0 flex items-center gap-1.5"
        onClick={onClick}
      >
        {code && (
          <span className={cn(
            'text-xs font-mono shrink-0 transition-colors duration-200',
            isSelected ? 'text-primary/60' : 'text-muted-foreground'
          )}>
            {code}
          </span>
        )}
        <span 
          className={cn(
            'truncate text-sm font-medium transition-colors duration-200',
            isSelected ? 'text-primary' : 'text-foreground',
            'group-hover:text-primary/80'
          )}
        >
          {label}
        </span>
      </div>
      
      {/* Status Indicator */}
      <StatusBadge status={status} />
      
      {/* Action Menu */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {actionMenu}
      </div>
      
      {/* Selection indicator line animation */}
      {isSelected && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r"
          style={{
            animation: 'slideInFromLeft 0.2s ease-out'
          }}
        />
      )}
    </div>
  );
}

// Industrial status badge
function StatusBadge({ status }: { status: string }) {
  if (status === 'complete') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/10 border border-success/20">
        <CheckCircle2 className="h-3 w-3 text-success" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-success hidden sm:inline">
          完成
        </span>
      </div>
    );
  }
  if (status === 'incomplete') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20">
        <AlertCircle className="h-3 w-3 text-warning" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-warning hidden sm:inline">
          进行中
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border">
      <div className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/40" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline">
        草稿
      </span>
    </div>
  );
}

// Module type icon mapping
function getModuleIcon(type: string) {
  switch (type) {
    case 'positioning':
      return <Layers className="h-4 w-4 text-blue-500" />;
    case 'defect':
      return <Zap className="h-4 w-4 text-orange-500" />;
    case 'ocr':
      return <Box className="h-4 w-4 text-purple-500" />;
    case 'deeplearning':
      return <Cpu className="h-4 w-4 text-emerald-500" />;
    default:
      return <Box className="h-4 w-4 text-success" />;
  }
}

export function ProjectTree() {
  const {
    projects,
    workstations,
    modules,
    layouts,
    loading,
    selectedProjectId,
    selectedWorkstationId,
    selectedModuleId,
    selectProject,
    selectWorkstation,
    selectModule,
    deleteProject,
    deleteWorkstation,
    deleteModule,
    duplicateProject,
    duplicateWorkstation,
    duplicateModule,
    updateProject,
    updateWorkstation,
    updateModule,
    getProjectWorkstations,
    getWorkstationModules,
  } = useData();

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(projects.map(p => p.id)));
  const [expandedWorkstations, setExpandedWorkstations] = useState<Set<string>>(new Set());
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'project' | 'workstation' | 'module'>('all');
  
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewWorkstation, setShowNewWorkstation] = useState(false);
  const [showNewModule, setShowNewModule] = useState(false);
  const [contextProjectId, setContextProjectId] = useState<string | null>(null);
  const [contextWorkstationId, setContextWorkstationId] = useState<string | null>(null);
  
  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{ type: 'project' | 'workstation' | 'module'; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Filter results based on search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return { projects, matchedWorkstations: new Set<string>(), matchedModules: new Set<string>() };
    }
    
    const query = searchQuery.toLowerCase();
    const matchedProjects = new Set<string>();
    const matchedWorkstations = new Set<string>();
    const matchedModules = new Set<string>();
    
    // Search projects
    if (searchScope === 'all' || searchScope === 'project') {
      projects.forEach(p => {
        if (p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query)) {
          matchedProjects.add(p.id);
        }
      });
    }
    
    // Search workstations
    if (searchScope === 'all' || searchScope === 'workstation') {
      workstations.forEach(ws => {
        if (ws.name.toLowerCase().includes(query) || ws.code.toLowerCase().includes(query)) {
          matchedWorkstations.add(ws.id);
          matchedProjects.add(ws.project_id); // Also show parent project
        }
      });
    }
    
    // Search modules
    if (searchScope === 'all' || searchScope === 'module') {
      modules.forEach(m => {
        if (m.name.toLowerCase().includes(query)) {
          matchedModules.add(m.id);
          matchedWorkstations.add(m.workstation_id); // Also show parent workstation
          const ws = workstations.find(w => w.id === m.workstation_id);
          if (ws) matchedProjects.add(ws.project_id); // Also show parent project
        }
      });
    }
    
    const filteredProjects = projects.filter(p => matchedProjects.has(p.id));
    
    return { projects: filteredProjects, matchedWorkstations, matchedModules };
  }, [searchQuery, searchScope, projects, workstations, modules]);

  const handleRename = async () => {
    if (!renameDialog || !renameValue.trim()) return;
    try {
      if (renameDialog.type === 'project') {
        await updateProject(renameDialog.id, { name: renameValue.trim() });
      } else if (renameDialog.type === 'workstation') {
        await updateWorkstation(renameDialog.id, { name: renameValue.trim() });
      } else if (renameDialog.type === 'module') {
        await updateModule(renameDialog.id, { name: renameValue.trim() });
      }
      toast.success('重命名成功');
      setRenameDialog(null);
    } catch (error) {
      console.error('Rename failed:', error);
      toast.error('重命名失败');
    }
  };

  const openRenameDialog = (type: 'project' | 'workstation' | 'module', id: string, currentName: string) => {
    setRenameValue(currentName);
    setRenameDialog({ type, id, name: currentName });
  };

  const toggleProject = (id: string) => {
    const next = new Set(expandedProjects);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedProjects(next);
  };

  const toggleWorkstation = (id: string) => {
    const next = new Set(expandedWorkstations);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedWorkstations(next);
  };

  const getWorkstationStatus = (wsId: string) => {
    const layout = layouts.find(l => l.workstation_id === wsId);
    const wsModules = getWorkstationModules(wsId);
    
    if (!layout) return 'draft';
    // Workstation is complete when layout exists and all modules have schematics
    const allSchematicsSaved = wsModules.every(m => !!(m as any).schematic_image_url);
    if (wsModules.length > 0 && allSchematicsSaved) {
      return 'complete';
    }
    // If layout exists, it's in progress
    return 'incomplete';
  };

  const getModuleStatus = (modId: string) => {
    const mod = modules.find(m => m.id === modId);
    return mod?.status || 'draft';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="absolute inset-0 animate-ping opacity-20">
            <Loader2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <span className="text-sm text-muted-foreground font-medium">加载项目...</span>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="panel-header flex items-center justify-between bg-gradient-to-r from-panel-header to-card">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          <span className="font-heading font-semibold tracking-wide">项目列表</span>
          <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            {projects.length}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 hover:bg-primary/10 hover:text-primary active:animate-click-shake"
          onClick={() => setShowNewProject(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Search Bar */}
      <div className="px-2 py-2 border-b border-border/50 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索项目/工位/模块..."
            className="h-8 pl-8 pr-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-secondary rounded"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={searchScope} onValueChange={(v) => setSearchScope(v as typeof searchScope)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">全部</SelectItem>
            <SelectItem value="project" className="text-xs">仅项目</SelectItem>
            <SelectItem value="workstation" className="text-xs">仅工位</SelectItem>
            <SelectItem value="module" className="text-xs">仅模块</SelectItem>
          </SelectContent>
        </Select>
        {searchQuery && (
          <p className="text-[10px] text-muted-foreground">
            找到 {filteredData.projects.length} 个项目
            {filteredData.matchedWorkstations.size > 0 && `，${filteredData.matchedWorkstations.size} 个工位`}
            {filteredData.matchedModules.size > 0 && `，${filteredData.matchedModules.size} 个模块`}
          </p>
        )}
      </div>
      
      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {filteredData.projects.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="relative inline-block mb-4">
              <FolderOpen className="h-16 w-16 text-muted-foreground/30" />
              <div className="absolute inset-0 animate-pulse">
                <FolderOpen className="h-16 w-16 text-primary/20" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1 font-medium">
              {searchQuery ? '未找到匹配项' : '暂无项目'}
            </p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              {searchQuery ? '尝试其他搜索词' : '创建您的第一个视觉检测项目'}
            </p>
            {!searchQuery && (
              <Button 
                size="sm" 
                onClick={() => setShowNewProject(true)}
                className="gap-2 btn-industrial"
              >
                <Plus className="h-4 w-4" />
                新建项目
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredData.projects.map((project, index) => {
              const projectWorkstations = getProjectWorkstations(project.id);
              // Filter workstations if searching
              const displayWorkstations = searchQuery 
                ? projectWorkstations.filter(ws => 
                    filteredData.matchedWorkstations.has(ws.id) || 
                    getWorkstationModules(ws.id).some(m => filteredData.matchedModules.has(m.id))
                  )
                : projectWorkstations;
              const isExpanded = expandedProjects.has(project.id) || (searchQuery.length > 0);
              const isSelected = selectedProjectId === project.id && !selectedWorkstationId;
              
              return (
                <div 
                  key={project.id}
                  className="animate-slide-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Calculate project completion status */}
                  {(() => {
                    // Check all conditions for PPT generation readiness
                    const allWorkstations = getProjectWorkstations(project.id);
                    const allModules = allWorkstations.flatMap(ws => getWorkstationModules(ws.id));
                    
                    // Check if all workstations have layouts
                    const layoutsComplete = allWorkstations.every(ws => {
                      const layout = layouts.find(l => l.workstation_id === ws.id);
                      return !!layout;
                    });
                    
                    // Check if all modules have saved schematic images
                    const schematicsComplete = allModules.every(m => !!(m as any).schematic_image_url);
                    
                    // Determine computed status
                    let computedStatus = project.status;
                    if (allWorkstations.length > 0 && layoutsComplete && schematicsComplete && allModules.length > 0) {
                      computedStatus = 'complete';
                    } else if (allWorkstations.length > 0 || allModules.length > 0) {
                      computedStatus = 'incomplete';
                    }
                    
                    return (
                      <TreeNode
                        icon={<FolderOpen className={cn(
                          'h-4 w-4 transition-colors duration-200',
                          isSelected ? 'text-primary' : 'text-primary/70'
                        )} />}
                        code={project.code}
                        label={project.name}
                        status={computedStatus}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    hasChildren={displayWorkstations.length > 0}
                    depth={0}
                    onClick={() => {
                      selectProject(project.id);
                      if (!isExpanded) toggleProject(project.id);
                    }}
                    onToggle={() => toggleProject(project.id)}
                    actionMenu={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 hover:bg-secondary"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => {
                            setContextProjectId(project.id);
                            setShowNewWorkstation(true);
                          }}>
                            <Plus className="h-4 w-4 mr-2" />
                            新建工位
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openRenameDialog('project', project.id, project.name)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateProject(project.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            复制项目
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteProject(project.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                    );
                  })()}
                  
                  {/* Workstations - with connecting line */}
                  {isExpanded && (
                    <div className="relative ml-4 pl-2 border-l-2 border-border/50">
                      {displayWorkstations.map((ws, wsIndex) => {
                        const wsModules = getWorkstationModules(ws.id);
                        // Filter modules if searching
                        const displayModules = searchQuery 
                          ? wsModules.filter(m => filteredData.matchedModules.has(m.id))
                          : wsModules;
                        const wsExpanded = expandedWorkstations.has(ws.id) || (searchQuery.length > 0 && displayModules.length > 0);
                        const wsSelected = selectedWorkstationId === ws.id && !selectedModuleId;
                        const wsStatus = getWorkstationStatus(ws.id);
                        
                        // Generate workstation display code: project.code + "." + sequential index
                        const wsDisplayCode = `${project.code}.${String(wsIndex + 1).padStart(2, '0')}`;
                        
                        return (
                          <div 
                            key={ws.id}
                            className="animate-slide-in-up"
                            style={{ animationDelay: `${wsIndex * 30}ms` }}
                          >
                            {/* Workstation Node */}
                            <TreeNode
                              icon={<Cpu className={cn(
                                'h-4 w-4 transition-colors duration-200',
                                wsSelected ? 'text-accent' : 'text-accent/70'
                              )} />}
                              code={wsDisplayCode}
                              label={ws.name}
                              status={wsStatus}
                              isSelected={wsSelected}
                              isExpanded={wsExpanded}
                              hasChildren={wsModules.length > 0}
                              depth={1}
                              onClick={() => {
                                selectWorkstation(ws.id);
                                if (!wsExpanded && wsModules.length > 0) toggleWorkstation(ws.id);
                              }}
                              onToggle={() => toggleWorkstation(ws.id)}
                              actionMenu={
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 hover:bg-secondary"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => {
                                      setContextWorkstationId(ws.id);
                                      setShowNewModule(true);
                                    }}>
                                      <Plus className="h-4 w-4 mr-2" />
                                      新建模块
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openRenameDialog('workstation', ws.id, ws.name)}>
                                      <Edit3 className="h-4 w-4 mr-2" />
                                      重命名
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => duplicateWorkstation(ws.id)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      复制工位
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => deleteWorkstation(ws.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      删除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              }
                            />
                            
                            {/* Modules */}
                            {wsExpanded && displayModules.length > 0 && (
                              <div className="relative ml-4 pl-2 border-l-2 border-border/30">
                                {displayModules.map((mod, modIndex) => {
                                  const modSelected = selectedModuleId === mod.id;
                                  const modStatus = getModuleStatus(mod.id);
                                  
                                  return (
                                    <div
                                      key={mod.id}
                                      className="animate-slide-in-up"
                                      style={{ animationDelay: `${modIndex * 20}ms` }}
                                    >
                                      <TreeNode
                                        icon={getModuleIcon(mod.type)}
                                        label={mod.name}
                                        status={modStatus}
                                        isSelected={modSelected}
                                        depth={2}
                                        onClick={() => selectModule(mod.id)}
                                        actionMenu={
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 hover:bg-secondary"
                                              >
                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                              <DropdownMenuItem onClick={() => openRenameDialog('module', mod.id, mod.name)}>
                                                <Edit3 className="h-4 w-4 mr-2" />
                                                重命名
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => duplicateModule(mod.id)}>
                                                <Copy className="h-4 w-4 mr-2" />
                                                复制模块
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem 
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => deleteModule(mod.id)}
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                删除
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        }
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Add workstation button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'w-full justify-start mt-1 text-muted-foreground',
                          'hover:text-primary hover:bg-primary/5',
                          'gap-2 h-8 text-xs font-medium',
                          'border border-dashed border-border/50 hover:border-primary/30',
                          'active:animate-click-shake'
                        )}
                        onClick={() => {
                          setContextProjectId(project.id);
                          setShowNewWorkstation(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        添加工位
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-3 py-2 border-t border-border bg-panel-header/50 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>工位: {workstations.length}</span>
          <span>模块: {modules.length}</span>
        </div>
      </div>

      {/* Dialogs */}
      <NewProjectDialog 
        open={showNewProject} 
        onOpenChange={setShowNewProject} 
      />
      <NewWorkstationDialog 
        open={showNewWorkstation} 
        onOpenChange={setShowNewWorkstation}
        projectId={contextProjectId}
      />
      <NewModuleDialog 
        open={showNewModule} 
        onOpenChange={setShowNewModule}
        workstationId={contextWorkstationId}
      />

      {/* Rename Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(open) => !open && setRenameDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              重命名{renameDialog?.type === 'project' ? '项目' : renameDialog?.type === 'workstation' ? '工位' : '模块'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="请输入新名称"
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>取消</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add keyframe animation */}
      <style>{`
        @keyframes slideInFromLeft {
          from {
            transform: scaleX(0);
            transform-origin: left;
          }
          to {
            transform: scaleX(1);
            transform-origin: left;
          }
        }
      `}</style>
    </>
  );
}
