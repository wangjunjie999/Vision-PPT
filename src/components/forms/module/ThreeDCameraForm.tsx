import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">核心参数</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'workingDistance', '工作距离 WD (mm)', '160')}
          {field(form, setForm, 'workingDistanceTolerance', '工作距离公差 (±mm)', '15')}
          {field(form, setForm, 'threeDReferenceDistance', '基准距离 (mm)', '160')}
          {field(form, setForm, 'threeDZRange', 'FS/Z 量程', 'FS±23mm')}
          {field(form, setForm, 'threeDXRange', 'X 范围', '66-78mm')}
          {field(form, setForm, 'threeDYRange', 'Y 范围', '160mm')}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">3D 光学方案图信息</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDModel', '3D 相机型号', 'LJ-S080')}
          {field(form, setForm, 'threeDOrderModel', '下单型号', '3D-APS-280-N')}
          {field(form, setForm, 'threeDScanLineWidth', '扫描线宽 (mm)', '35')}
          {field(form, setForm, 'threeDDataPoints', 'XY 数据点', '3200×6400')}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">测量范围与精度</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDStandardRange', '标准范围', '280×233.8mm')}
          {field(form, setForm, 'threeDNearRange', '近端范围', '226×189mm')}
          {field(form, setForm, 'threeDFarRange', '远端范围', '333×278mm')}
          {field(form, setForm, 'threeDXYPrecision', 'XY 像素精度', '0.025mm')}
          {field(form, setForm, 'threeDZPrecision', 'Z 线性精度/重复精度', '±0.025mm')}
          {field(form, setForm, 'threeDScanTime', '拍照时间/节拍', '2-3S/次')}
          {field(form, setForm, 'threeDShotsPerSide', '拍照次数/面', '2次/面')}
          {field(form, setForm, 'threeDShotsPerProduct', '拍照次数/产品', '4次/产品')}
        </div>
      </div>
    </div>
  );
}
