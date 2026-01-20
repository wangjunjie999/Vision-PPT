import type { Database } from '@/integrations/supabase/types';

type DbProject = Database['public']['Tables']['projects']['Row'];
type DbWorkstation = Database['public']['Tables']['workstations']['Row'];
type DbLayout = Database['public']['Tables']['mechanical_layouts']['Row'];
type DbModule = Database['public']['Tables']['function_modules']['Row'];

export type OutputFormat = 'ppt' | 'pdf' | 'word';
export type GenerationMode = 'draft' | 'final';

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

// 关键必填字段定义（final模式缺失则阻断）
const REQUIRED_PROJECT_FIELDS = ['code', 'name', 'customer'];
const REQUIRED_PROJECT_LABELS: Record<string, string> = {
  code: '项目编号',
  name: '项目名称',
  customer: '客户名称',
};

interface CheckInput {
  projects: DbProject[];
  workstations: DbWorkstation[];
  layouts: DbLayout[];
  modules: DbModule[];
  selectedProjectId: string | null;
  outputFormat?: OutputFormat;
  mode?: GenerationMode;
}

/**
 * 检查文档生成就绪状态（PDF/Word/PPT通用）
 * @param input 项目数据和生成选项
 * @returns 就绪状态检查结果
 */
export function checkPPTReadiness(input: CheckInput): PPTReadinessResult {
  const { projects, workstations, layouts, modules, selectedProjectId } = input;
  
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
  const projectWorkstations = workstations.filter(ws => ws.project_id === selectedProjectId);
  const projectModuleIds = new Set(
    modules.filter(m => projectWorkstations.some(ws => ws.id === m.workstation_id)).map(m => m.id)
  );
  const projectModules = modules.filter(m => projectModuleIds.has(m.id));
  
  // 4. 草案版检查：至少需要1个工位
  const draftReady = projectMissing.length === 0 && projectWorkstations.length > 0;
  
  // 5. 检查工位布局配置
  projectWorkstations.forEach(ws => {
    const layout = layouts.find(l => l.workstation_id === ws.id);
    
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
    }
  });
  
  // 6. 检查模块示意图
  let missingSchematicImages = 0;
  projectModules.forEach(mod => {
    const schematicUrl = (mod as any).schematic_image_url;
    if (!schematicUrl) {
      missingSchematicImages++;
      missing.push({
        level: 'module',
        id: mod.id,
        name: mod.name,
        missing: ['视觉系统示意图'],
        required: true,
        actionType: 'selectModule',
        targetId: mod.id,
      });
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
  
  // 8. 交付版检查条件
  const finalReady = 
    draftReady &&
    missingSchematicImages === 0 &&
    projectModules.length > 0; // 至少需要一个模块（或明确允许无模块策略）
  
  // 9. 如果没有模块，添加警告
  if (projectModules.length === 0 && projectWorkstations.length > 0) {
    warnings.push({
      level: 'project',
      id: project.id,
      name: project.name || '未命名项目',
      warning: '项目中没有功能模块，建议至少添加一个模块',
    });
  }
  
  // 10. 检查模块关键参数缺失（警告级别）
  projectModules.forEach(mod => {
    const modWarnings: string[] = [];
    
    // 检查硬件配置
    if (!mod.selected_camera) {
      modWarnings.push('未选择相机');
    }
    if (!mod.selected_lens) {
      modWarnings.push('未选择镜头');
    }
    if (!mod.selected_light) {
      modWarnings.push('未选择光源');
    }
    
    // 检查处理时限
    if (!mod.processing_time_limit) {
      modWarnings.push('未设置处理时限');
    }
    
    // 检查类型专属配置的关键参数
    if (mod.type === 'defect' && mod.defect_config) {
      const cfg = mod.defect_config as any;
      if (!cfg.minDefectSize) {
        modWarnings.push('未设置最小缺陷尺寸');
      }
    }
    
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


