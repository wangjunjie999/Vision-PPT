import { useData } from '@/contexts/DataContext';
import { useControllers } from '@/contexts/HardwareContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { HardwareConfigPanel, HardwareItemData } from '@/components/hardware/HardwareConfigPanel';
import { toast } from 'sonner';
import { ProductAnnotationPanel } from '@/components/product/ProductAnnotationPanel';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Database } from '@/integrations/supabase/types';
import { FormStepWizard, FormStep } from './FormStepWizard';

type WorkstationType = 'line' | 'turntable' | 'robot' | 'platform';
type CameraMount = 'top' | 'side' | 'angled';
type Mechanism = 'stop' | 'cylinder' | 'gripper' | 'clamp' | 'flip' | 'lift' | 'indexing' | 'robot_pick';

// Constraint rules for execution mechanisms
interface MechanismConstraint {
  maxCameras?: number;
  forcedMounts?: CameraMount[];
  disabledMounts?: CameraMount[];
  reason: string;
}

const mechanismConstraints: Partial<Record<Mechanism, MechanismConstraint>> = {
  flip: {
    maxCameras: 1,
    forcedMounts: ['top'],
    disabledMounts: ['side', 'angled'],
    reason: '翻转机构运动范围大，仅支持单相机顶视安装'
  },
  robot_pick: {
    maxCameras: 2,
    disabledMounts: ['angled'],
    reason: '机械手取放需预留运动空间，最多2台相机，不支持斜视'
  },
  lift: {
    disabledMounts: ['side'],
    reason: '升降机构遮挡侧视视野，不支持侧视安装'
  },
  indexing: {
    forcedMounts: ['top'],
    disabledMounts: ['side'],
    reason: '分度盘旋转时侧视受遮挡，建议顶视安装'
  }
};

const cameraMountOptions: { value: CameraMount; label: string }[] = [
  { value: 'top', label: '顶视' },
  { value: 'side', label: '侧视' },
  { value: 'angled', label: '斜视' },
];

const processStageOptions = [
  '上料',
  '装配',
  '检测',
  '下线',
  '焊接',
  '涂装',
  '其他'
];

const observationTargetOptions = [
  '电芯',
  '模组',
  '托盘',
  '箱体',
  'PCB',
  '壳体',
  '其他'
];

export function WorkstationForm() {
  const { 
    selectedWorkstationId, 
    workstations, 
    updateWorkstation, 
    layouts, 
    upsertLayout,
    getLayoutByWorkstation 
  } = useData();
  
  const { controllers } = useControllers();
  
  const workstation = workstations.find(ws => ws.id === selectedWorkstationId);
  const layout = getLayoutByWorkstation(selectedWorkstationId || '');

  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [wsForm, setWsForm] = useState({ 
    code: '', 
    name: '', 
    type: 'line' as WorkstationType, 
    cycleTime: '', 
    length: '', 
    width: '', 
    height: '',
    enclosed: false,
    process_stage: '',
    observation_target: '',
    environment_description: '',
    notes: '',
    // New SOP fields (Step 1-6)
    acceptance_accuracy: '',
    acceptance_cycle_time: '',
    acceptance_compatible_sizes: '',
    motion_description: '',
    shot_count: '',
    action_script: '',
    risk_notes: '',
  });
  const [layoutForm, setLayoutForm] = useState({ 
    conveyorType: '皮带输送线', 
    cameraCount: 1 as 1|2|3|4, 
    lensCount: 1 as 1|2|3|4,
    lightCount: 1 as 1|2|3|4,
    cameraMounts: ['top'] as CameraMount[], 
    // Mount quantities for each type
    mountCounts: { top: 1, side: 0, angled: 0 } as Record<CameraMount, number>,
    mechanisms: [] as Mechanism[],
    selectedCameras: [] as (HardwareItemData | null)[],
    selectedLenses: [] as (HardwareItemData | null)[],
    selectedLights: [] as (HardwareItemData | null)[],
    selectedController: null as HardwareItemData | null,
  });

  useEffect(() => {
    if (workstation) {
      const ws = workstation as any;
      const dims = ws.product_dimensions as { length: number; width: number; height: number } | null;
      const acceptanceCriteria = ws.acceptance_criteria as { accuracy?: string; cycle_time?: string; compatible_sizes?: string } | null;
      setWsForm({ 
        code: ws.code || '', 
        name: ws.name || '', 
        type: ws.type || 'line', 
        cycleTime: ws.cycle_time?.toString() || '', 
        length: dims?.length?.toString() || '100', 
        width: dims?.width?.toString() || '100', 
        height: dims?.height?.toString() || '50',
        enclosed: ws.enclosed || false,
        process_stage: ws.process_stage || '',
        observation_target: ws.observation_target || '',
        environment_description: ws.environment_description || '',
        notes: ws.notes || '',
        acceptance_accuracy: acceptanceCriteria?.accuracy || '',
        acceptance_cycle_time: acceptanceCriteria?.cycle_time || '',
        acceptance_compatible_sizes: acceptanceCriteria?.compatible_sizes || '',
        motion_description: ws.motion_description || '',
        shot_count: ws.shot_count?.toString() || '',
        action_script: ws.action_script || '',
        risk_notes: ws.risk_notes || '',
      });
      setCurrentStep(0);
    }
    if (layout) {
      const selectedCameras = (layout as any).selected_cameras || [];
      const selectedLenses = (layout as any).selected_lenses || [];
      const selectedLights = (layout as any).selected_lights || [];
      let selectedController = (layout as any).selected_controller || null;
      
      // Merge controller data with latest from HardwareContext to get updated image_url
      if (selectedController && selectedController.id && controllers.length > 0) {
        const latestController = controllers.find(c => c.id === selectedController.id);
        if (latestController) {
          selectedController = {
            ...selectedController,
            image_url: latestController.image_url, // Use latest image_url from HardwareContext
          };
        }
      }
      
      // Parse mount counts from camera_mounts array
      const mounts = (layout.camera_mounts || ['top']) as CameraMount[];
      const mountCounts = { top: 0, side: 0, angled: 0 };
      mounts.forEach((m: CameraMount) => {
        if (mountCounts[m] !== undefined) mountCounts[m]++;
      });
      // Ensure at least one mount if all are 0
      if (mountCounts.top === 0 && mountCounts.side === 0 && mountCounts.angled === 0) {
        mountCounts.top = layout.camera_count || 1;
      }
      
      setLayoutForm({ 
        conveyorType: layout.conveyor_type || '皮带输送线', 
        cameraCount: (layout.camera_count || 1) as 1|2|3|4, 
        lensCount: ((layout as any).lens_count || 1) as 1|2|3|4,
        lightCount: ((layout as any).light_count || 1) as 1|2|3|4,
        cameraMounts: mounts, 
        mountCounts,
        mechanisms: (layout.mechanisms || []) as Mechanism[],
        selectedCameras: Array.isArray(selectedCameras) ? selectedCameras : [],
        selectedLenses: Array.isArray(selectedLenses) ? selectedLenses : [],
        selectedLights: Array.isArray(selectedLights) ? selectedLights : [],
        selectedController: selectedController,
      });
    }
  }, [workstation, layout, controllers]);

  // Calculate active constraints based on selected mechanisms
  const activeConstraints = useMemo(() => {
    const constraints: MechanismConstraint[] = [];
    layoutForm.mechanisms.forEach(mech => {
      const constraint = mechanismConstraints[mech];
      if (constraint) {
        constraints.push(constraint);
      }
    });
    
    // Add constraint for enclosed workstation
    if (wsForm.enclosed) {
      constraints.push({
        disabledMounts: ['side'],
        reason: '封闭罩体限制侧视可行性'
      });
    }
    
    return constraints;
  }, [layoutForm.mechanisms, wsForm.enclosed]);

  // Calculate effective limits
  const effectiveLimits = useMemo(() => {
    let maxCameras = 4;
    const disabledMounts = new Set<CameraMount>();
    const forcedMounts = new Set<CameraMount>();
    const reasons: string[] = [];

    activeConstraints.forEach(constraint => {
      if (constraint.maxCameras && constraint.maxCameras < maxCameras) {
        maxCameras = constraint.maxCameras;
      }
      constraint.disabledMounts?.forEach(m => disabledMounts.add(m));
      constraint.forcedMounts?.forEach(m => forcedMounts.add(m));
      reasons.push(constraint.reason);
    });

    return { maxCameras, disabledMounts, forcedMounts, reasons };
  }, [activeConstraints]);

  // Auto-adjust camera count and mounts when constraints change
  useEffect(() => {
    let updated = false;
    const newLayoutForm = { ...layoutForm };

    // Adjust camera count if exceeds max
    if (layoutForm.cameraCount > effectiveLimits.maxCameras) {
      newLayoutForm.cameraCount = effectiveLimits.maxCameras as 1|2|3|4;
      updated = true;
    }

    // Reset disabled mount counts to 0
    const newMountCounts = { ...layoutForm.mountCounts };
    effectiveLimits.disabledMounts.forEach(m => {
      if (newMountCounts[m] > 0) {
        newMountCounts[m] = 0;
        updated = true;
      }
    });

    // Rebuild cameraMounts array from mountCounts
    const newMounts: CameraMount[] = [];
    (['top', 'side', 'angled'] as CameraMount[]).forEach(mount => {
      for (let i = 0; i < newMountCounts[mount]; i++) {
        newMounts.push(mount);
      }
    });

    if (JSON.stringify(newMounts) !== JSON.stringify(layoutForm.cameraMounts)) {
      newLayoutForm.cameraMounts = newMounts.length > 0 ? newMounts : ['top'];
      newLayoutForm.mountCounts = newMountCounts;
      updated = true;
    }

    if (updated) {
      setLayoutForm(newLayoutForm);
    }
  }, [effectiveLimits, layoutForm.cameraCount, layoutForm.mountCounts]);

  // Step completion checks
  const isStep1Complete = useMemo(() => 
    Boolean(wsForm.code && wsForm.name && wsForm.cycleTime),
    [wsForm.code, wsForm.name, wsForm.cycleTime]
  );
  
  const isStep2Complete = useMemo(() => 
    Boolean(layoutForm.conveyorType && layoutForm.cameraCount > 0),
    [layoutForm.conveyorType, layoutForm.cameraCount]
  );
  
  const isStep3Complete = useMemo(() => 
    layoutForm.selectedCameras.some(c => c !== null),
    [layoutForm.selectedCameras]
  );

  if (!workstation) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Update workstation using DataContext to sync state
      await updateWorkstation(workstation.id, { 
        code: wsForm.code,
        name: wsForm.name,
        type: wsForm.type,
        cycle_time: parseFloat(wsForm.cycleTime) || null, 
        product_dimensions: { 
          length: parseFloat(wsForm.length) || 0, 
          width: parseFloat(wsForm.width) || 0, 
          height: parseFloat(wsForm.height) || 0 
        },
        enclosed: wsForm.enclosed,
        // New SOP fields
        process_stage: wsForm.process_stage || null,
        observation_target: wsForm.observation_target || null,
        acceptance_criteria: {
          accuracy: wsForm.acceptance_accuracy || null,
          cycle_time: wsForm.acceptance_cycle_time || null,
          compatible_sizes: wsForm.acceptance_compatible_sizes || null,
        },
        motion_description: wsForm.motion_description || null,
        shot_count: wsForm.shot_count ? parseInt(wsForm.shot_count) : null,
        action_script: wsForm.action_script || null,
        risk_notes: wsForm.risk_notes || null,
        status: 'incomplete' 
      } as any);
      
      // Upsert layout - this will update context state and trigger canvas re-render
      await upsertLayout(workstation.id, {
        name: wsForm.name || '布局',
        conveyor_type: layoutForm.conveyorType,
        camera_count: layoutForm.cameraCount,
        camera_mounts: layoutForm.cameraMounts,
        mechanisms: layoutForm.mechanisms,
        selected_cameras: layoutForm.selectedCameras,
        selected_lenses: layoutForm.selectedLenses,
        selected_lights: layoutForm.selectedLights,
        selected_controller: layoutForm.selectedController,
      } as any);
      
      toast.success('工位配置已保存');
    } catch (error) {
      console.error('Failed to save workstation:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const mechanisms: { value: Mechanism; label: string }[] = [
    { value: 'stop', label: '挡停' }, 
    { value: 'cylinder', label: '气缸' }, 
    { value: 'gripper', label: '夹爪' },
    { value: 'clamp', label: '压紧' }, 
    { value: 'flip', label: '翻转' }, 
    { value: 'lift', label: '升降' },
    { value: 'indexing', label: '分度盘' }, 
    { value: 'robot_pick', label: '机械手取放' }
  ];

  const isMountDisabled = (mount: CameraMount) => effectiveLimits.disabledMounts.has(mount);
  const isCameraCountDisabled = (count: number) => count > effectiveLimits.maxCameras;
  
  // Calculate total mount count
  const totalMountCount = layoutForm.mountCounts.top + layoutForm.mountCounts.side + layoutForm.mountCounts.angled;
  
  // Get max available for a mount type
  const getMaxForMount = (mount: CameraMount) => {
    const othersTotal = Object.entries(layoutForm.mountCounts)
      .filter(([key]) => key !== mount)
      .reduce((sum, [, val]) => sum + val, 0);
    return layoutForm.cameraCount - othersTotal;
  };

  const toggleMechanism = (mech: Mechanism) => {
    setLayoutForm(p => ({
      ...p,
      mechanisms: p.mechanisms.includes(mech) 
        ? p.mechanisms.filter(x => x !== mech) 
        : [...p.mechanisms, mech]
    }));
  };

  // Handle camera count change - auto-adjust mount counts
  const handleCameraCountChange = (newCount: 1|2|3|4) => {
    const currentTotal = totalMountCount;
    let newMountCounts = { ...layoutForm.mountCounts };
    
    if (newCount > currentTotal) {
      // Add difference to first available non-disabled mount (prefer top)
      const diff = newCount - currentTotal;
      if (!isMountDisabled('top')) {
        newMountCounts.top += diff;
      } else if (!isMountDisabled('side')) {
        newMountCounts.side += diff;
      } else if (!isMountDisabled('angled')) {
        newMountCounts.angled += diff;
      }
    } else if (newCount < currentTotal) {
      // Reduce from mounts, starting from angled, then side, then top
      let toReduce = currentTotal - newCount;
      for (const mount of ['angled', 'side', 'top'] as CameraMount[]) {
        const reduce = Math.min(toReduce, newMountCounts[mount]);
        newMountCounts[mount] -= reduce;
        toReduce -= reduce;
        if (toReduce <= 0) break;
      }
    }
    
    // Rebuild cameraMounts array
    const newMounts: CameraMount[] = [];
    (['top', 'side', 'angled'] as CameraMount[]).forEach(m => {
      for (let i = 0; i < newMountCounts[m]; i++) {
        newMounts.push(m);
      }
    });
    
    setLayoutForm(p => ({
      ...p,
      cameraCount: newCount,
      mountCounts: newMountCounts,
      cameraMounts: newMounts.length > 0 ? newMounts : ['top'],
    }));
  };

  const updateMountCount = (mount: CameraMount, count: number) => {
    if (isMountDisabled(mount)) return;
    
    const newMountCounts = { ...layoutForm.mountCounts, [mount]: count };
    
    // Rebuild cameraMounts array
    const newMounts: CameraMount[] = [];
    (['top', 'side', 'angled'] as CameraMount[]).forEach(m => {
      for (let i = 0; i < newMountCounts[m]; i++) {
        newMounts.push(m);
      }
    });
    
    setLayoutForm(p => ({
      ...p,
      mountCounts: newMountCounts,
      cameraMounts: newMounts.length > 0 ? newMounts : ['top'],
    }));
  };

  const hasConstraintForMechanism = (mech: Mechanism) => !!mechanismConstraints[mech];

  // Step content components
  const Step1WorkstationInfo = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">工位编号 *</Label>
          <Input 
            value={wsForm.code} 
            onChange={e => setWsForm(p => ({ ...p, code: e.target.value }))} 
            className="h-9"
            maxLength={20}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">节拍 (s/pcs) *</Label>
          <Input 
            type="number" 
            value={wsForm.cycleTime} 
            onChange={e => setWsForm(p => ({ ...p, cycleTime: e.target.value }))} 
            className="h-9" 
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">工位名称 *</Label>
        <Input 
          value={wsForm.name} 
          onChange={e => setWsForm(p => ({ ...p, name: e.target.value }))} 
          className="h-9"
          maxLength={100}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">工位类型 *</Label>
        <Select value={wsForm.type} onValueChange={v => setWsForm(p => ({ ...p, type: v as WorkstationType }))}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="line">线体</SelectItem>
            <SelectItem value="turntable">转盘</SelectItem>
            <SelectItem value="robot">机械手</SelectItem>
            <SelectItem value="platform">平台</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">产品长(mm)</Label>
          <Input 
            type="number" 
            value={wsForm.length} 
            onChange={e => setWsForm(p => ({ ...p, length: e.target.value }))} 
            className="h-9" 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">产品宽(mm)</Label>
          <Input 
            type="number" 
            value={wsForm.width} 
            onChange={e => setWsForm(p => ({ ...p, width: e.target.value }))} 
            className="h-9" 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">产品高(mm)</Label>
          <Input 
            type="number" 
            value={wsForm.height} 
            onChange={e => setWsForm(p => ({ ...p, height: e.target.value }))} 
            className="h-9" 
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox 
          id="enclosed" 
          checked={wsForm.enclosed} 
          onCheckedChange={(checked) => setWsForm(p => ({ ...p, enclosed: !!checked }))} 
        />
        <Label htmlFor="enclosed" className="text-xs cursor-pointer">封闭罩体</Label>
        {wsForm.enclosed && (
          <span className="text-xs text-warning ml-2">（限制侧视安装）</span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">所属工艺段</Label>
          <Select 
            value={wsForm.process_stage} 
            onValueChange={v => setWsForm(p => ({ ...p, process_stage: v }))}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="请选择" /></SelectTrigger>
            <SelectContent>
              {processStageOptions.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">被观察对象</Label>
          <Select 
            value={wsForm.observation_target} 
            onValueChange={v => setWsForm(p => ({ ...p, observation_target: v }))}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="请选择" /></SelectTrigger>
            <SelectContent>
              {observationTargetOptions.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">现场环境说明</Label>
        <Input 
          value={wsForm.environment_description} 
          onChange={e => setWsForm(p => ({ ...p, environment_description: e.target.value }))} 
          placeholder="例如: 无尘车间、强环境光、有振动..."
          className="h-9"
          maxLength={200}
        />
      </div>
      
      {/* New SOP fields: motion, shot count, action script, risk */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">运动方式</Label>
          <Input 
            value={wsForm.motion_description} 
            onChange={e => setWsForm(p => ({ ...p, motion_description: e.target.value }))} 
            placeholder="例如: 2D×2固定在伺服上"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">拍照次数 (次/节拍)</Label>
          <Input 
            type="number" 
            value={wsForm.shot_count} 
            onChange={e => setWsForm(p => ({ ...p, shot_count: e.target.value }))} 
            placeholder="1"
            className="h-9"
          />
        </div>
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">测量方法/动作分解</Label>
        <textarea 
          value={wsForm.action_script} 
          onChange={e => setWsForm(p => ({ ...p, action_script: e.target.value }))} 
          placeholder={"1. 两个相机分别固定在伺服上，从上往下拍摄产品...\n2. 对离型纸有无进行检测"}
          className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={1000}
        />
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">风险/待确认事项</Label>
        <textarea 
          value={wsForm.risk_notes} 
          onChange={e => setWsForm(p => ({ ...p, risk_notes: e.target.value }))} 
          placeholder="例如: 缺陷检测能力需以实际样品测试为准"
          className="w-full min-h-[60px] p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={500}
        />
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs">备注</Label>
        <textarea 
          value={wsForm.notes} 
          onChange={e => setWsForm(p => ({ ...p, notes: e.target.value }))} 
          placeholder="其他说明..."
          className="w-full min-h-[60px] p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={500}
        />
      </div>
    </div>
  );

  const Step2MechanicalLayout = (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">输送/机台类型</Label>
        <Input 
          value={layoutForm.conveyorType} 
          onChange={e => setLayoutForm(p => ({ ...p, conveyorType: e.target.value }))} 
          className="h-9"
          maxLength={50}
        />
      </div>

      {/* Execution Mechanisms */}
      <div className="space-y-2">
        <Label className="text-xs">执行机构</Label>
        <div className="flex flex-wrap gap-2">
          {mechanisms.map(m => {
            const hasConstraint = hasConstraintForMechanism(m.value);
            const isSelected = layoutForm.mechanisms.includes(m.value);
            
            return (
              <TooltipProvider key={m.value}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label 
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 border rounded-md cursor-pointer transition-colors",
                        isSelected 
                          ? hasConstraint 
                            ? "bg-warning/20 border-warning" 
                            : "bg-primary/10 border-primary"
                          : "hover:bg-secondary",
                        hasConstraint && "relative"
                      )}
                    >
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => toggleMechanism(m.value)} 
                      />
                      <span className="text-xs">{m.label}</span>
                      {hasConstraint && (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      )}
                    </label>
                  </TooltipTrigger>
                  {hasConstraint && (
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">
                        <strong>约束提示：</strong>{mechanismConstraints[m.value]?.reason}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Constraint Alert */}
      {effectiveLimits.reasons.length > 0 && (
        <Alert className="bg-warning/10 border-warning">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            <strong>当前约束：</strong>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              {effectiveLimits.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Camera Count */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs">相机数量</Label>
          {effectiveLimits.maxCameras < 4 && (
            <span className="text-xs text-warning">
              (最多 {effectiveLimits.maxCameras} 台)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(n => {
            const disabled = isCameraCountDisabled(n);
            const isSelected = layoutForm.cameraCount === n;
            
            return (
              <TooltipProvider key={n}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && handleCameraCountChange(n as 1|2|3|4)}
                      className={cn(
                        "flex-1 h-9 rounded-md border text-sm font-medium transition-colors",
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-background hover:bg-secondary",
                        disabled && "opacity-40 cursor-not-allowed bg-muted"
                      )}
                    >
                      {n}台
                    </button>
                  </TooltipTrigger>
                  {disabled && (
                    <TooltipContent>
                      <p className="text-xs">受执行机构约束限制</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Camera Mounts with Quantity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">相机安装方式分配</Label>
          {totalMountCount !== layoutForm.cameraCount && (
            <span className="text-xs text-warning">
              已分配 {totalMountCount}/{layoutForm.cameraCount} 台
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {cameraMountOptions.map(mount => {
            const disabled = isMountDisabled(mount.value);
            const currentCount = layoutForm.mountCounts[mount.value];
            const maxCount = getMaxForMount(mount.value);
            
            return (
              <TooltipProvider key={mount.value}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "flex flex-col gap-2 p-3 border rounded-md transition-colors",
                        disabled 
                          ? "opacity-40 cursor-not-allowed bg-muted"
                          : currentCount > 0 
                            ? "bg-primary/10 border-primary"
                            : "bg-background"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{mount.label}</span>
                        {disabled && (
                          <AlertTriangle className="h-3 w-3 text-warning" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {[0, 1, 2, 3, 4].filter(n => n <= layoutForm.cameraCount).map(n => (
                          <button
                            key={n}
                            type="button"
                            disabled={disabled || n > maxCount}
                            onClick={() => !disabled && n <= maxCount && updateMountCount(mount.value, n)}
                            className={cn(
                              "w-7 h-7 rounded text-xs font-medium transition-colors",
                              currentCount === n 
                                ? "bg-primary text-primary-foreground" 
                                : n > maxCount
                                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                                  : "bg-secondary hover:bg-secondary/80",
                              disabled && "cursor-not-allowed"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TooltipTrigger>
                  {disabled && (
                    <TooltipContent>
                      <p className="text-xs">已禁用：受执行机构约束</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        {totalMountCount !== layoutForm.cameraCount && (
          <p className="text-xs text-muted-foreground">
            提示：各安装方式数量之和应等于相机总数 ({layoutForm.cameraCount})
          </p>
        )}
      </div>
    </div>
  );

  const Step3HardwareConfig = (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">硬件配置</span>
      </div>
      <HardwareConfigPanel 
        cameraCount={layoutForm.cameraCount}
        lensCount={layoutForm.lensCount}
        lightCount={layoutForm.lightCount}
        onCameraCountChange={(n) => setLayoutForm(p => ({ ...p, cameraCount: n as 1|2|3|4 }))}
        onLensCountChange={(n) => setLayoutForm(p => ({ ...p, lensCount: n as 1|2|3|4 }))}
        onLightCountChange={(n) => setLayoutForm(p => ({ ...p, lightCount: n as 1|2|3|4 }))}
        initialCameras={layoutForm.selectedCameras}
        initialLenses={layoutForm.selectedLenses}
        initialLights={layoutForm.selectedLights}
        initialController={layoutForm.selectedController}
        onHardwareChange={(config) => setLayoutForm(p => ({
          ...p,
          selectedCameras: config.cameras,
          selectedLenses: config.lenses,
          selectedLights: config.lights,
          selectedController: config.controller,
        }))}
      />
      
      {/* Product 3D & Annotation Section */}
      {selectedWorkstationId && (
        <div className="mt-6 pt-6 border-t">
          <ProductAnnotationPanel workstationId={selectedWorkstationId} />
        </div>
      )}
    </div>
  );

  const steps: FormStep[] = useMemo(() => [
    {
      id: 'info',
      title: '工位信息',
      shortTitle: '信息',
      description: '设置工位基本信息和产品尺寸',
      content: Step1WorkstationInfo,
      isComplete: isStep1Complete,
      nextHint: isStep1Complete 
        ? '工位信息已完成，点击"下一步"配置机械布局' 
        : '请填写工位编号、名称和节拍后继续',
    },
    {
      id: 'layout',
      title: '机械布局',
      shortTitle: '布局',
      description: '配置输送类型、执行机构和相机安装',
      content: Step2MechanicalLayout,
      isComplete: isStep2Complete,
      nextHint: isStep2Complete 
        ? '机械布局已配置，下一步选择硬件' 
        : '请配置输送类型和相机数量',
    },
    {
      id: 'hardware',
      title: '硬件配置',
      shortTitle: '硬件',
      description: '选择相机、镜头、光源和控制器',
      content: Step3HardwareConfig,
      isComplete: isStep3Complete,
      nextHint: isStep3Complete 
        ? '配置完成！点击"保存完成"保存所有设置' 
        : '请至少选择一个相机',
    },
  ], [Step1WorkstationInfo, Step2MechanicalLayout, Step3HardwareConfig, isStep1Complete, isStep2Complete, isStep3Complete]);

  return (
    <FormStepWizard
      title="工位配置"
      steps={steps}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onSave={handleSave}
      saving={saving}
    />
  );
}
