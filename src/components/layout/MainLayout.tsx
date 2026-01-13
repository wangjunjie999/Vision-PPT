import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { TopToolbar } from './TopToolbar';
import { ProjectTree } from './ProjectTree';
import { CanvasArea } from './CanvasArea';
import { FormPanel } from './FormPanel';
import { AdminCenter } from './AdminCenter';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export function MainLayout() {
  const { currentRole } = useAppStore();
  const [showAdmin, setShowAdmin] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => setIsDragging(true), []);
  const handleDragEnd = useCallback(() => setIsDragging(false), []);

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
