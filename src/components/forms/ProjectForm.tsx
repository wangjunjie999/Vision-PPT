import { useData } from '@/contexts/DataContext';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { usePPTTemplates } from '@/hooks/usePPTTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditableSelect } from '@/components/ui/editable-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { useAIFormFill } from '@/hooks/useAIFormFill';
import { AIFillButton, getFieldHighlightClass } from './AIFillButton';
import { stringifyFormDraft, useEntityFormDraft } from '@/hooks/useEntityFormDraft';

type QualityStrategy = 'no_miss' | 'balanced' | 'allow_pass';

const productProcessOptions = [
  '注塑成型',
  '冲压成型',
  '总装检测',
  '涂装检测',
  '焊接检测',
  '包装检测',
  '其他'
];

const cameraBrandOptions = [
  'Basler',
  '海康威视',
  '大华',
  'Keyence',
  'Cognex',
  'FLIR',
];

const environmentOptions: { value: string; label: string }[] = [
  { value: 'high_reflection', label: '高反光' },
  { value: 'dust', label: '粉尘' },
  { value: 'vibration', label: '震动' },
  { value: 'low_light', label: '低照度' },
  { value: 'strong_ambient', label: '强环境光' },
];

const qualityStrategyOptions: { value: QualityStrategy; label: string }[] = [
  { value: 'no_miss', label: '宁可误杀不可漏检' },
  { value: 'balanced', label: '平衡' },
  { value: 'allow_pass', label: '宁可放行' },
];

const createEmptyProjectFormData = () => ({
  code: '',
  name: '',
  customer: '',
  production_line: '',
  product_process: '',
  date: '',
  responsible: '',
  sales_responsible: '',
  vision_responsible: '',
  template_id: '',
  cycle_time_target: '',
  environment: [] as string[],
  quality_strategy: '' as QualityStrategy | '',
  use_3d: false,
  use_ai: false,
  main_camera_brand: '',
  spec_version: '',
  notes: '',
});

type ProjectFormData = ReturnType<typeof createEmptyProjectFormData>;
type ProjectRow = Database['public']['Tables']['projects']['Row'];

const projectToFormData = (project: ProjectRow): ProjectFormData => ({
  code: project.code || '',
  name: project.name || '',
  customer: project.customer || '',
  production_line: project.production_line || '',
  product_process: project.product_process || '',
  date: project.date || '',
  responsible: project.responsible || '',
  sales_responsible: project.sales_responsible || '',
  vision_responsible: project.vision_responsible || '',
  template_id: project.template_id || '',
  cycle_time_target: project.cycle_time_target?.toString() || '',
  environment: project.environment ? (typeof project.environment === 'string' ? project.environment.split(',') : []) : [],
  quality_strategy: (project.quality_strategy || '') as ProjectFormData['quality_strategy'],
  use_3d: project.use_3d || false,
  use_ai: project.use_ai || false,
  main_camera_brand: project.main_camera_brand || '',
  spec_version: project.spec_version || '',
  notes: project.notes || '',
});

export function ProjectForm() {
  const { selectedProjectId, projects, updateProject } = useData();
  const { templates, isLoading: templatesLoading } = usePPTTemplates();
  
  const project = projects.find(p => p.id === selectedProjectId);
  
  const [formData, setFormData] = useState<ProjectFormData>(createEmptyProjectFormData);
  const [saving, setSaving] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const initializedProjectIdRef = useRef<string | null>(null);
  const baselineSnapshotRef = useRef(stringifyFormDraft(createEmptyProjectFormData()));

  const { readDraft, clearDraft } = useEntityFormDraft<ProjectFormData>({
    entityType: 'project',
    entityId: selectedProjectId,
    value: formData,
    isDirty: draftDirty,
    enabled: draftReady,
    entityUpdatedAt: project?.updated_at,
  });

  const getFormData = useCallback(() => formData, [formData]);
  const setFormField = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const aiFill = useAIFormFill({
    formType: 'project',
    getFormData,
    setFormField,
  });

  // Listen for pendingAIFill from chat
  const { pendingAIFill, setPendingAIFill } = useAppStore();
  useEffect(() => {
    if (pendingAIFill && pendingAIFill.targetType === 'project' && pendingAIFill.targetId === project?.id) {
      aiFill.fillWithSuggestions(pendingAIFill.fields);
      setPendingAIFill(null);
    }
  }, [pendingAIFill, project?.id]);

  useEffect(() => {
    if (!project) {
      initializedProjectIdRef.current = null;
      setDraftReady(false);
      setDraftDirty(false);
      return;
    }

    if (initializedProjectIdRef.current === project.id) return;

    const draft = readDraft();
    const nextFormData = draft?.payload || projectToFormData(project);
    setFormData(nextFormData);
    baselineSnapshotRef.current = stringifyFormDraft(nextFormData);
    setDraftDirty(Boolean(draft));
    setDraftReady(true);
    initializedProjectIdRef.current = project.id;

    if (draft) {
      toast.info('已恢复未保存草稿');
    }
  }, [project, readDraft]);

  useEffect(() => {
    if (!draftReady || !project) return;
    if (stringifyFormDraft(formData) !== baselineSnapshotRef.current) {
      setDraftDirty(true);
    }
  }, [draftReady, formData, project]);

  if (!project) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProject(project.id, {
        code: formData.code,
        name: formData.name,
        customer: formData.customer,
        production_line: formData.production_line || null,
        product_process: formData.product_process || null,
        date: formData.date || null,
        responsible: formData.responsible || null,
        sales_responsible: formData.sales_responsible || null,
        vision_responsible: formData.vision_responsible || null,
        template_id: formData.template_id || null,
        cycle_time_target: formData.cycle_time_target ? parseFloat(formData.cycle_time_target) : null,
        environment: formData.environment.length > 0 ? formData.environment.join(',') : null,
        quality_strategy: formData.quality_strategy || null,
        use_3d: formData.use_3d,
        use_ai: formData.use_ai,
        main_camera_brand: formData.main_camera_brand || null,
        spec_version: formData.spec_version || null,
        notes: formData.notes || null,
        status: formData.code && formData.name && formData.customer && formData.template_id 
          ? 'complete' : 'incomplete',
      } as any);
      clearDraft();
      baselineSnapshotRef.current = stringifyFormDraft(formData);
      setDraftDirty(false);
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (project) {
      const nextFormData = projectToFormData(project);
      clearDraft();
      setFormData(nextFormData);
      baselineSnapshotRef.current = stringifyFormDraft(nextFormData);
      setDraftDirty(false);
    }
  };

  const toggleEnvironment = (env: string) => {
    setFormData(prev => ({
      ...prev,
      environment: prev.environment.includes(env)
        ? prev.environment.filter(e => e !== env)
        : [...prev.environment, env]
    }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header flex items-center justify-between">
        <span className="font-medium">项目配置</span>
        <div className="flex gap-2">
          <AIFillButton
            status={aiFill.status}
            onStart={aiFill.startFill}
            onStop={aiFill.stopFill}
          />
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving || aiFill.isActive}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || aiFill.isActive}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            保存
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Required Fields */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-accent rounded-full" />
            必填信息
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-medium">项目编号 <span className="text-destructive ml-0.5">*</span></Label>
                <Input 
                  id="code" 
                  value={formData.code}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="VIS-2024-XXX"
                  className={cn("h-9", getFieldHighlightClass('code', aiFill.currentField, aiFill.completedFields))}
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-xs font-medium">方案日期 <span className="text-destructive ml-0.5">*</span></Label>
                <Input 
                  id="date" 
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">项目名称 <span className="text-destructive ml-0.5">*</span></Label>
              <Input 
                id="name" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入项目名称"
                className={cn("h-9", getFieldHighlightClass('name', aiFill.currentField, aiFill.completedFields))}
                maxLength={200}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="customer" className="text-xs font-medium">客户名称 <span className="text-destructive ml-0.5">*</span></Label>
              <Input 
                id="customer" 
                value={formData.customer}
                onChange={e => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                placeholder="请输入客户名称"
                className={cn("h-9", getFieldHighlightClass('customer', aiFill.currentField, aiFill.completedFields))}
                maxLength={200}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="production_line" className="text-xs font-medium">产线/工厂名称</Label>
              <Input 
                id="production_line" 
                value={formData.production_line}
                onChange={e => setFormData(prev => ({ ...prev, production_line: e.target.value }))}
                placeholder="请输入产线或工厂名称"
                className="h-9"
                maxLength={200}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="process" className="text-xs font-medium">产品/工艺段 <span className="text-destructive ml-0.5">*</span></Label>
                <EditableSelect
                  value={formData.product_process}
                  onValueChange={value => setFormData(prev => ({ ...prev, product_process: value }))}
                  options={productProcessOptions}
                  placeholder="请选择"
                  inputPlaceholder="请输入工艺段名称"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsible" className="text-xs font-medium">项目负责人 <span className="text-destructive ml-0.5">*</span></Label>
                <Input 
                  id="responsible" 
                  value={formData.responsible}
                  onChange={e => setFormData(prev => ({ ...prev, responsible: e.target.value }))}
                  placeholder="请输入"
                  className="h-9"
                  maxLength={50}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sales_responsible" className="text-xs font-medium">销售负责人</Label>
                <Input 
                  id="sales_responsible" 
                  value={formData.sales_responsible}
                  onChange={e => setFormData(prev => ({ ...prev, sales_responsible: e.target.value }))}
                  placeholder="请输入"
                  className="h-9"
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vision_responsible" className="text-xs font-medium">视觉负责人</Label>
                <Input 
                  id="vision_responsible" 
                  value={formData.vision_responsible}
                  onChange={e => setFormData(prev => ({ ...prev, vision_responsible: e.target.value }))}
                  placeholder="请输入"
                  className="h-9"
                  maxLength={50}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="template" className="text-xs font-medium">PPT母版 <span className="text-destructive ml-0.5">*</span></Label>
              <Select 
                value={formData.template_id}
                onValueChange={value => setFormData(prev => ({ ...prev, template_id: value }))}
                disabled={templatesLoading}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={templatesLoading ? '加载中...' : (templates.length === 0 ? '暂无模板' : '请选择母版')} />
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
          </div>
        </div>

        {/* Technology Options Section */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-accent rounded-full" />
            技术选项
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">使用3D视觉</Label>
                  <p className="text-[10px] text-muted-foreground">启用3D点云/深度检测</p>
                </div>
                <Switch
                  checked={formData.use_3d}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, use_3d: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">使用AI/深度学习</Label>
                  <p className="text-[10px] text-muted-foreground">启用神经网络模型</p>
                </div>
                <Switch
                  checked={formData.use_ai}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, use_ai: checked }))}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="main_camera_brand" className="text-xs font-medium">主相机品牌</Label>
              <EditableSelect
                value={formData.main_camera_brand}
                onValueChange={value => setFormData(prev => ({ ...prev, main_camera_brand: value }))}
                options={cameraBrandOptions}
                placeholder="请选择品牌"
                inputPlaceholder="请输入相机品牌"
              />
            </div>
          </div>
        </div>

        {/* Recommended Fields */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-warning rounded-full" />
            建议填写
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cycleTime" className="text-xs font-medium">整线节拍目标 (s/pcs)</Label>
              <Input 
                id="cycleTime" 
                type="number"
                step="0.1"
                value={formData.cycle_time_target}
                onChange={e => setFormData(prev => ({ ...prev, cycle_time_target: e.target.value }))}
                placeholder="例如: 3.5"
                className="h-9"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">现场环境 (多选)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {environmentOptions.map(env => (
                  <label 
                    key={env.value}
                    className="flex items-center gap-1.5 px-2 py-1 border rounded-md cursor-pointer hover:bg-secondary transition-colors"
                  >
                    <Checkbox 
                      checked={formData.environment.includes(env.value)}
                      onCheckedChange={() => toggleEnvironment(env.value)}
                    />
                    <span className="text-xs">{env.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="quality" className="text-xs font-medium">质量策略</Label>
              <Select 
                value={formData.quality_strategy}
                onValueChange={value => setFormData(prev => ({ ...prev, quality_strategy: value as QualityStrategy }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="请选择策略" />
                </SelectTrigger>
                <SelectContent>
                  {qualityStrategyOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Optional Fields */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-muted-foreground rounded-full" />
            可选信息
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="specVersion" className="text-xs font-medium">规格书版本</Label>
              <Input 
                id="specVersion" 
                value={formData.spec_version}
                onChange={e => setFormData(prev => ({ ...prev, spec_version: e.target.value }))}
                placeholder="例如: V1.0"
                className="h-9"
                maxLength={20}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">备注</Label>
              <Textarea 
                id="notes"
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="其他说明..."
                className="min-h-[80px] resize-none"
                maxLength={1000}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
