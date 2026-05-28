import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScanLine } from 'lucide-react';
import { ModuleFormState } from './types';

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
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
        <ScanLine className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground">
          已切换到 <span className="font-medium text-foreground">3D 视觉检测</span> 流程。
          光学方案仅需填写以下三项核心信息，将直接用于 PPT 光学方案图。
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">光学方案核心参数</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDModel', '3D 相机型号', 'LJ-S080')}
          {field(form, setForm, 'threeDScanLineWidth', '扫描线宽 (mm)', '35')}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {field(form, setForm, 'threeDDataPoints', 'XY 数据点', '3200×6400')}
        </div>
        <p className="text-[11px] text-muted-foreground">
          说明：以上三项将作为光学方案图右上角标注（型号 / 线宽 / XY数据点）展示。
        </p>
      </div>
    </div>
  );
}