import type { Database } from '@/integrations/supabase/types';
import { hasCurrentSchematicLayoutSignature } from '@/utils/schematicImageSignature';
import {
  getActiveModuleConfig,
  isActiveModule3DCamera,
  normalizeTwoDCameraType,
} from '@/utils/moduleConfig';

type DbProject = Database['public']['Tables']['projects']['Row'];
type DbWorkstation = Database['public']['Tables']['workstations']['Row'];
type DbLayout = Database['public']['Tables']['mechanical_layouts']['Row'];
type DbModule = Database['public']['Tables']['function_modules']['Row'];

export type OutputFormat = 'ppt' | 'pdf' | 'word';
export type GenerationMode = 'draft' | 'final';
export type GenerationScope = 'full' | 'workstations' | 'modules';

export interface MissingItem {
  level: 'project' | 'workstation' | 'module' | 'layout';
  id: string;
  name: string;
  missing: string[];
  required: boolean; // true = final模式必须，false = 建议填写
  actionType: 'selectWorkstation' | 'selectModule' | 'selectProject';
  targetId: string;
}

export interface WarningItem {
  level: 'project' | 'workstation' | 'module';
  id: string;
  name: string;
  warning: string;
}

export interface PPTReadinessResult {
  draftReady: boolean;  // 草案版最低条件
  finalReady: boolean;  // 交付版完整条件
  missing: MissingItem[];  // 缺失项列表
  warnings: WarningItem[];  // 警告项列表
  stats: {
    workstationCount: number;
    moduleCount: number;
    missingSchematicImages: number;
  };
}

interface CheckInput {
  projects: DbProject[];
  workstations: DbWorkstation[];
  layouts: DbLayout[];
  modules: DbModule[];
  selectedProjectId: string | null;
  outputFormat?: OutputFormat;
  mode?: GenerationMode;
  scope?: GenerationScope;
  selectedWorkstationIds?: string[];
  selectedModuleIds?: string[];
}

/**
 * 检查文档生成就绪状态（PDF/Word/PPT通用）
 * @param input 项目数据和生成选项
 * @returns 就绪状态检查结果
 */
export function checkPPTReadiness(input: CheckInput): PPTReadinessResult {
  const {
    projects,
    workstations,
    layouts,
    modules,
    selectedProjectId,
    mode = 'draft',
    scope = 'full',
    selectedWorkstationIds = [],
    selectedModuleIds = [],
  } = input;
  const isFinal = mode === 'final';
  
  const missing: MissingItem[] = [];
  const warnings: WarningItem[] = [];
  
  // 1. 检查项目选择
  if (!selectedProjectId) {
    return {
      draftReady: false,
      finalReady: false,
      missing: [{
        level: 'project',
        id: '',
        name: '未选择项目',
        missing: ['请先选择一个项目'],
        required: true,
        actionType: 'selectProject',
        targetId: '',
      }],
      warnings: [],
      stats: {
        workstationCount: 0,
        moduleCount: 0,
        missingSchematicImages: 0,
      },
    };
  }
  
  const project = projects.find(p => p.id === selectedProjectId);
  if (!project) {
    return {
      draftReady: false,
      finalReady: false,
      missing: [{
        level: 'project',
        id: selectedProjectId,
        name: '项目不存在',
        missing: ['项目数据不存在'],
        required: true,
        actionType: 'selectProject',
        targetId: selectedProjectId,
      }],
      warnings: [],
      stats: {
        workstationCount: 0,
        moduleCount: 0,
        missingSchematicImages: 0,
      },
    };
  }
  
  // 2. 检查项目必填字段（草案版最低要求）
  const projectUses3D = Boolean((project as any).use_3d);

  const projectMissing: string[] = [];
  if (!project.code || project.code.trim() === '') {
    projectMissing.push('项目编号');
  }
  if (!project.name || project.name.trim() === '') {
    projectMissing.push('项目名称');
  }
  if (!project.customer || project.customer.trim() === '') {
    projectMissing.push('客户名称');
  }
  
  if (projectMissing.length > 0) {
    missing.push({
      level: 'project',
      id: project.id,
      name: project.name || '未命名项目',
      missing: projectMissing,
      required: true,
      actionType: 'selectProject',
      targetId: project.id,
    });
  }
  
  // 3. 获取项目下的工位和模块
  const allProjectWorkstations = workstations.filter(ws => ws.project_id === selectedProjectId);
  const allProjectWorkstationIds = new Set(allProjectWorkstations.map(ws => ws.id));
  const allProjectModules = modules.filter(m => allProjectWorkstationIds.has(m.workstation_id));

  let projectWorkstations = allProjectWorkstations;
  let projectModules = allProjectModules;
  let scopeSelectionMissing = false;

  if (scope === 'workstations') {
    scopeSelectionMissing = selectedWorkstationIds.length === 0;
    const selectedWsIds = new Set(selectedWorkstationIds);
    projectWorkstations = allProjectWorkstations.filter(ws => selectedWsIds.has(ws.id));
    const scopedWsIds = new Set(projectWorkstations.map(ws => ws.id));
    projectModules = allProjectModules.filter(m => scopedWsIds.has(m.workstation_id));
  } else if (scope === 'modules') {
    scopeSelectionMissing = selectedModuleIds.length === 0;
    const selectedModIds = new Set(selectedModuleIds);
    projectModules = allProjectModules.filter(m => selectedModIds.has(m.id));
    const parentWsIds = new Set(projectModules.map(m => m.workstation_id));
    projectWorkstations = allProjectWorkstations.filter(ws => parentWsIds.has(ws.id));
  }

  if (scopeSelectionMissing) {
    missing.push({
      level: 'project',
      id: project.id,
      name: project.name || '未命名项目',
      missing: [scope === 'workstations' ? '请选择至少一个工位' : '请选择至少一个模块'],
      required: true,
      actionType: 'selectProject',
      targetId: project.id,
    });
  }
  
  // 4. 草案版检查：至少需要1个工位
  const hasScopedContent = scope === 'modules' ? projectModules.length > 0 : projectWorkstations.length > 0;
  const draftReady = projectMissing.length === 0 && hasScopedContent && !scopeSelectionMissing;
  
  // 5. 检查工位布局配置和三视图
  if (scope !== 'modules') projectWorkstations.forEach(ws => {
    const designResponsible = ((ws as unknown) as { design_responsible?: string | null }).design_responsible;
    if (!designResponsible || String(designResponsible).trim() === '') {
      warnings.push({
        level: 'workstation',
        id: ws.id,
        name: ws.name,
        warning: '未填写工位设计负责人',
      });
    }
    const layout = layouts.find(l => l.workstation_id === ws.id);
    const workstationModules = projectModules.filter(mod => mod.workstation_id === ws.id);
    const workstationNeeds2DOptics = workstationModules.length === 0
      || workstationModules.some(mod => !isActiveModule3DCamera(mod, projectUses3D));
    
    if (!layout) {
      missing.push({
        level: 'workstation',
        id: ws.id,
        name: ws.name,
        missing: ['机械布局配置'],
        required: false,
        actionType: 'selectWorkstation',
        targetId: ws.id,
      });
    } else {
      // 检查主视图和辅视图是否已保存
      const primaryView = (layout as any).primary_view || 'front';
      const auxiliaryView = (layout as any).auxiliary_view || 'side';
      const primaryUrl = (layout as any)?.[`${primaryView}_view_image_url`];
      const auxiliaryUrl = (layout as any)?.[`${auxiliaryView}_view_image_url`];
      
      if (!primaryUrl) {
        warnings.push({
          level: 'workstation',
          id: ws.id,
          name: ws.name,
          warning: '未保存主视图布局图',
        });
      }
      if (!auxiliaryUrl) {
        warnings.push({
          level: 'workstation',
          id: ws.id,
          name: ws.name,
          warning: '未保存辅视图布局图',
        });
      }
      
      // 检查硬件选择
      const selectedCams = layout.selected_cameras as Array<{ id: string }> | null;
      const selectedLens = layout.selected_lenses as Array<{ id: string }> | null;
      const selectedLights = layout.selected_lights as Array<{ id: string }> | null;
      
      if (!selectedCams || selectedCams.length === 0) {
        warnings.push({
          level: 'workstation',
          id: ws.id,
          name: ws.name,
          warning: '未配置相机',
        });
      }
      if (workstationNeeds2DOptics && (!selectedLens || selectedLens.length === 0)) {
        warnings.push({
          level: 'workstation',
          id: ws.id,
          name: ws.name,
          warning: '未配置镜头',
        });
      }
      if (workstationNeeds2DOptics && (!selectedLights || selectedLights.length === 0)) {
        warnings.push({
          level: 'workstation',
          id: ws.id,
          name: ws.name,
          warning: '未配置光源',
        });
      }
    }
  });
  
  // 6. 检查模块示意图和成像参数
  let missingSchematicImages = 0;
  projectModules.forEach(mod => {
    const schematicUrl = (mod as any).schematic_image_url;
    if (!schematicUrl || !hasCurrentSchematicLayoutSignature((mod as any).schematic_layout)) {
      missingSchematicImages++;
      missing.push({
        level: 'module',
        id: mod.id,
        name: mod.name,
        missing: ['视觉系统示意图'],
        required: isFinal,
        actionType: 'selectModule',
        targetId: mod.id,
      });
    }
    
    // 检查成像参数（FOV、工作距离等）
    const config = getModuleConfig(mod);
    if (config) {
      const moduleUses3D = isActiveModule3DCamera(mod, projectUses3D);
      const missingImaging = moduleUses3D ? getMissingThreeDParams(config) : getMissingImagingParams(config);
      
      if (missingImaging.length > 0) {
        warnings.push({
          level: 'module',
          id: mod.id,
          name: mod.name,
          warning: moduleUses3D
            ? `建议补充3D参数：${missingImaging.join('、')}`
            : `建议补充成像参数：${missingImaging.join('、')}`,
        });
      }
    }
  });
  
  // 7. 检查项目关键字段完整性（交付版要求）
  const projectKeyFieldsMissing: string[] = [];
  if (!project.responsible || project.responsible.trim() === '') {
    projectKeyFieldsMissing.push('负责人');
  }
  if (!project.date) {
    projectKeyFieldsMissing.push('日期');
  }
  
  if (projectKeyFieldsMissing.length > 0 && projectMissing.length === 0) {
    warnings.push({
      level: 'project',
      id: project.id,
      name: project.name || '未命名项目',
      warning: `建议补充：${projectKeyFieldsMissing.join('、')}`,
    });
  }
  
  // 8. final模式额外检查：布局视图和硬件必须完整
  if (isFinal && scope !== 'modules') {
    projectWorkstations.forEach(ws => {
      const designResponsible = ((ws as unknown) as { design_responsible?: string | null }).design_responsible;
      if (!designResponsible || String(designResponsible).trim() === '') {
        missing.push({
          level: 'workstation',
          id: ws.id,
          name: ws.name,
          missing: ['工位设计负责人（交付版必须）'],
          required: true,
          actionType: 'selectWorkstation',
          targetId: ws.id,
        });
      }
      const layout = layouts.find(l => l.workstation_id === ws.id);
      const workstationModules = projectModules.filter(mod => mod.workstation_id === ws.id);
      const workstationNeeds2DOptics = workstationModules.length === 0
        || workstationModules.some(mod => !isActiveModule3DCamera(mod, projectUses3D));
      if (layout) {
        const primaryView = (layout as any).primary_view || 'front';
        const primaryUrl = (layout as any)?.[`${primaryView}_view_image_url`];
        if (!primaryUrl) {
          missing.push({
            level: 'workstation',
            id: ws.id,
            name: ws.name,
            missing: ['主视图布局图（交付版必须）'],
            required: true,
            actionType: 'selectWorkstation',
            targetId: ws.id,
          });
        }

        const selectedCams = layout.selected_cameras as Array<{ id: string }> | null;
        const selectedLens = layout.selected_lenses as Array<{ id: string }> | null;
        if (!selectedCams || selectedCams.length === 0) {
          missing.push({
            level: 'workstation',
            id: ws.id,
            name: ws.name,
            missing: ['相机配置（交付版必须）'],
            required: true,
            actionType: 'selectWorkstation',
            targetId: ws.id,
          });
        }
        if (workstationNeeds2DOptics && (!selectedLens || selectedLens.length === 0)) {
          missing.push({
            level: 'workstation',
            id: ws.id,
            name: ws.name,
            missing: ['镜头配置（交付版必须）'],
            required: true,
            actionType: 'selectWorkstation',
            targetId: ws.id,
          });
        }
      }
    });
  }

  // 9. 交付版检查条件
  const hasBlockingMissing = isFinal && missing.some(m => m.required);
  const finalReady = 
    draftReady &&
    missingSchematicImages === 0 &&
    projectModules.length > 0 &&
    !hasBlockingMissing;
  
  // 10. 如果没有模块，添加警告
  if (scope !== 'modules' && projectModules.length === 0 && projectWorkstations.length > 0) {
    warnings.push({
      level: 'project',
      id: project.id,
      name: project.name || '未命名项目',
      warning: '项目中没有功能模块，建议至少添加一个模块',
    });
  }
  
  // 11. 检查模块关键参数缺失（警告级别）
  projectModules.forEach(mod => {
    const modWarnings: string[] = [];
    const moduleUses3D = isActiveModule3DCamera(mod, projectUses3D);
    
    // 检查硬件配置
    if (!mod.selected_camera) {
      modWarnings.push('未选择相机');
    }
    if (!moduleUses3D && !mod.selected_lens) {
      modWarnings.push('未选择镜头');
    }
    if (!moduleUses3D && !mod.selected_light) {
      modWarnings.push('未选择光源');
    }
    
    // 检查处理时限
    if (!mod.processing_time_limit) {
      modWarnings.push('未设置处理时限');
    }
    
    // 检查类型专属配置的关键参数
    if (mod.type === 'positioning' && mod.positioning_config) {
      const cfg = mod.positioning_config as any;
      if (!cfg.accuracyRequirement) {
        modWarnings.push('未设置定位精度要求');
      }
    }
    
    if (mod.type === 'ocr' && mod.ocr_config) {
      const cfg = mod.ocr_config as any;
      if (!cfg.minCharHeight) {
        modWarnings.push('未设置最小字符高度');
      }
    }
    
    if (modWarnings.length > 0) {
      warnings.push({
        level: 'module',
        id: mod.id,
        name: mod.name,
        warning: modWarnings.join('、'),
      });
    }
  });
  
  return {
    draftReady,
    finalReady,
    missing,
    warnings,
    stats: {
      workstationCount: projectWorkstations.length,
      moduleCount: projectModules.length,
      missingSchematicImages,
    },
  };
}

function getModuleConfig(module: DbModule): Record<string, unknown> | null {
  return getActiveModuleConfig(module);
}

function getMissingImagingParams(config: Record<string, unknown>): string[] {
  const imaging = getObject(config.imaging);
  if (normalizeTwoDCameraType(imaging?.twoDCameraType) === 'line_scan') {
    return getMissingLineScanParams(config, imaging);
  }

  const missingImaging: string[] = [];

  if (!hasFieldOfView(config, imaging)) missingImaging.push('视野范围(FOV)');
  if (!hasWorkingDistance(config, imaging)) missingImaging.push('工作距离');
  if (!hasPixelAccuracy(config, imaging)) missingImaging.push('像素精度');

  return missingImaging;
}

function getMissingLineScanParams(
  config: Record<string, unknown>,
  imaging: Record<string, unknown> | null,
): string[] {
  const lineScan = getObject(imaging?.lineScan);
  const missing: string[] = [];

  // Deliberately do not fall back to the hidden area-scan FOV or precision.
  if (!hasPositiveMeasurement(lineScan?.fieldOfView)) missing.push('线扫视野范围(FOV)');
  if (!hasWorkingDistance(config, imaging)) missing.push('工作距离');
  if (!hasPositiveMeasurement(lineScan?.resolutionPerPixel)) missing.push('线扫像素精度');
  if (!hasPositiveMeasurement(lineScan?.scanSpeed)) missing.push('扫描速度');

  return missing;
}

function getMissingThreeDParams(config: Record<string, unknown>): string[] {
  const threeD = getObject(config.three_d);
  const imaging = getObject(config.imaging);
  const missing: string[] = [];
  if (!firstPresent(threeD?.model)) missing.push('3D相机型号');
  if (!firstPresent(imaging?.workingDistance, threeD?.workingDistance)) missing.push('工作距离');
  if (!firstPresent(threeD?.referenceDistance, threeD?.standardRange)) missing.push('测量范围/基准距离');
  if (!firstPresent(threeD?.xyPrecision, threeD?.zPrecision)) missing.push('精度');
  return missing;
}

function hasFieldOfView(
  config: Record<string, unknown>,
  imaging: Record<string, unknown> | null,
): boolean {
  return firstPresent(
    joinFov(imaging?.fieldOfViewWidth, imaging?.fieldOfViewHeight),
    imaging?.fieldOfView,
    imaging?.fieldOfViewCommon,
    joinFov(config.fieldOfViewWidth, config.fieldOfViewHeight),
    config.fieldOfView,
    config.fieldOfViewCommon,
    config.fieldOfViewWidth,
    config.measurementFieldOfView,
    config.ocrCameraFieldOfView,
    config.dlFieldOfView,
  ) !== undefined;
}

function hasWorkingDistance(
  config: Record<string, unknown>,
  imaging: Record<string, unknown> | null,
): boolean {
  return firstPresent(
    imaging?.workingDistance,
    config.workingDistance,
    config.ocrWorkingDistance,
  ) !== undefined;
}

function hasPixelAccuracy(
  config: Record<string, unknown>,
  imaging: Record<string, unknown> | null,
): boolean {
  return firstPresent(
    imaging?.resolutionPerPixel,
    config.resolutionPerPixel,
    config.measurementResolution,
    config.ocrResolution,
  ) !== undefined;
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstPresent(...values: unknown[]): string | number | boolean | undefined {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value as string | number | boolean;
  }
  return undefined;
}

function hasPositiveMeasurement(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*[a-zA-Z]+(?:\s*\/\s*[a-zA-Z]+)?)?$/.test(normalized)) {
    return false;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0;
}

function joinFov(width: unknown, height: unknown): string | undefined {
  const w = firstPresent(width);
  const h = firstPresent(height);
  return w !== undefined && h !== undefined ? `${w}*${h}` : undefined;
}
