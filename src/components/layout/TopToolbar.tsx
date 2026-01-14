import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from 'next-themes';
import { useAdminRole } from '@/hooks/useAdminRole';
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
  Zap,
  ShieldAlert
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { PPTGenerationDialog } from '../dialogs/PPTGenerationDialog';
import { NewProjectDialog } from '../dialogs/NewProjectDialog';
import { checkPPTReadiness } from '@/services/pptReadiness';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  isMobile?: boolean;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}

export function TopToolbar({ onAdminClick, showBackButton, isMobile, onOpenLeftDrawer, onOpenRightDrawer }: TopToolbarProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currentRole, setCurrentRole, isGeneratingPPT } = useAppStore();
  const { selectedProjectId, projects, workstations, layouts, modules, getProjectWorkstations, selectProject } = useData();
  const { isAdmin, isLoading: isCheckingAdmin, checkAdminRole } = useAdminRole();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showPPTDialog, setShowPPTDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
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

  const handleAdminAccess = async () => {
    if (currentRole === 'admin') {
      onAdminClick();
      return;
    }

    // Check admin role from database
    const hasAdminRole = await checkAdminRole();
    
    if (hasAdminRole) {
      setCurrentRole('admin');
      onAdminClick();
    } else {
      toast.error('需要管理员权限', {
        description: '您的账户没有管理员权限，请联系系统管理员',
        icon: <ShieldAlert className="h-4 w-4" />,
      });
    }
  };

  return (
    <>
      <header className={cn(
        "border-b border-border/60 bg-card/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 relative overflow-hidden",
        isMobile ? "h-14 px-3" : "h-16 px-5 gap-4"
      )}>
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-accent/[0.02] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <div className="flex items-center gap-2 md:gap-4 relative z-10">
          {showBackButton ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onAdminClick}
              className="gap-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">返回主界面</span>
            </Button>
          ) : (
            <>
              {/* Logo Section - Clickable to go back to dashboard */}
              <button 
                onClick={() => {
                  selectProject(null);
                }}
                className="flex items-center gap-2 md:gap-3 group cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="relative">
                  <div className={cn(
                    "rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg group-hover:shadow-primary/25 transition-all duration-300 group-active:scale-95",
                    isMobile ? "w-8 h-8" : "w-10 h-10"
                  )}>
                    <Zap className={cn("text-primary-foreground", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-primary/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="flex-col text-left hidden sm:flex">
                  <span className={cn("font-bold text-foreground tracking-tight", isMobile ? "text-sm" : "text-base")}>
                    视觉方案配置系统
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest hidden md:block">
                    Vision Solution Studio
                  </span>
                </div>
              </button>
              
              {/* Divider - hidden on mobile */}
              <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent mx-2 hidden md:block" />
              
              {/* New Project Button - icon only on mobile */}
              <Button 
                variant="outline" 
                size={isMobile ? "icon" : "sm"}
                className={cn(
                  "border-dashed hover:border-primary hover:bg-primary/5 hover:text-primary transition-all duration-200 group",
                  !isMobile && "gap-2"
                )}
                onClick={() => setShowNewProjectDialog(true)}
              >
                <Plus className={cn("group-hover:rotate-90 transition-transform duration-200", isMobile ? "h-4 w-4" : "h-4 w-4")} />
                {!isMobile && <span className="hidden sm:inline">新建项目</span>}
              </Button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 relative z-10">
          {/* Search - Hidden on mobile, compact on tablet */}
          {!showBackButton && !isMobile && (
            <div className={cn(
              "relative transition-all duration-300 hidden sm:block",
              searchFocused ? "w-64 lg:w-80" : "w-48 lg:w-64"
            )}>
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200",
                searchFocused ? "text-primary" : "text-muted-foreground"
              )} />
              <Input
                placeholder="搜索项目..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={cn(
                  "pl-9 h-9 bg-secondary/50 border-secondary hover:border-primary/30 focus:border-primary transition-all duration-200",
                  searchFocused && "bg-card shadow-sm"
                )}
              />
              {searchFocused && (
                <div className="absolute inset-0 -z-10 rounded-md bg-primary/5 blur-sm" />
              )}
            </div>
          )}
          
          {/* Status indicator - Hidden on mobile, compact on tablet */}
          {!showBackButton && selectedProject && !isMobile && (
            <div className={cn(
              "items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 hidden md:flex",
              finalReady 
                ? "bg-success/5 border-success/20" 
                : draftReady
                  ? "bg-warning/5 border-warning/20"
                  : "bg-secondary/50 border-border"
            )}>
              <span className="text-xs text-muted-foreground font-medium hidden lg:inline">当前项目</span>
              <div className="h-3 w-px bg-border hidden lg:block" />
              <span className="text-sm font-semibold truncate max-w-[120px] lg:max-w-none">{selectedProject.name}</span>
              {finalReady ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : draftReady ? (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-4 w-4 text-warning animate-pulse shrink-0" />
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
                    <AlertCircle className="h-4 w-4 text-destructive animate-pulse shrink-0" />
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
          
          {/* Generate PPT Button - Icon only on mobile */}
          {!showBackButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => setShowPPTDialog(true)}
                  disabled={!draftReady || isGeneratingPPT}
                  size={isMobile ? "icon" : "default"}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300",
                    !isMobile && "gap-2",
                    draftReady && !isGeneratingPPT && "ppt-button-animated",
                    isGeneratingPPT && "opacity-80"
                  )}
                >
                  {isGeneratingPPT ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {!isMobile && <span>生成中...</span>}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {!isMobile && <span>生成PPT</span>}
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
          
          <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent hidden sm:block" />
          
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
          
          {/* Admin Center - Hidden on mobile */}
          {!isMobile && (
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
          )}
          
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
    </>
  );
}
