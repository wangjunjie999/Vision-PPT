import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from 'next-themes';
import { 
  FileText, 
  Plus, 
  Search, 
  Settings, 
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  User,
  Sun,
  Moon,
  Sparkles,
  Zap
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { PPTGenerationDialog } from '../dialogs/PPTGenerationDialog';
import { NewProjectDialog } from '../dialogs/NewProjectDialog';
import { checkPPTReadiness } from '@/services/pptReadiness';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TopToolbarProps {
  onAdminClick: () => void;
  showBackButton?: boolean;
}

export function TopToolbar({ onAdminClick, showBackButton }: TopToolbarProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currentRole, setCurrentRole, isGeneratingPPT } = useAppStore();
  const { selectedProjectId, projects, workstations, layouts, modules, getProjectWorkstations, selectProject } = useData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showPPTDialog, setShowPPTDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectWorkstations = selectedProjectId ? getProjectWorkstations(selectedProjectId) : [];
  
  // Check PPT generation readiness using pptReadiness service
  const readinessResult = useMemo(() => {
    return checkPPTReadiness({
      projects,
      workstations,
      layouts,
      modules,
      selectedProjectId,
    });
  }, [projects, workstations, layouts, modules, selectedProjectId]);
  
  const { draftReady, finalReady, missing } = readinessResult;
  
  // Format missing items for display
  const missingItemsText = useMemo(() => {
    if (missing.length === 0) return [];
    return missing.map(item => `${item.name}: ${item.missing.join('、')}`);
  }, [missing]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleAdminAccess = () => {
    if (currentRole === 'admin') {
      onAdminClick();
    } else {
      setShowAdminAuth(true);
    }
  };

  const handleAdminAuth = () => {
    if (adminPassword === 'admin123') {
      setCurrentRole('admin');
      setShowAdminAuth(false);
      setAdminPassword('');
      onAdminClick();
    }
  };

  return (
    <>
      <header className="h-16 border-b border-border/60 bg-card/95 backdrop-blur-md px-5 flex items-center justify-between gap-4 shrink-0 relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-accent/[0.02] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <div className="flex items-center gap-4 relative z-10">
          {showBackButton ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onAdminClick}
              className="gap-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              返回主界面
            </Button>
          ) : (
            <>
              {/* Logo Section - Clickable to go back to dashboard */}
              <button 
                onClick={() => {
                  selectProject(null);
                }}
                className="flex items-center gap-3 group cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg group-hover:shadow-primary/25 transition-all duration-300 group-active:scale-95">
                    <Zap className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-primary/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-foreground tracking-tight">视觉方案配置系统</span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Vision Solution Studio</span>
                </div>
              </button>
              
              <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent mx-2" />
              
              {/* New Project Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-dashed hover:border-primary hover:bg-primary/5 hover:text-primary transition-all duration-200 group"
                onClick={() => setShowNewProjectDialog(true)}
              >
                <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
                新建项目
              </Button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          {/* Search */}
          {!showBackButton && (
            <div className={cn(
              "relative transition-all duration-300",
              searchFocused ? "w-80" : "w-64"
            )}>
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200",
                searchFocused ? "text-primary" : "text-muted-foreground"
              )} />
              <Input
                placeholder="搜索项目、工位、模块..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={cn(
                  "pl-9 h-10 bg-secondary/50 border-secondary hover:border-primary/30 focus:border-primary transition-all duration-200",
                  searchFocused && "bg-card shadow-sm"
                )}
              />
              {searchFocused && (
                <div className="absolute inset-0 -z-10 rounded-md bg-primary/5 blur-sm" />
              )}
            </div>
          )}
          
          {/* Status indicator */}
          {!showBackButton && selectedProject && (
            <div className={cn(
              "flex items-center gap-2.5 px-4 py-2 rounded-lg border transition-all duration-200",
              finalReady 
                ? "bg-success/5 border-success/20" 
                : draftReady
                  ? "bg-warning/5 border-warning/20"
                  : "bg-secondary/50 border-border"
            )}>
              <span className="text-xs text-muted-foreground font-medium">当前项目</span>
              <div className="h-3 w-px bg-border" />
              <span className="text-sm font-semibold">{selectedProject.name}</span>
              {finalReady ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : draftReady ? (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-4 w-4 text-warning animate-pulse" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium mb-1">可生成草案版，但缺少交付项:</p>
                    <ul className="text-xs space-y-0.5">
                      {missingItemsText.slice(0, 3).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                      {missingItemsText.length > 3 && (
                        <li className="text-muted-foreground">...还有 {missingItemsText.length - 3} 项</li>
                      )}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium mb-1">无法生成PPT，缺少:</p>
                    <ul className="text-xs space-y-0.5">
                      {missingItemsText.slice(0, 3).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                      {missingItemsText.length > 3 && (
                        <li className="text-muted-foreground">...还有 {missingItemsText.length - 3} 项</li>
                      )}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
          
          {/* Generate PPT Button */}
          {!showBackButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => setShowPPTDialog(true)}
                  disabled={!draftReady || isGeneratingPPT}
                  className={cn(
                    "gap-2 relative overflow-hidden transition-all duration-300",
                    draftReady && !isGeneratingPPT && "ppt-button-animated",
                    isGeneratingPPT && "opacity-80"
                  )}
                >
                  {isGeneratingPPT ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      生成PPT
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              {!draftReady && (
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium mb-1">无法生成PPT，缺少:</p>
                  <ul className="text-xs space-y-0.5">
                    {missingItemsText.slice(0, 3).map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                    {missingItemsText.length > 3 && (
                      <li className="text-muted-foreground">...还有 {missingItemsText.length - 3} 项</li>
                    )}
                  </ul>
                </TooltipContent>
              )}
              {draftReady && !finalReady && (
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium mb-1">可生成草案版</p>
                  <p className="text-xs text-muted-foreground">交付版需要补齐缺失项，详见对话框</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}
          
          <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
          
          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleTheme}
                className="relative overflow-hidden hover:bg-primary/10 hover:text-primary transition-all duration-200"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
                <span className="sr-only">切换主题</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Admin Center */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleAdminAccess}
                className={cn(
                  "relative overflow-hidden transition-all duration-200",
                  currentRole === 'admin' 
                    ? "text-primary bg-primary/10" 
                    : "hover:bg-primary/10 hover:text-primary"
                )}
              >
                <Settings className={cn(
                  "h-5 w-5 transition-transform duration-500",
                  currentRole === 'admin' && "animate-spin"
                )} style={{ animationDuration: '3s' }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>管理中心</p>
            </TooltipContent>
          </Tooltip>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="relative overflow-hidden hover:bg-primary/10 hover:text-primary transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2.5 border-b border-border">
                <div className="text-xs text-muted-foreground mb-0.5">已登录账户</div>
                <div className="text-sm font-medium truncate">{user?.email}</div>
              </div>
              <DropdownMenuItem 
                onClick={signOut} 
                className="text-destructive focus:text-destructive focus:bg-destructive/10 m-1"
              >
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* PPT Generation Dialog */}
      <PPTGenerationDialog 
        open={showPPTDialog} 
        onOpenChange={setShowPPTDialog} 
      />

      {/* New Project Dialog */}
      <NewProjectDialog 
        open={showNewProjectDialog} 
        onOpenChange={setShowNewProjectDialog} 
      />

      {/* Admin Auth Dialog */}
      <Dialog open={showAdminAuth} onOpenChange={setShowAdminAuth}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              管理员认证
            </DialogTitle>
            <DialogDescription>
              请输入管理员口令以进入管理中心
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="请输入口令"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdminAuth()}
            className="mt-2"
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAdminAuth(false)}>
              取消
            </Button>
            <Button onClick={handleAdminAuth}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
