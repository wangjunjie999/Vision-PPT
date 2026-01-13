import { Button } from '@/components/ui/button';
import { Plus, FolderOpen, Sparkles, Zap, Layers } from 'lucide-react';
import { useState } from 'react';
import { NewProjectDialog } from '@/components/dialogs/NewProjectDialog';

export function EmptyState() {
  const [showNewProject, setShowNewProject] = useState(false);

  return (
    <>
      <div className="flex-1 flex items-center justify-center p-8 relative texture-dots">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none texture-gradient-mesh-animated">
          <div className="glow-orb glow-orb-primary w-64 h-64 top-1/4 left-1/4" />
          <div className="glow-orb glow-orb-accent w-48 h-48 bottom-1/4 right-1/4" style={{ animationDelay: '-3s' }} />
          <div className="glow-orb glow-orb-primary w-32 h-32 top-1/2 right-1/3" style={{ animationDelay: '-5s' }} />
        </div>
        
        <div className="text-center max-w-lg relative z-10">
          {/* Animated icon container */}
          <div className="relative mx-auto mb-8 w-28 h-28">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-3xl border-2 border-dashed border-primary/20 animate-spin" style={{ animationDuration: '20s' }} />
            
            {/* Inner glow */}
            <div className="absolute inset-2 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 blur-lg" />
            
            {/* Icon container */}
            <div className="absolute inset-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/25">
              <FolderOpen className="h-12 w-12 text-primary-foreground animate-float" />
            </div>
            
            {/* Floating decorations */}
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-lg bg-accent flex items-center justify-center shadow-lg animate-float" style={{ animationDelay: '0.5s' }}>
              <Sparkles className="h-3 w-3 text-accent-foreground" />
            </div>
            <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-lg bg-warning flex items-center justify-center shadow-lg animate-float" style={{ animationDelay: '1s' }}>
              <Zap className="h-3 w-3 text-warning-foreground" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
            欢迎使用视觉方案配置系统
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            在左侧创建或选择一个项目，开始配置工位机械布局和功能模块视觉方案
          </p>
          
          {/* Feature highlights */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[
              { icon: Layers, label: '多工位配置' },
              { icon: Zap, label: '智能模块' },
              { icon: Sparkles, label: 'PPT生成' },
            ].map((feature, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm"
              >
                <feature.icon className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{feature.label}</span>
              </div>
            ))}
          </div>
          
          <Button 
            size="lg" 
            onClick={() => setShowNewProject(true)}
            className="gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
          >
            <Plus className="h-5 w-5" />
            新建项目
          </Button>
        </div>
      </div>
      <NewProjectDialog open={showNewProject} onOpenChange={setShowNewProject} />
    </>
  );
}
