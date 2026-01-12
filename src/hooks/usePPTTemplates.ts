import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PPTTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  version: number;
  file_url: string | null;
  structure_meta: {
    sections: string[];
  } | null;
  scope: string | null;
  is_default: boolean | null;
  enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface PPTTemplateInsert {
  name: string;
  description?: string;
  version?: number;
  file_url?: string;
  structure_meta?: { sections: string[] };
  scope?: string;
  is_default?: boolean;
}

export interface PPTTemplateUpdate {
  name?: string;
  description?: string;
  version?: number;
  file_url?: string;
  structure_meta?: { sections: string[] };
  scope?: string;
  is_default?: boolean;
  enabled?: boolean;
}

export function usePPTTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['ppt_templates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('ppt_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PPTTemplate[];
    },
    enabled: !!user?.id,
  });

  const defaultTemplate = templates.find(t => t.is_default) || templates[0] || null;

  const addTemplate = useMutation({
    mutationFn: async (template: PPTTemplateInsert) => {
      if (!user?.id) throw new Error('未登录');

      // If setting as default, clear other defaults first
      if (template.is_default) {
        await supabase
          .from('ppt_templates')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { data, error } = await supabase
        .from('ppt_templates')
        .insert({ ...template, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppt_templates'] });
      toast.success('模板已添加');
    },
    onError: (error) => {
      toast.error('添加模板失败: ' + error.message);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PPTTemplateUpdate }) => {
      if (!user?.id) throw new Error('未登录');

      // If setting as default, clear other defaults first
      if (updates.is_default) {
        await supabase
          .from('ppt_templates')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('ppt_templates')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppt_templates'] });
      toast.success('模板已更新');
    },
    onError: (error) => {
      toast.error('更新模板失败: ' + error.message);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('未登录');

      // Get template to check for file_url
      const { data: template } = await supabase
        .from('ppt_templates')
        .select('file_url')
        .eq('id', id)
        .single();

      // Delete file from storage if exists
      if (template?.file_url) {
        const path = template.file_url.split('/ppt-templates/')[1];
        if (path) {
          await supabase.storage.from('ppt-templates').remove([path]);
        }
      }

      const { error } = await supabase
        .from('ppt_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppt_templates'] });
      toast.success('模板已删除');
    },
    onError: (error) => {
      toast.error('删除模板失败: ' + error.message);
    },
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('未登录');

      // Clear all defaults first
      await supabase
        .from('ppt_templates')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error } = await supabase
        .from('ppt_templates')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppt_templates'] });
      toast.success('已设为默认模板');
    },
    onError: (error) => {
      toast.error('设置默认失败: ' + error.message);
    },
  });

  const uploadTemplateFile = async (file: File, templateId: string): Promise<string> => {
    if (!user?.id) throw new Error('未登录');

    const ext = file.name.split('.').pop();
    const path = `${user.id}/${templateId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('ppt-templates')
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('ppt-templates')
      .getPublicUrl(path);

    return data.publicUrl;
  };

  return {
    templates,
    defaultTemplate,
    isLoading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    uploadTemplateFile,
  };
}
