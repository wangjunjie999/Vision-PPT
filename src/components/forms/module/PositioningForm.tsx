import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EditableSelect } from '@/components/ui/editable-select';
import { cn } from '@/lib/utils';
import type { 
  ModuleFormState, 
  PositionTargetType, 
  GuidingMode,
  GuidingMechanism,
  CalibrationMethod
} from './types';

interface PositioningFormProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

const targetTypeOptions: { value: PositionTargetType; label: string }[] = [
  { value: 'hole', label: '孔位' },
  { value: 'edge', label: '边缘' },
  { value: 'corner', label: '角点' },
  { value: 'qrcode', label: '二维码' },
  { value: 'feature', label: '特征点' },
  { value: 'mark', label: '标记点' },
];

const guidingModeOptions: { value: GuidingMode; label: string }[] = [
  { value: 'single_camera', label: '单相机' },
  { value: 'dual_camera', label: '双相机' },
];

const guidingMechanismOptions: { value: GuidingMechanism; label: string }[] = [
  { value: 'fixed', label: '固定安装' },
  { value: 'robot', label: '机械手' },
  { value: 'three_axis', label: '三轴' },
  { value: 'cylinder', label: '气缸' },
  { value: 'gantry', label: '行架抓手' },
];

const calibrationOptions: { value: CalibrationMethod; label: string }[] = [
  { value: 'plane', label: '平面标定' },
  { value: 'hand_eye', label: '手眼标定' },
  { value: 'multipoint', label: '多点标定' },
  { value: 'fixture', label: '治具标定' },
  { value: 'none', label: '无需标定' },
];

export function PositioningForm({ form, setForm }: PositioningFormProps) {
  return (
    <div className="form-section">
      <h3 className="form-section-title">
        <span className="w-1 h-4 bg-accent rounded-full" />
        引导定位配置
      </h3>
      
      <div className="space-y-4">
        {/* 引导模式和机构 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">引导模式 <span className="text-destructive ml-0.5">*</span></Label>
            <Select 
              value={form.guidingMode} 
              onValueChange={v => setForm(p => ({ ...p, guidingMode: v as GuidingMode }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {guidingModeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">引导机构 <span className="text-destructive ml-0.5">*</span></Label>
            <Select 
              value={form.guidingMechanism} 
              onValueChange={v => setForm(p => ({ ...p, guidingMechanism: v as GuidingMechanism }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {guidingMechanismOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 视野和工作距离 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">视野范围 (mm) <span className="text-destructive ml-0.5">*</span></Label>
            <div className="flex items-center gap-1.5">
              <Input
                value={form.fieldOfViewWidth || ''}
                onChange={e => {
                  const w = e.target.value;
                  const h = form.fieldOfViewHeight || '';
                  const combined = w && h ? `${w}×${h}` : '';
                  setForm(p => ({ ...p, fieldOfViewWidth: w, fieldOfView: combined }));
                }}
                placeholder="宽"
                className="h-9"
                type="number"
              />
              <span className="text-muted-foreground text-sm shrink-0">×</span>
              <Input
                value={form.fieldOfViewHeight || ''}
                onChange={e => {
                  const h = e.target.value;
                  const w = form.fieldOfViewWidth || '';
                  const combined = w && h ? `${w}×${h}` : '';
                  setForm(p => ({ ...p, fieldOfViewHeight: h, fieldOfView: combined }));
                }}
                placeholder="高"
                className="h-9"
                type="number"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">工作距离 (mm)</Label>
            <Input
              type="number"
              value={form.workingDistance}
              onChange={e => setForm(p => ({ ...p, workingDistance: e.target.value }))}
              placeholder="例如: 300"
              className="h-9"
            />
          </div>
        </div>

        {/* 定位目标类型 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">定位目标类型 <span className="text-destructive ml-0.5">*</span></Label>
          <div className="grid grid-cols-3 gap-2">
            {targetTypeOptions.map(opt => (
              <label
                key={opt.value}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all text-sm",
                  form.targetType === opt.value
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-secondary"
                )}
              >
                <input
                  type="radio"
                  name="targetType"
                  value={opt.value}
                  checked={form.targetType === opt.value}
                  onChange={() => setForm(p => ({ ...p, targetType: opt.value }))}
                  className="w-3 h-3"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 精度要求 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">定位精度 (mm) <span className="text-destructive ml-0.5">*</span></Label>
            <Input
              type="number"
              step="0.01"
              value={form.accuracyRequirement}
              onChange={e => setForm(p => ({ ...p, accuracyRequirement: e.target.value }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">重复性 (mm)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.repeatabilityRequirement}
              onChange={e => setForm(p => ({ ...p, repeatabilityRequirement: e.target.value }))}
              className="h-9"
            />
          </div>
        </div>

        {/* 误差容忍 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">允许误差ΔX (mm)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.toleranceX}
              onChange={e => setForm(p => ({ ...p, toleranceX: e.target.value }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">允许误差ΔY (mm)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.toleranceY}
              onChange={e => setForm(p => ({ ...p, toleranceY: e.target.value }))}
              className="h-9"
            />
          </div>
        </div>

        {/* 标定方式 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">标定方式</Label>
          <Select 
            value={form.calibrationMethod} 
            onValueChange={v => setForm(p => ({ ...p, calibrationMethod: v as CalibrationMethod }))}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {calibrationOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 工业级参数 */}
        <div className="space-y-4 pt-2 border-t">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">工业级参数（可选）</Label>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">输出坐标系</Label>
              <EditableSelect
                value={form.outputCoordinateSystem}
                onValueChange={v => setForm(p => ({ ...p, outputCoordinateSystem: v }))}
                options={['相机坐标系', '工位坐标系', '机器人坐标系']}
                placeholder="请选择"
                inputPlaceholder="请输入坐标系名称"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">标定周期</Label>
              <Input
                value={form.calibrationCycle}
                onChange={e => setForm(p => ({ ...p, calibrationCycle: e.target.value }))}
                placeholder="例如: 每月/每季度"
                className="h-9"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">精度验收方法</Label>
            <Input
              value={form.accuracyAcceptanceMethod}
              onChange={e => setForm(p => ({ ...p, accuracyAcceptanceMethod: e.target.value }))}
              placeholder="例如: 使用标准件验证"
              className="h-9"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">目标特征类型</Label>
              <Input
                value={form.targetFeatureType}
                onChange={e => setForm(p => ({ ...p, targetFeatureType: e.target.value }))}
                placeholder="例如: 圆形/矩形/特征点"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">目标数量</Label>
              <Input
                type="number"
                value={form.targetCount}
                onChange={e => setForm(p => ({ ...p, targetCount: e.target.value }))}
                placeholder="例如: 1"
                className="h-9"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">遮挡容忍</Label>
            <Input
              value={form.occlusionTolerance}
              onChange={e => setForm(p => ({ ...p, occlusionTolerance: e.target.value }))}
              placeholder="例如: 允许20%遮挡"
              className="h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}