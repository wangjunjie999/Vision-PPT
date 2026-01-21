import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus, Layers, Box, FileText, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGuide } from '@/contexts/GuideContext';

const features = [
  {
    icon: FolderPlus,
    title: '创建项目',
    description: '建立检测项目，配置基本信息',
    color: 'text-guide-primary',
    bgColor: 'bg-guide-primary/10',
  },
  {
    icon: Layers,
    title: '配置工位',
    description: '添加检测工位，设置机械布局',
    color: 'text-guide-accent',
    bgColor: 'bg-guide-accent/10',
  },
  {
    icon: Box,
    title: '添加模块',
    description: '配置功能模块，选择硬件方案',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: FileText,
    title: '生成报告',
    description: '一键导出专业的技术方案PPT',
    color: 'text-guide-success',
    bgColor: 'bg-guide-success/10',
  },
];

export function WelcomeGuide() {
  const { showWelcome, completeStep, dismissGuide } = useGuide();

  if (!showWelcome) return null;

  const handleStart = () => {
    completeStep('welcome');
  };

  const handleSkip = () => {
    dismissGuide();
  };

  return (
    <AnimatePresence>
      {showWelcome && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
          >
            {/* Gradient header */}
            <div className="relative h-32 bg-gradient-to-br from-guide-primary via-guide-primary/80 to-guide-accent overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute inset-0">
                <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <div className="absolute bottom-0 left-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
              </div>
              
              {/* Close button */}
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title */}
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-white/80" />
                  <span className="text-white/80 text-sm font-medium">欢迎使用</span>
                </div>
                <h2 className="text-2xl font-bold text-white">视觉方案配置系统</h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-muted-foreground text-sm mb-6">
                跟随引导，快速上手系统核心功能，轻松完成视觉检测方案配置
              </p>

              {/* Feature grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50 border border-border"
                  >
                    <div className={`p-2 rounded-lg ${feature.bgColor}`}>
                      <feature.icon className={`w-4 h-4 ${feature.color}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-foreground">{feature.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSkip}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  跳过引导
                </button>
                <Button 
                  onClick={handleStart}
                  className="gap-2 bg-guide-primary hover:bg-guide-primary/90"
                >
                  开始使用
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
