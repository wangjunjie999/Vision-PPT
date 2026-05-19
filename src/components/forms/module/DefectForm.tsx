import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleFormState, MissTolerance, ConveyorType } from './types';

interface DefectFormProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

const missToleranceOptions: { value: MissTolerance; label: string }[] = [
  { value: 'none', label: '不可漏检' },
  { value: 'low', label: '低漏检率' },
  { value: 'acceptable', label: '可接受' },
];

const conveyorTypeOptions: { value: ConveyorType; label: string }[] = [
  { value: 'belt', label: '皮带' },
  { value: 'roller', label: '滚筒' },
  { value: 'step', label: '步进' },
  { value: 'other', label: '其他' },
];

const quickDefectClasses = ['划痕', '凹坑', '异物', '变色', '气泡', '裂纹', '缺损', '披锋'];

export function DefectForm({ form, setForm }: DefectFormProps) {
  const [newDefectClass, setNewDefectClass] = useState('');

  const addDefectClass = () => {
    if (newDefectClass.trim() && !form.defectClasses.includes(newDefectClass.trim())) {
      setForm(prev => ({
        ...prev,
        defectClasses: [...prev.defectClasses, newDefectClass.trim()]
      }));
      setNewDefectClass('');
    }
  };

  const removeDefectClass = (cls: string) => {
    setForm(prev => ({
      ...prev,
      defectClasses: prev.defectClasses.filter(c => c !== cls)
    }));
  };

  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <span className="w-1 h-4 bg-warning rounded-full" />
        缺陷检测配置
      </h3>
      
      <div className="space-y-4">
        {/* 缺陷类别 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            缺陷类别 <span className="text-destructive ml-0.5">*</span>
            {form.defectClasses.length === 0 && (
              <span className="text-destructive text-xs ml-2">(至少添加1个)</span>
            )}
          </Label>
          
          <div className="flex gap-2">
            <Input
              value={newDefectClass}
              onChange={e => setNewDefectClass(e.target.value)}
              placeholder="输入缺陷类别"
              className="h-9 flex-1"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDefectClass())}
            />
            <Button 
              type="button"
              variant="outline"
              size="sm"
              onClick={addDefectClass}
              disabled={!newDefectClass.trim()}
              className="h-9"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* 快速添加 */}
          <div className="flex flex-wrap gap-1">
            {quickDefectClasses.map(cls => (
              <button
                key={cls}
                type="button"
                onClick={() => {
                  if (!form.defectClasses.includes(cls)) {
                    setForm(prev => ({ ...prev, defectClasses: [...prev.defectClasses, cls] }));
                  }
                }}
                disabled={form.defectClasses.includes(cls)}
                className={cn(
                  "px-2 py-1 text-xs rounded border transition-colors",
                  form.defectClasses.includes(cls)
                    ? "bg-primary/10 border-primary text-primary"
                    : "hover:bg-secondary cursor-pointer"
                )}
              >
                {form.defectClasses.includes(cls) ? '✓ ' : '+ '}{cls}
              </button>
            ))}
          </div>
          
          {/* 已添加类别 */}
          {form.defectClasses.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-secondary/30 rounded-lg">
              {form.defectClasses.map(cls => (
                <Badge key={cls} variant="secondary" className="gap-1 pr-1">
                  {cls}
                  <button
                    type="button"
                    onClick={() => removeDefectClass(cls)}
                    className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 检测参数 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">最小缺陷尺寸 (mm)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.minDefectSize}
              onChange={e => setForm(p => ({ ...p, minDefectSize: e.target.value }))}
              placeholder="可选，例如 0.6"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">漏检容忍度</Label>
            <Select 
              value={form.missTolerance} 
              onValueChange={v => setForm(p => ({ ...p, missTolerance: v as MissTolerance }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {missToleranceOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 检测区域 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">检测区域长度 (mm)</Label>
            <Input
              type="number"
              value={form.detectionAreaLength}
              onChange={e => setForm(p => ({ ...p, detectionAreaLength: e.target.value }))}
              placeholder="例如: 200"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">检测区域宽度 (mm)</Label>
            <Input
              type="number"
              value={form.detectionAreaWidth}
              onChange={e => setForm(p => ({ ...p, detectionAreaWidth: e.target.value }))}
              placeholder="例如: 150"
              className="h-9"
            />
          </div>
        </div>

        {/* 输送配置 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">输送方式</Label>
            <Select 
              value={form.conveyorType} 
              onValueChange={v => setForm(p => ({ ...p, conveyorType: v as ConveyorType }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {conveyorTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">线速度 (mm/s)</Label>
            <Input
              type="number"
              value={form.lineSpeed}
              onChange={e => setForm(p => ({ ...p, lineSpeed: e.target.value }))}
              placeholder="例如: 500"
              className="h-9"
            />
          </div>
        </div>

        {/* 相机数量 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">相机数量</Label>
          <Select 
            value={form.defectCameraCount} 
            onValueChange={v => setForm(p => ({ ...p, defectCameraCount: v as '1' | '2' | '3' }))}
          >
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1台</SelectItem>
              <SelectItem value="2">2台</SelectItem>
              <SelectItem value="3">3台</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 工业级参数 */}
        <div className="space-y-4 pt-2 border-t">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">工业级参数（可选）</Label>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">缺陷对比度</Label>
              <Input
                value={form.defectContrast}
                onChange={e => setForm(p => ({ ...p, defectContrast: e.target.value }))}
                placeholder="例如: 高/中/低"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">材质反光等级</Label>
              <Select 
                value={form.materialReflectionLevel} 
                onValueChange={v => setForm(p => ({ ...p, materialReflectionLevel: v }))}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="高反光">高反光</SelectItem>
                  <SelectItem value="中等">中等</SelectItem>
                  <SelectItem value="低反光">低反光</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">允许漏检率</Label>
              <Input
                value={form.allowedMissRate}
                onChange={e => setForm(p => ({ ...p, allowedMissRate: e.target.value }))}
                placeholder="例如: 10ppm 或 0.001%"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">允许误检率</Label>
              <Input
                value={form.allowedFalseRate}
                onChange={e => setForm(p => ({ ...p, allowedFalseRate: e.target.value }))}
                placeholder="例如: 100ppm 或 0.01%"
                className="h-9"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">置信度阈值/NG判定阈值</Label>
            <Input
              value={form.confidenceThreshold}
              onChange={e => setForm(p => ({ ...p, confidenceThreshold: e.target.value }))}
              placeholder="例如: 0.8 或 80%"
              className="h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
