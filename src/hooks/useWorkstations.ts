import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { sortByEntityOrder } from '@/utils/sortByCode';

type Workstation = Database['public']['Tables']['workstations']['Row'];
type WorkstationInsert = Database['public']['Tables']['workstations']['Insert'];
type WorkstationUpdate = Database['public']['Tables']['workstations']['Update'];

export function useWorkstations(projectId?: string) {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkstations = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('workstations')
        .select('*')
        .order('created_at', { ascending: true });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setError(null);
      setWorkstations(sortByEntityOrder(data || [], 'code'));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWorkstations();
  }, [fetchWorkstations]);

  const addWorkstation = async (workstation: Omit<WorkstationInsert, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('workstations')
      .insert(workstation)
      .select()
      .single();

    if (error) throw error;
    setWorkstations(prev => sortByEntityOrder([...prev, data], 'code'));
    return data;
  };

  const updateWorkstation = async (id: string, updates: WorkstationUpdate) => {
    const { data, error } = await supabase
      .from('workstations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setWorkstations(prev => sortByEntityOrder(prev.map(w => w.id === id ? data : w), 'code'));
    return data;
  };

  const deleteWorkstation = async (id: string) => {
    const { error } = await supabase
      .from('workstations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setWorkstations(prev => prev.filter(w => w.id !== id));
  };

  const duplicateWorkstation = async (id: string) => {
    const original = workstations.find(w => w.id === id);
    if (!original) throw new Error('Workstation not found');

    const { id: _, created_at, updated_at, ...rest } = original;
    const newWorkstation = {
      ...rest,
      code: `${original.code}-copy`,
      name: `${original.name} (副本)`,
    };

    return addWorkstation(newWorkstation);
  };

  return {
    workstations,
    loading,
    error,
    fetchWorkstations,
    addWorkstation,
    updateWorkstation,
    deleteWorkstation,
    duplicateWorkstation,
  };
}
