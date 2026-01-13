import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CameraMountPoint {
  id: string;
  type: 'top' | 'side' | 'arm_end' | 'angled' | 'bracket';
  position: { x: number; y: number };
  rotation: number;
  description: string;
}

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
  // New fields for camera mounting
  camera_mount_points: CameraMountPoint[] | null;
  compatible_camera_mounts: string[] | null;
  camera_work_distance_range: { min: number; max: number } | null;
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
  camera_mount_points?: CameraMountPoint[] | null;
  compatible_camera_mounts?: string[] | null;
  camera_work_distance_range?: { min: number; max: number } | null;
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
  camera_mount_points?: CameraMountPoint[] | null;
  compatible_camera_mounts?: string[] | null;
  camera_work_distance_range?: { min: number; max: number } | null;
}

export function useMechanisms() {
  const [mechanisms, setMechanisms] = useState<Mechanism[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Helper to transform DB row to Mechanism type
  const transformMechanism = (row: any): Mechanism => ({
    ...row,
    camera_mount_points: row.camera_mount_points as CameraMountPoint[] | null,
    camera_work_distance_range: row.camera_work_distance_range as { min: number; max: number } | null,
    compatible_camera_mounts: row.compatible_camera_mounts as string[] | null,
  });

  const fetchMechanisms = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('mechanisms')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setMechanisms((data || []).map(transformMechanism));
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
    // Transform the mechanism to DB-compatible format
    const dbMechanism = {
      ...mechanism,
      camera_mount_points: mechanism.camera_mount_points as any,
      camera_work_distance_range: mechanism.camera_work_distance_range as any,
    };

    const { data, error } = await supabase
      .from('mechanisms')
      .insert(dbMechanism)
      .select()
      .single();

    if (error) throw error;
    const newMech = transformMechanism(data);
    setMechanisms(prev => [...prev, newMech]);
    return newMech;
  };

  const updateMechanism = async (id: string, updates: MechanismUpdate) => {
    // Transform the updates to DB-compatible format
    const dbUpdates = {
      ...updates,
      camera_mount_points: updates.camera_mount_points as any,
      camera_work_distance_range: updates.camera_work_distance_range as any,
    };

    const { data, error } = await supabase
      .from('mechanisms')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    const updatedMech = transformMechanism(data);
    setMechanisms(prev => prev.map(m => m.id === id ? updatedMech : m));
    return updatedMech;
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
