import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCameras } from '@/hooks/useHardware';
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
  required = false,
) {
  const value = String(form[key] ?? '');
  const missing = required && !value.trim();
  return (
    <div className="space-y-1.5" key={String(key)}>
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        value={value}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }) as ModuleFormState)}
        placeholder={placeholder}
        className={`h-9 ${missing ? 'border-destructive focus-visible:ring-destructive' : ''}`}
      />
    </div>
  );
}

/** 3D 线扫相机：与硬件库字段一一对应 */
function ThreeDLineScanFields({ form, setForm }: ThreeDCameraFormProps) {
  const { cameras } = useCameras();
  const filledRef = useRef<string | null>(null);

  const selectedCamera = useMemo(() => {
    if (!form.selectedCamera) return null;
    return cameras.find(camera =>
      camera.id === form.selectedCamera || `${camera.brand} ${camera.model}` === form.selectedCamera
    ) || null;
  }, [cameras, form.selectedCamera]);

  // 硬件库已维护的值自动带入（不覆盖用户已填内容）
  useEffect(() => {
    if (!selectedCamera || filledRef.current === selectedCamera.id) return;
    filledRef.current = selectedCamera.id;
    const cam = selectedCamera as Record<string, unknown>;
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    setForm(prev => {
      const patch: Partial<ModuleFormState> = {};
      const apply = (key: keyof ModuleFormState, value: string) => {
        if (value && !String(prev[key] ?? '').trim()) {
          (patch as Record<string, unknown>)[key] = value;
        }
      };
      apply('threeDModel', str(cam.model));
      apply('threeDName', str(cam.name));
      apply('threeDProfilePoints', str(cam.profile_points));
      apply('threeDReferenceDistance', str(cam.reference_distance_mm));
      apply('threeDZRange', str(cam.z_range));
      apply('threeDXRange', str(cam.x_range));
      apply('threeDScanFrameRate', str(cam.scan_frame_rate));
      apply('threeDScanSpeed', str(cam.scan_speed));
      apply('threeDZResolution', str(cam.z_resolution));
      apply('threeDZRepeatability', str(cam.z_repeatability));
      apply('threeDZLinearity', str(cam.z_linearity));
      return Object.keys(patch).length > 0 ? { ...prev, ...patch } : prev;
    });
  }, [selectedCamera, setForm]);

  return (
    <div className="space-y-6" data-testid="three-d-line-scan-fields">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">3D 线扫相机参数</h4>
          {selectedCamera && (
            <span className="text-[11px] text-muted-foreground">
              已从硬件库映射：{selectedCamera.brand} {selectedCamera.model}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDModel', '型号', 'MV-DP4090-01P', true)}
          {field(form, setForm, 'threeDName', '名称', '3D激光轮廓传感器，DP4000系列', true)}
          {field(form, setForm, 'threeDProfilePoints', '单轮廓点数', '4080', true)}
          {field(form, setForm, 'threeDReferenceDistance', '参考距离 (mm)', '94', true)}
          {field(form, setForm, 'threeDZRange', 'Z 轴测量范围', '42 mm', true)}
          {field(form, setForm, 'threeDXRange', 'X 轴测量范围', '51.5 mm@参考距离', true)}
          {field(form, setForm, 'threeDScanFrameRate', '扫描帧率', '2.5 KHz', true)}
          {field(form, setForm, 'threeDScanSpeed', '扫描速度', '100mm/s')}
        </div>
        <p className="text-[11px] text-muted-foreground">
          参考距离在 PPT 中以「工作距离」展示。
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Z 轴性能（选填）</h4>
        <div className="grid grid-cols-2 gap-3">
          {field(form, setForm, 'threeDZResolution', 'Z 轴分辨率', '1.87 ~ 3.98 μm')}
          {field(form, setForm, 'threeDZRepeatability', 'Z 轴重复精度', '0.66 μm')}
          {field(form, setForm, 'threeDZLinearity', 'Z 轴线性度 (±% of MR)', '0.01')}
        </div>
      </div>
    </div>
  );
}

export function ThreeDCameraForm({ form, setForm }: ThreeDCameraFormProps) {
  if (form.twoDCameraType === 'line_scan') {
    return <ThreeDLineScanFields form={form} setForm={setForm} />;
  }

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
