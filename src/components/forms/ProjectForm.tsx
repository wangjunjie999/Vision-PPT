import { useData } from '@/contexts/DataContext';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

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
  '其他'
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

export function ProjectForm() {
  const { selectedProjectId, projects, updateProject } = useData();
  const { templates, isLoading: templatesLoading } = usePPTTemplates();
  
  const project = projects.find(p => p.id === selectedProjectId);
  
const [formData, setFormData] = useState({
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      const proj = project as any;
      setFormData({
        code: proj.code || '',
        name: proj.name || '',
        customer: proj.customer || '',
        production_line: proj.production_line || '',
        product_process: proj.product_process || '',
        date: proj.date || '',
        responsible: proj.responsible || '',
        sales_responsible: proj.sales_responsible || '',
        vision_responsible: proj.vision_responsible || '',
        template_id: proj.template_id || '',
        cycle_time_target: proj.cycle_time_target?.toString() || '',
        environment: proj.environment ? (typeof proj.environment === 'string' ? proj.environment.split(',') : []) : [],
        quality_strategy: proj.quality_strategy || '',
        use_3d: proj.use_3d || false,
        use_ai: proj.use_ai || false,
        main_camera_brand: proj.main_camera_brand || '',
        spec_version: proj.spec_version || '',
        notes: proj.notes || '',
      });
    }
  }, [project]);

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
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (project) {
      const proj = project as any;
      setFormData({
        code: proj.code || '',
        name: proj.name || '',
        customer: proj.customer || '',
        production_line: proj.production_line || '',
        product_process: proj.product_process || '',
        date: proj.date || '',
        responsible: proj.responsible || '',
        sales_responsible: proj.sales_responsible || '',
        vision_responsible: proj.vision_responsible || '',
        template_id: proj.template_id || '',
        cycle_time_target: proj.cycle_time_target?.toString() || '',
        environment: proj.environment ? (typeof proj.environment === 'string' ? proj.environment.split(',') : []) : [],
        quality_strategy: proj.quality_strategy || '',
        use_3d: proj.use_3d || false,
        use_ai: proj.use_ai || false,
        main_camera_brand: proj.main_camera_brand || '',
        spec_version: proj.spec_version || '',
        notes: proj.notes || '',
      });
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
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            保存
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Required Fields */}
        <div className="form-section">
          <h3 className="form-section-title">
            <span className="w-1 h-4 bg-destructive rounded-full" />
            必填信息
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs">项目编号 *</Label>
                <Input 
                  id="code" 
                  value={formData.code}
                  onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="VIS-2024-XXX"
                  className="h-9"
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-xs">方案日期 *</Label>
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
              <Label htmlFor="name" className="text-xs">项目名称 *</Label>
              <Input 
                id="name" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入项目名称"
                className="h-9"
                maxLength={200}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="customer" className="text-xs">客户名称 *</Label>
              <Input 
                id="customer" 
                value={formData.customer}
                onChange={e => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                placeholder="请输入客户名称"
                className="h-9"
                maxLength={200}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="production_line" className="text-xs">产线/工厂名称</Label>
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
                <Label htmlFor="process" className="text-xs">产品/工艺段 *</Label>
                <Select 
                  value={formData.product_process}
                  onValueChange={value => setFormData(prev => ({ ...prev, product_process: value }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {productProcessOptions.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsible" className="text-xs">项目负责人 *</Label>
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
                <Label htmlFor="sales_responsible" className="text-xs">销售负责人</Label>
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
                <Label htmlFor="vision_responsible" className="text-xs">视觉负责人</Label>
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
              <Label htmlFor="template" className="text-xs">PPT母版 *</Label>
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
            <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="main_camera_brand" className="text-xs">主相机品牌</Label>
              <Select 
                value={formData.main_camera_brand}
                onValueChange={value => setFormData(prev => ({ ...prev, main_camera_brand: value }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="请选择品牌" />
                </SelectTrigger>
                <SelectContent>
                  {cameraBrandOptions.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="cycleTime" className="text-xs">整线节拍目标 (s/pcs)</Label>
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
              <Label className="text-xs">现场环境 (多选)</Label>
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
              <Label htmlFor="quality" className="text-xs">质量策略</Label>
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
              <Label htmlFor="specVersion" className="text-xs">规格书版本</Label>
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
              <Label htmlFor="notes" className="text-xs">备注</Label>
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