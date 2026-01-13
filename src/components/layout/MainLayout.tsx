import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { TopToolbar } from './TopToolbar';
import { ProjectTree } from './ProjectTree';
import { CanvasArea } from './CanvasArea';
import { FormPanel } from './FormPanel';
import { AdminCenter } from './AdminCenter';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBreakpoint } from '@/hooks/use-mobile';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MobileFormDrawer, MobileFormTrigger } from '@/components/forms/MobileFormDrawer';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export function MainLayout() {
  const { currentRole } = useAppStore();
  const [showAdmin, setShowAdmin] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const breakpoint = useBreakpoint();
  
  // Mobile/Tablet drawer states
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  
  // Collapsed states for tablet
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const handleDragStart = useCallback(() => setIsDragging(true), []);
  const handleDragEnd = useCallback(() => setIsDragging(false), []);
  
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden relative">
        {/* Ambient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-12 w-36 h-36 bg-accent/4 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 h-full flex flex-col">
          <TopToolbar 
            onAdminClick={() => setShowAdmin(!showAdmin)} 
            showBackButton={showAdmin && currentRole === 'admin'}
            isMobile={true}
            onOpenLeftDrawer={() => setLeftDrawerOpen(true)}
            onOpenRightDrawer={() => setRightDrawerOpen(true)}
          />
          
          <AnimatePresence mode="wait">
            {showAdmin && currentRole === 'admin' ? (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="flex-1 overflow-hidden"
              >
                <AdminCenter />
              </motion.div>
            ) : (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-hidden"
              >
                <CanvasArea />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Mobile Bottom Navigation */}
          {!showAdmin && (
            <div className="h-16 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 shrink-0 safe-area-bottom">
              <Sheet open={leftDrawerOpen} onOpenChange={setLeftDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex-col gap-1 h-14 min-w-[64px]">
                    <Menu className="h-5 w-5" />
                    <span className="text-[10px]">项目</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
                  <ProjectTree />
                </SheetContent>
              </Sheet>
              
              {/* Center - Canvas indicator */}
              <div className="flex-1 flex items-center justify-center">
                <div className="px-4 py-2 rounded-full bg-secondary/50 text-xs text-muted-foreground">
                  画布区域
                </div>
              </div>
              
              {/* Right - Form drawer trigger */}
              <MobileFormTrigger onClick={() => setRightDrawerOpen(true)} />
            </div>
          )}
          
          {/* Mobile Form Drawer */}
          <MobileFormDrawer 
            open={rightDrawerOpen} 
            onOpenChange={setRightDrawerOpen} 
          />
        </div>
      </div>
    );
  }

  // Tablet Layout
  if (isTablet) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden relative">
        {/* Ambient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-16 w-48 h-48 bg-accent/4 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 w-56 h-56 bg-primary/3 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 h-full flex flex-col">
          <TopToolbar 
            onAdminClick={() => setShowAdmin(!showAdmin)} 
            showBackButton={showAdmin && currentRole === 'admin'}
          />
          
          <AnimatePresence mode="wait">
            {showAdmin && currentRole === 'admin' ? (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="flex-1 overflow-hidden"
              >
                <AdminCenter />
              </motion.div>
            ) : (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-hidden flex"
              >
                {/* Collapsible Left Panel */}
                <motion.aside 
                  initial={false}
                  animate={{ width: leftCollapsed ? 48 : 240 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="h-full bg-card/90 backdrop-blur-md flex flex-col overflow-hidden shadow-xl relative shrink-0"
                >
                  <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                  {leftCollapsed ? (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="m-2"
                      onClick={() => setLeftCollapsed(false)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 z-10 h-6 w-6"
                        onClick={() => setLeftCollapsed(true)}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <ProjectTree />
                    </>
                  )}
                </motion.aside>
                
                {/* Main Canvas */}
                <main className="flex-1 h-full flex flex-col overflow-hidden relative">
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-background/20 via-transparent to-background/20" />
                  <CanvasArea />
                </main>
                
                {/* Collapsible Right Panel */}
                <motion.aside 
                  initial={false}
                  animate={{ width: rightCollapsed ? 48 : 280 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="h-full bg-card/90 backdrop-blur-md flex flex-col overflow-hidden shadow-xl relative shrink-0"
                >
                  <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                  {rightCollapsed ? (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="m-2"
                      onClick={() => setRightCollapsed(false)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 left-2 z-10 h-6 w-6"
                        onClick={() => setRightCollapsed(true)}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                      <FormPanel />
                    </>
                  )}
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Desktop Layout (original)
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      {/* Ambient Background Effects - Static decorations only */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs - static, no animation for better performance */}
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 bg-accent/4 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-primary/3 rounded-full blur-3xl" />
        
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '64px 64px'
          }}
        />
      </div>
      
      {/* Content Layer */}
      <div className="relative z-10 h-full flex flex-col">
        <TopToolbar 
          onAdminClick={() => setShowAdmin(!showAdmin)} 
          showBackButton={showAdmin && currentRole === 'admin'}
        />
        
        <AnimatePresence mode="wait">
          {showAdmin && currentRole === 'admin' ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <AdminCenter />
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex-1 overflow-hidden"
            >
              <ResizablePanelGroup 
                direction="horizontal" 
                className="h-full"
              >
                {/* Left Panel - Project Tree */}
                <ResizablePanel 
                  defaultSize={18} 
                  minSize={12} 
                  maxSize={30}
                  className="relative"
                >
                  <motion.aside 
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                    className="h-full bg-card/90 backdrop-blur-md flex flex-col overflow-hidden shadow-xl relative"
                  >
                    <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                    <ProjectTree />
                  </motion.aside>
                </ResizablePanel>
                
                {/* Left Resize Handle */}
                <ResizableHandle 
                  className={cn(
                    "resizable-handle-styled",
                    isDragging && "resizable-handle-active"
                  )}
                  onDragging={handleDragStart}
                />
                
                {/* Middle Panel - Canvas */}
                <ResizablePanel 
                  defaultSize={54} 
                  minSize={30}
                  className="relative"
                >
                  <motion.main 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15, ease: 'easeOut' }}
                    className="h-full flex flex-col overflow-hidden relative"
                  >
                    {/* Subtle vignette effect */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-background/20 via-transparent to-background/20" />
                    <CanvasArea />
                  </motion.main>
                </ResizablePanel>
                
                {/* Right Resize Handle */}
                <ResizableHandle 
                  className={cn(
                    "resizable-handle-styled",
                    isDragging && "resizable-handle-active"
                  )}
                  onDragging={handleDragEnd}
                />
                
                {/* Right Panel - Forms */}
                <ResizablePanel 
                  defaultSize={28} 
                  minSize={18} 
                  maxSize={40}
                  className="relative"
                >
                  <motion.aside 
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                    className="h-full bg-card/90 backdrop-blur-md flex flex-col overflow-hidden shadow-xl relative"
                  >
                    <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                    <FormPanel />
                  </motion.aside>
                </ResizablePanel>
              </ResizablePanelGroup>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
