import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ScanLine } from 'lucide-react';
import { ModuleFormState, DEFAULT_THREE_D_DETECTION_STEPS } from './types';

interface ThreeDCameraFormProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

function field<K extends keyof ModuleFormState>(
  form: ModuleFormState,
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>,
  key: K,
  label: string,
  placeholder?: string,
) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={String(form[key] ?? '')}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }) as ModuleFormState)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );
}

export function ThreeDCameraForm({ form, setForm }: ThreeDCameraFormProps) {
  const steps = form.threeDDetectionSteps?.length ? form.threeDDetectionSteps : [];

  const updateStep = (idx: number, value: string) => {
    setForm(p => {
      const next = [...(p.threeDDetectionSteps || [])];
      next[idx] = value;
      return { ...p, threeDDetectionSteps: next };
    });
  };

  const addStep = () => {
    setForm(p => ({ ...p, threeDDetectionSteps: [...(p.threeDDetectionSteps || []), ''] }));
  };

  const removeStep = (idx: number) => {
    setForm(p => {
      const next = [...(p.threeDDetectionSteps || [])];
      next.splice(idx, 1);
      return { ...p, threeDDetectionSteps: next };
    });
  };

  const useDefaultSteps = () => {
    setForm(p => ({ ...p, threeDDetectionSteps: [...DEFAULT_THREE_D_DETECTION_STEPS] }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
        <ScanLine className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          已切换到 <span className="font-medium text-foreground">3D 视觉检测</span> 流程。
          以下字段为 3D 相机独立参数，不再走 2D 相机的镜头/视场/靶面/焦距匹配。
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">3D 相机基本信息</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDModel', '3D 相机型号', 'LJ-S080')}
          {field(form, setForm, 'threeDDetectionMethod', '检测方式', '3D 相机垂直固定')}
          {field(form, setForm, 'threeDMountType', '安装方式', '支架垂直固定，高度可调')}
          {field(form, setForm, 'threeDScanLineWidth', '扫描线宽 (mm)', '35')}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">测量范围与精度</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDReferenceDistance', '基准距离 (mm)', '160')}
          {field(form, setForm, 'threeDZRange', 'Z 方向量程', 'FS±23mm')}
          {field(form, setForm, 'threeDXRange', 'X 测量范围', '66–78mm')}
          {field(form, setForm, 'threeDYRange', 'Y 扫描范围', '160mm')}
          {field(form, setForm, 'threeDXYPrecision', 'XY 像素精度 (mm)', '0.025')}
          {field(form, setForm, 'threeDZPrecision', 'Z 线性精度 (mm)', '±0.025')}
          {field(form, setForm, 'threeDDataPoints', '数据点数量', '3200×6400')}
          {field(form, setForm, 'threeDScanTime', '拍照/扫描时间', '2-3s/次')}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">检测节拍</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDShotsPerSide', '单面检测次数', '2')}
          {field(form, setForm, 'threeDShotsPerProduct', '单产品检测次数', '4')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([
            ['threeDNeedFlip', '需要翻面'],
            ['threeDNeedRobot', '需要机械手'],
            ['threeDNeedFixture', '需要治具定位'],
          ] as Array<[keyof ModuleFormState, string]>).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
              <span className="text-xs">{label}</span>
              <Switch
                checked={Boolean(form[key])}
                onCheckedChange={v => setForm(p => ({ ...p, [key]: v }) as ModuleFormState)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">3D 检测步骤</h4>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={useDefaultSteps}>
              填入默认 9 步
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addStep}>
              <Plus className="h-3 w-3" />新增步骤
            </Button>
          </div>
        </div>
        {steps.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/10 p-4 text-center text-xs text-muted-foreground">
            暂未配置检测步骤，可点击「填入默认 9 步」快速填充。
          </div>
        ) : (
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="mt-2 w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
                  {idx + 1}
                </div>
                <Textarea
                  value={step}
                  onChange={e => updateStep(idx, e.target.value)}
                  className="min-h-[40px] text-xs resize-none flex-1"
                  rows={1}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeStep(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}