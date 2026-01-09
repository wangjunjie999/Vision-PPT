import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Mechanism {
  id: string;
  name: string;
  type: string;
  description: string | null;
  front_view_image_url: string | null;
  side_view_image_url: string | null;
  top_view_image_url: string | null;
  default_width: number | null;
  default_height: number | null;
  default_depth: number | null;
  notes: string | null;
  enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface MechanismInsert {
  name: string;
  type: string;
  description?: string | null;
  front_view_image_url?: string | null;
  side_view_image_url?: string | null;
  top_view_image_url?: string | null;
  default_width?: number | null;
  default_height?: number | null;
  default_depth?: number | null;
  notes?: string | null;
  enabled?: boolean;
}

export interface MechanismUpdate {
  name?: string;
  type?: string;
  description?: string | null;
  front_view_image_url?: string | null;
  side_view_image_url?: string | null;
  top_view_image_url?: string | null;
  default_width?: number | null;
  default_height?: number | null;
  default_depth?: number | null;
  notes?: string | null;
  enabled?: boolean;
}

export function useMechanisms() {
  const [mechanisms, setMechanisms] = useState<Mechanism[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMechanisms = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('mechanisms')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setMechanisms((data || []) as Mechanism[]);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch mechanisms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMechanisms();
  }, [fetchMechanisms]);

  const addMechanism = async (mechanism: MechanismInsert) => {
    const { data, error } = await supabase
      .from('mechanisms')
      .insert(mechanism)
      .select()
      .single();

    if (error) throw error;
    setMechanisms(prev => [...prev, data as Mechanism]);
    return data as Mechanism;
  };

  const updateMechanism = async (id: string, updates: MechanismUpdate) => {
    const { data, error } = await supabase
      .from('mechanisms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setMechanisms(prev => prev.map(m => m.id === id ? (data as Mechanism) : m));
    return data as Mechanism;
  };

  const deleteMechanism = async (id: string) => {
    const { error } = await supabase
      .from('mechanisms')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setMechanisms(prev => prev.filter(m => m.id !== id));
  };

  const getEnabledMechanisms = useCallback(() => {
    return mechanisms.filter(m => m.enabled !== false);
  }, [mechanisms]);

  return {
    mechanisms,
    loading,
    error,
    fetchMechanisms,
    addMechanism,
    updateMechanism,
    deleteMechanism,
    getEnabledMechanisms,
  };
}
