import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bot, Send, Trash2, X, Loader2, Database, Settings, Check, Plus, History, ChevronLeft, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useChatHistory } from '@/hooks/useChatHistory';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/integrations/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string; provider?: string; isAction?: boolean };

interface CustomAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`;

const DEFAULT_CONFIG: CustomAIConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o',
};

function loadCustomConfig(): CustomAIConfig {
  try {
    const saved = localStorage.getItem('ai-custom-config');
    if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveCustomConfig(config: CustomAIConfig) {
  localStorage.setItem('ai-custom-config', JSON.stringify(config));
}

async function streamChat({
  messages,
  context,
  customConfig,
  onDelta,
  onDone,
  onProvider,
  signal,
}: {
  messages: Message[];
  context?: string;
  customConfig?: CustomAIConfig;
  onDelta: (text: string) => void;
  onDone: () => void;
  onProvider?: (provider: string) => void;
  signal?: AbortSignal;
}) {
  const body: any = { messages, context };
  if (customConfig?.apiKey) {
    body.customApiKey = customConfig.apiKey;
    body.customBaseUrl = customConfig.baseUrl;
    body.customModel = customConfig.model;
  }

  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Error ${resp.status}`);
  }

  const provider = resp.headers.get('X-AI-Provider');
  if (provider && onProvider) onProvider(provider);

  if (!resp.body) throw new Error('No response body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { done = true; break; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

function formatJsonConfig(label: string, config: any): string {
  if (!config || typeof config !== 'object') return '';
  const entries = Object.entries(config).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `      ${label}: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}`;
}

function buildProjectContext(data: ReturnType<typeof useData>): string {
  const { selectedProjectId, projects, workstations, modules, layouts, getProjectWorkstations, getWorkstationModules } = data;

  const parts: string[] = [];

  const project = projects.find(p => p.id === selectedProjectId);
  if (project) {
    parts.push(`【当前项目】${project.name}（编号: ${project.code || '无'}）`);
    if (project.customer) parts.push(`客户: ${project.customer}`);
    if (project.product_process) parts.push(`工艺: ${project.product_process}`);
    if (project.cycle_time_target) parts.push(`整线目标节拍: ${project.cycle_time_target}s/pcs`);
    if (project.main_camera_brand) parts.push(`主相机品牌: ${project.main_camera_brand}`);
    if (project.environment) parts.push(`环境: ${project.environment}`);
    if (project.quality_strategy) parts.push(`质量策略: ${project.quality_strategy}`);
    if (project.production_line) parts.push(`产线: ${project.production_line}`);
    if (project.responsible) parts.push(`负责人: ${project.responsible}`);
    if (project.vision_responsible) parts.push(`视觉负责人: ${project.vision_responsible}`);
    if (project.sales_responsible) parts.push(`销售负责人: ${project.sales_responsible}`);
    if (project.notes) parts.push(`备注: ${project.notes}`);
    if (project.status) parts.push(`状态: ${project.status}`);

    const pws = getProjectWorkstations(project.id);
    parts.push(`工位数量: ${pws.length}`);

    pws.forEach((ws, wi) => {
      parts.push(`\n  工位${wi + 1}: ${ws.name}（编号: ${ws.code || '无'}, 类型: ${ws.type || '未知'}）`);
      if (ws.observation_target) parts.push(`    观测目标: ${ws.observation_target}`);
      if (ws.cycle_time) parts.push(`    工位节拍: ${ws.cycle_time}s/pcs`);
      if (ws.process_stage) parts.push(`    工序: ${ws.process_stage}`);
      if (ws.motion_description) parts.push(`    运动描述: ${ws.motion_description}`);
      if (ws.risk_notes) parts.push(`    风险提示: ${ws.risk_notes}`);
      if (ws.action_script) parts.push(`    动作脚本: ${ws.action_script}`);
      if (ws.enclosed) parts.push(`    封闭环境: 是`);
      if (ws.shot_count) parts.push(`    拍照次数: ${ws.shot_count}`);
      if (ws.status) parts.push(`    状态: ${ws.status}`);
      const dims = ws.product_dimensions as any;
      if (dims && (dims.length || dims.width || dims.height)) {
        parts.push(`    产品尺寸: ${dims.length || '?'}×${dims.width || '?'}×${dims.height || '?'} mm`);
      }
      const installSpace = ws.install_space as any;
      if (installSpace && (installSpace.length || installSpace.width || installSpace.height)) {
        parts.push(`    安装空间: ${installSpace.length || '?'}×${installSpace.width || '?'}×${installSpace.height || '?'} mm`);
      }
      const acceptance = ws.acceptance_criteria as any;
      if (acceptance) {
        const accStr = typeof acceptance === 'object' ? JSON.stringify(acceptance) : String(acceptance);
        if (accStr !== '{}' && accStr !== 'null') parts.push(`    验收标准: ${accStr}`);
      }

      const layout = layouts.find(l => l.workstation_id === ws.id);
      if (layout) {
        if (layout.width || layout.height || layout.depth) {
          parts.push(`    布局尺寸: ${layout.width || '?'}×${layout.height || '?'}×${layout.depth || '?'} mm`);
        }
        if (layout.conveyor_type) parts.push(`    传送类型: ${layout.conveyor_type}`);
        if (layout.camera_count) parts.push(`    相机数量: ${layout.camera_count}`);
      }

      const wsMods = getWorkstationModules(ws.id);
      wsMods.forEach((mod, mi) => {
        parts.push(`    模块${mi + 1}: ${mod.name}（类型: ${mod.type || '未知'}, 状态: ${mod.status || '未知'}）`);
        if (mod.description) parts.push(`      描述: ${mod.description}`);
        if (mod.selected_camera) parts.push(`      相机: ${mod.selected_camera}`);
        if (mod.selected_lens) parts.push(`      镜头: ${mod.selected_lens}`);
        if (mod.selected_light) parts.push(`      光源: ${mod.selected_light}`);
        if (mod.selected_controller) parts.push(`      控制器: ${mod.selected_controller}`);
        if (mod.trigger_type) parts.push(`      触发方式: ${mod.trigger_type}`);
        if (mod.roi_strategy) parts.push(`      ROI策略: ${mod.roi_strategy}`);
        if (mod.processing_time_limit) parts.push(`      处理时限: ${mod.processing_time_limit}ms`);
        if (mod.output_types?.length) parts.push(`      输出类型: ${mod.output_types.join(', ')}`);
        const defectLine = formatJsonConfig('缺陷检测配置', mod.defect_config);
        if (defectLine) parts.push(defectLine);
        const measureLine = formatJsonConfig('测量配置', mod.measurement_config);
        if (measureLine) parts.push(measureLine);
        const ocrLine = formatJsonConfig('OCR配置', mod.ocr_config);
        if (ocrLine) parts.push(ocrLine);
        const dlLine = formatJsonConfig('深度学习配置', mod.deep_learning_config);
        if (dlLine) parts.push(dlLine);
        const posLine = formatJsonConfig('定位配置', mod.positioning_config);
        if (posLine) parts.push(posLine);
      });
    });
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

export function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [customConfig, setCustomConfig] = useState<CustomAIConfig>(loadCustomConfig);
  const [currentProvider, setCurrentProvider] = useState<string>('default');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const chatHistory = useChatHistory();
  const { messages, setMessages, activeConversationId, conversations, loadingHistory } = chatHistory;

  // Draggable state
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('ai-btn-pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false });

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragRef.current = { startX: clientX, startY: clientY, startPosX: pos.x, startPosY: pos.y, moved: false };
    setIsDragging(true);
  }, [pos]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    const newX = Math.max(0, Math.min(window.innerWidth - 56, dragRef.current.startPosX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 56, dragRef.current.startPosY + dy));
    setPos({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    localStorage.setItem('ai-btn-pos', JSON.stringify(pos));
    if (!dragRef.current.moved) {
      setOpen(true);
    }
  }, [isDragging, pos]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onUp = () => handleDragEnd();
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleDragMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchEnd = () => handleDragEnd();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const dataCtx = useData();
  const { setPendingAIFill } = useAppStore();
  const projectContext = useMemo(() => buildProjectContext(dataCtx), [
    dataCtx.selectedProjectId, dataCtx.projects, dataCtx.workstations, dataCtx.modules, dataCtx.layouts,
  ]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSaveConfig = () => {
    saveCustomConfig(customConfig);
    toast.success('API 配置已保存');
    setShowSettings(false);
  };

  // Detect if message looks like a form fill command
  const isFormFillIntent = useCallback((text: string): boolean => {
    const keywords = ['填写', '完成', '补充', '填好', '填入', '写好', '帮我填', '自动填', '环境说明', '风险说明', '备注'];
    const targetKeywords = ['项目', '工位', '模块', '工站'];
    const hasKeyword = keywords.some(k => text.includes(k));
    const hasTarget = targetKeywords.some(k => text.includes(k));
    return hasKeyword && hasTarget;
  }, []);

  const handleFormCommand = useCallback(async (text: string): Promise<boolean> => {
    try {
      // Prepare minimal project data for the AI to match
      const projectsData = dataCtx.projects.map(p => ({ id: p.id, code: p.code, name: p.name, customer: p.customer }));
      const workstationsData = dataCtx.workstations.map(w => ({ id: w.id, code: w.code, name: w.name, project_id: w.project_id }));
      const modulesData = dataCtx.modules.map(m => ({ id: m.id, name: m.name, workstation_id: m.workstation_id, type: m.type }));

      // Show action message
      setMessages(prev => [...prev, { role: 'assistant', content: '🔍 正在分析指令，定位目标...' }]);

      const { data, error } = await supabase.functions.invoke('ai-form-command', {
        body: { userMessage: text, projectsData, workstationsData, modulesData },
      });

      if (error || data?.error) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: `❌ ${data?.error || '指令解析失败，请重试'}` };
          return copy;
        });
        return true;
      }

      const { targetType, targetId, fields, explanation, targetLabel } = data;

      if (!targetId || !fields || Object.keys(fields).length === 0) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: '❌ 未能匹配到目标或生成内容，请提供更多细节' };
          return copy;
        });
        return true;
      }

      // Navigate to target
      const label = targetLabel || targetId;
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `📍 已定位到 **${label}**\n\n${explanation || ''}\n\n⏳ 正在自动填写中...` };
        return copy;
      });

      // Auto-navigate
      if (targetType === 'project') {
        dataCtx.selectProject(targetId);
      } else if (targetType === 'workstation') {
        dataCtx.selectWorkstation(targetId);
      } else if (targetType === 'module') {
        dataCtx.selectModule(targetId);
      }

      // Wait for form to render, then trigger fill
      setTimeout(() => {
        setPendingAIFill({ targetType, targetId, fields });
      }, 500);

      // Update message after a delay
      setTimeout(() => {
        setMessages(prev => {
          const copy = [...prev];
          let lastAssistant = -1;
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'assistant') { lastAssistant = i; break; }
          }
          if (lastAssistant >= 0) {
            copy[lastAssistant] = {
              role: 'assistant',
              content: `✅ 已定位到 **${label}** 并开始填写\n\n${explanation || ''}\n\n填写字段：${Object.keys(fields).join('、')}`,
            };
          }
          return copy;
        });
      }, 2000);

      return true;
    } catch (err) {
      console.error('Form command error:', err);
      return false;
    }
  }, [dataCtx, setPendingAIFill, setMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Check if this is a form fill command
    if (isFormFillIntent(text)) {
      const handled = await handleFormCommand(text);
      if (handled) {
        // Save to history
        let convId = activeConversationId;
        if (!convId) convId = await chatHistory.createConversation(text);
        if (convId) chatHistory.saveMessage(convId, userMsg);
        setIsLoading(false);
        return;
      }
    }

    // Ensure conversation exists
    let convId = activeConversationId;
    if (!convId) {
      convId = await chatHistory.createConversation(text);
    }

    // Save user message to DB
    if (convId) {
      chatHistory.saveMessage(convId, userMsg);
    }

    let assistantSoFar = '';
    let assistantProvider = 'default';
    const controller = new AbortController();
    abortRef.current = controller;

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      const current = assistantSoFar;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: current } : m);
        }
        return [...prev, { role: 'assistant', content: current }];
      });
    };

    try {
      const chatMessages = [...messages, userMsg];
      const contextPayload = contextEnabled && projectContext ? projectContext : undefined;

      await streamChat({
        messages: chatMessages,
        context: contextPayload,
        customConfig: customConfig.apiKey ? customConfig : undefined,
        onDelta: upsert,
        onDone: () => {
          setIsLoading(false);
          // Save assistant message to DB
          if (convId && assistantSoFar) {
            chatHistory.saveMessage(convId, { role: 'assistant', content: assistantSoFar, provider: assistantProvider });
          }
        },
        onProvider: (p) => { setCurrentProvider(p); assistantProvider = p; },
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error(e.message || 'AI 请求失败');
      }
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (abortRef.current) abortRef.current.abort();
    chatHistory.startNewChat();
    setIsLoading(false);
  };

  const handleNewChat = () => {
    handleClear();
    setShowHistory(false);
  };

  const handleSelectConversation = async (id: string) => {
    await chatHistory.loadMessages(id);
    setShowHistory(false);
  };

  return (
    <>
      {/* Floating draggable trigger button */}
      {!open && (
        <div
          style={{ left: pos.x, top: pos.y }}
          className="fixed z-50 select-none"
          onMouseDown={e => { e.preventDefault(); handleDragStart(e.clientX, e.clientY); }}
          onTouchStart={e => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        >
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 animate-pulse-glow" />
          <Button
            size="icon-lg"
            className={cn(
              'relative rounded-full shadow-lg shadow-primary/40',
              'bg-gradient-to-br from-primary via-primary/80 to-accent text-primary-foreground',
              'hover:scale-110 hover:rotate-6 hover:shadow-xl hover:shadow-primary/50',
              'transition-all duration-300 cursor-grab active:cursor-grabbing',
              isDragging && 'scale-95 opacity-80 rotate-0'
            )}
          >
            <Bot className="h-6 w-6 animate-float" />
          </Button>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0 flex flex-col gap-0 shadow-2xl bg-background/60 backdrop-blur-xl border-border/50 [&>button]:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm">AI 视觉方案助手</span>
              <Badge
                variant={currentProvider === 'custom' ? 'warning' : 'glow'}
                className="text-[10px] px-1.5 py-0"
              >
                {currentProvider === 'custom' ? '自定义API' : '接口1'}
              </Badge>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setShowHistory(prev => !prev); setShowSettings(false); }}
                title="对话历史"
                className={cn(
                  "rounded-lg h-8 w-8 transition-all",
                  showHistory
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleNewChat}
                title="新对话"
                className="rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setShowSettings(prev => !prev); setShowHistory(false); }}
                title="API 设置"
                className={cn(
                  "rounded-lg h-8 w-8 transition-all",
                  showSettings
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setContextEnabled(prev => !prev)}
                title={contextEnabled && projectContext ? "已启用项目上下文" : "点击启用项目上下文"}
                className={cn(
                  "rounded-lg h-8 w-8 transition-all",
                  contextEnabled && projectContext
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Database className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClear}
                title="清空对话"
                className="rounded-lg h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                className="rounded-lg h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* History panel */}
          {showHistory && (
            <div className="border-b border-border/40 bg-muted/20 backdrop-blur-md shrink-0 max-h-[300px] overflow-auto">
              <div className="px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">对话历史</p>
                {conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 py-4 text-center">暂无对话记录</p>
                ) : (
                  <div className="space-y-1">
                    {conversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-all",
                          conv.id === activeConversationId
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-accent/50 text-foreground"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{conv.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(conv.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); chatHistory.deleteConversation(conv.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings panel */}
          {showSettings && (
            <div className="px-4 py-3 border-b border-border/40 bg-muted/20 backdrop-blur-md space-y-2.5 shrink-0">
              <p className="text-xs font-medium text-muted-foreground">自定义 API 配置（当接口1额度不足时自动切换）</p>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="API Key"
                  value={customConfig.apiKey}
                  onChange={e => setCustomConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="API Base URL（默认 https://api.openai.com）"
                  value={customConfig.baseUrl}
                  onChange={e => setCustomConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="模型名称（默认 gpt-4o）"
                  value={customConfig.model}
                  onChange={e => setCustomConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <Button size="sm" onClick={handleSaveConfig} className="w-full h-7 text-xs gap-1">
                <Check className="h-3 w-3" />
                保存配置
              </Button>
            </div>
          )}

          {/* Context indicator */}
          {contextEnabled && projectContext && (
            <div className="px-4 py-1.5 bg-primary/5 border-b border-border/40 text-xs text-muted-foreground flex items-center gap-1.5 shrink-0 backdrop-blur-md">
              <Database className="h-3 w-3 text-primary" />
              <span>已加载当前项目配置信息，AI 将基于实际数据回答</span>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div ref={scrollRef} className="p-4 space-y-4 min-h-full">
              {loadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-12 space-y-3">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p>你好！我是 AI 视觉方案助手。</p>
                  <p className="text-xs">可以问我关于相机选型、镜头计算、光源设计、检测算法等问题。</p>
                </div>
              ) : null}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm backdrop-blur-md',
                      msg.role === 'user'
                      ? 'bg-primary/40 text-primary-foreground'
                      : 'bg-muted/30 border border-border/20 text-foreground'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-muted/30 backdrop-blur-md rounded-2xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border/40 bg-card/80 backdrop-blur-md shrink-0">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题..."
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
