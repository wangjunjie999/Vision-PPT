import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/useData';
import { toast } from 'sonner';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  template_data: any;
  workstation_count: number;
  module_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export function useProjectTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('project_templates' as any)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setTemplates(data as any as ProjectTemplate[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveAsTemplate = useCallback(async (
    projectId: string,
    name: string,
    description?: string
  ) => {
    if (!user) return;
    
    // Serialize project data
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    const { data: workstations } = await supabase
      .from('workstations')
      .select('*')
      .eq('project_id', projectId);
    
    const wsIds = (workstations || []).map(ws => ws.id);
    
    let allModules: any[] = [];
    let allLayouts: any[] = [];
    
    if (wsIds.length > 0) {
      const { data: modules } = await supabase
        .from('function_modules')
        .select('*')
        .in('workstation_id', wsIds);
      allModules = modules || [];

      const { data: layouts } = await supabase
        .from('mechanical_layouts')
        .select('*')
        .in('workstation_id', wsIds);
      allLayouts = layouts || [];
    }

    const templateData = {
      project: {
        product_process: project?.product_process,
        quality_strategy: project?.quality_strategy,
        environment: project?.environment,
        use_3d: project?.use_3d,
        use_ai: project?.use_ai,
        main_camera_brand: project?.main_camera_brand,
      },
      workstations: (workstations || []).map(ws => ({
        name: ws.name,
        code: ws.code,
        type: ws.type,
        description: ws.description,
        process_stage: ws.process_stage,
        observation_target: ws.observation_target,
        cycle_time: ws.cycle_time,
        enclosed: ws.enclosed,
        product_dimensions: ws.product_dimensions,
      })),
      modules: allModules.map(m => ({
        workstation_index: wsIds.indexOf(m.workstation_id),
        name: m.name,
        type: m.type,
        description: m.description,
        selected_camera: m.selected_camera,
        selected_lens: m.selected_lens,
        selected_light: m.selected_light,
        selected_controller: m.selected_controller,
        roi_strategy: m.roi_strategy,
        trigger_type: m.trigger_type,
        processing_time_limit: m.processing_time_limit,
      })),
      layouts: allLayouts.map(l => ({
        workstation_index: wsIds.indexOf(l.workstation_id),
        name: l.name,
        layout_type: l.layout_type,
        conveyor_type: l.conveyor_type,
        width: l.width,
        height: l.height,
        depth: l.depth,
      })),
    };

    const { error } = await supabase.from('project_templates' as any).insert({
      user_id: user.id,
      name,
      description: description || null,
      template_data: templateData,
      workstation_count: (workstations || []).length,
      module_count: allModules.length,
    });

    if (error) {
      toast.error('保存模板失败');
      return;
    }
    
    toast.success('项目模板已保存');
    fetchTemplates();
  }, [user, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    await supabase.from('project_templates' as any).delete().eq('id', id);
    toast.success('模板已删除');
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, saveAsTemplate, deleteTemplate, refetch: fetchTemplates };
}

