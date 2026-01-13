import { ModuleFormState } from './types';
import { PositioningForm } from './PositioningForm';
import { DefectForm } from './DefectForm';
import { OCRForm } from './OCRForm';
import { MeasurementForm } from './MeasurementForm';
import { DeepLearningForm } from './DeepLearningForm';
import { AlertCircle } from 'lucide-react';

interface ModuleStep2DetectionProps {
  form: ModuleFormState;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormState>>;
}

const typeLabels: Record<string, string> = {
  positioning: '引导定位',
  defect: '缺陷检测',
  ocr: 'OCR识别',
  deeplearning: '深度学习',
  measurement: '尺寸测量',
};

export function ModuleStep2Detection({ form, setForm }: ModuleStep2DetectionProps) {
  if (!form.type) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-sm font-medium text-muted-foreground">请先选择模块类型</h3>
        <p className="text-xs text-muted-foreground mt-1">
          返回上一步选择模块类型后，这里会显示对应的检测参数配置
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-xs text-muted-foreground">
          当前模块类型：<span className="font-medium text-foreground">{typeLabels[form.type]}</span>
        </p>
      </div>

      {/* Type-specific forms - rendered without form-section wrapper */}
      <div className="-mx-4">
        {form.type === 'positioning' && <PositioningForm form={form} setForm={setForm} />}
        {form.type === 'defect' && <DefectForm form={form} setForm={setForm} />}
        {form.type === 'ocr' && <OCRForm form={form} setForm={setForm} />}
        {form.type === 'measurement' && <MeasurementForm form={form} setForm={setForm} />}
        {form.type === 'deeplearning' && <DeepLearningForm form={form} setForm={setForm} />}
      </div>
    </div>
  );
}
