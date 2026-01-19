import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface Camera {
  id: string;
  brand: string;
  model: string;
  resolution: string;
  frame_rate: number;
  interface: string;
  sensor_size: string;
  tags: string[];
  image_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lens {
  id: string;
  brand: string;
  model: string;
  focal_length: string;
  aperture: string;
  mount: string;
  compatible_cameras: string[];
  tags: string[];
  image_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Light {
  id: string;
  brand: string;
  model: string;
  type: string;
  color: string;
  power: string;
  tags: string[];
  recommended_cameras: string[];
  image_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Controller {
  id: string;
  brand: string;
  model: string;
  cpu: string;
  gpu: string | null;
  memory: string;
  storage: string;
  performance: string;
  tags: string[];
  image_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface HardwareContextType {
  cameras: Camera[];
  lenses: Lens[];
  lights: Light[];
  controllers: Controller[];
  loading: boolean;
  
  // Camera operations
  addCamera: (camera: Omit<Camera, 'id' | 'created_at' | 'updated_at'>) => Promise<Camera>;
  updateCamera: (id: string, updates: Partial<Camera>) => Promise<Camera>;
  deleteCamera: (id: string) => Promise<void>;
  
  // Lens operations
  addLens: (lens: Omit<Lens, 'id' | 'created_at' | 'updated_at'>) => Promise<Lens>;
  updateLens: (id: string, updates: Partial<Lens>) => Promise<Lens>;
  deleteLens: (id: string) => Promise<void>;
  
  // Light operations
  addLight: (light: Omit<Light, 'id' | 'created_at' | 'updated_at'>) => Promise<Light>;
  updateLight: (id: string, updates: Partial<Light>) => Promise<Light>;
  deleteLight: (id: string) => Promise<void>;
  
  // Controller operations
  addController: (controller: Omit<Controller, 'id' | 'created_at' | 'updated_at'>) => Promise<Controller>;
  updateController: (id: string, updates: Partial<Controller>) => Promise<Controller>;
  deleteController: (id: string) => Promise<void>;
  
  refetch: () => Promise<void>;
}

const HardwareContext = createContext<HardwareContextType | null>(null);

export function HardwareProvider({ children }: { children: React.ReactNode }) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [lights, setLights] = useState<Light[]>([]);
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all hardware data in a single batch with enhanced error handling
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching hardware data...');
      
      // 使用 Promise.allSettled 以便即使部分请求失败也能继续
      const [camerasResult, lensesResult, lightsResult, controllersResult] = await Promise.allSettled([
        supabase.from('cameras').select('*').order('brand', { ascending: true }),
        supabase.from('lenses').select('*').order('brand', { ascending: true }),
        supabase.from('lights').select('*').order('brand', { ascending: true }),
        supabase.from('controllers').select('*').order('brand', { ascending: true }),
      ]);

      const errorMessages: string[] = [];

      // 处理相机数据
      if (camerasResult.status === 'fulfilled') {
        const { data, error } = camerasResult.value;
        if (error) {
          console.error('相机数据加载失败:', error);
          errorMessages.push(`相机: ${error.message}`);
          setCameras([]);
        } else {
          console.log(`Loaded ${data?.length || 0} cameras`);
          setCameras(data || []);
        }
      } else {
        console.error('相机请求失败:', camerasResult.reason);
        errorMessages.push('相机: 请求失败');
        setCameras([]);
      }

      // 处理镜头数据
      if (lensesResult.status === 'fulfilled') {
        const { data, error } = lensesResult.value;
        if (error) {
          console.error('镜头数据加载失败:', error);
          errorMessages.push(`镜头: ${error.message}`);
          setLenses([]);
        } else {
          console.log(`Loaded ${data?.length || 0} lenses`);
          setLenses(data || []);
        }
      } else {
        console.error('镜头请求失败:', lensesResult.reason);
        errorMessages.push('镜头: 请求失败');
        setLenses([]);
      }

      // 处理光源数据
      if (lightsResult.status === 'fulfilled') {
        const { data, error } = lightsResult.value;
        if (error) {
          console.error('光源数据加载失败:', error);
          errorMessages.push(`光源: ${error.message}`);
          setLights([]);
        } else {
          console.log(`Loaded ${data?.length || 0} lights`);
          setLights(data || []);
        }
      } else {
        console.error('光源请求失败:', lightsResult.reason);
        errorMessages.push('光源: 请求失败');
        setLights([]);
      }

      // 处理控制器数据
      if (controllersResult.status === 'fulfilled') {
        const { data, error } = controllersResult.value;
        if (error) {
          console.error('控制器数据加载失败:', error);
          errorMessages.push(`控制器: ${error.message}`);
          setControllers([]);
        } else {
          console.log(`Loaded ${data?.length || 0} controllers`);
          setControllers(data || []);
        }
      } else {
        console.error('控制器请求失败:', controllersResult.reason);
        errorMessages.push('控制器: 请求失败');
        setControllers([]);
      }

      if (errorMessages.length > 0) {
        console.error('Hardware loading errors:', errorMessages);
        toast.error(`部分硬件数据加载失败: ${errorMessages.join(', ')}`);
      }
    } catch (err) {
      console.error('Failed to fetch hardware data:', err);
      toast.error('硬件数据加载失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Camera CRUD
  const addCamera = useCallback(async (camera: Omit<Camera, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('cameras').insert(camera).select().single();
    if (error) throw error;
    setCameras(prev => [...prev, data]);
    toast.success('相机添加成功');
    return data;
  }, []);

  const updateCamera = useCallback(async (id: string, updates: Partial<Camera>) => {
    const { data, error } = await supabase.from('cameras').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setCameras(prev => prev.map(c => c.id === id ? data : c));
    toast.success('相机更新成功');
    return data;
  }, []);

  const deleteCamera = useCallback(async (id: string) => {
    const { error } = await supabase.from('cameras').delete().eq('id', id);
    if (error) throw error;
    setCameras(prev => prev.filter(c => c.id !== id));
    toast.success('相机删除成功');
  }, []);

  // Lens CRUD
  const addLens = useCallback(async (lens: Omit<Lens, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('lenses').insert(lens).select().single();
    if (error) throw error;
    setLenses(prev => [...prev, data]);
    toast.success('镜头添加成功');
    return data;
  }, []);

  const updateLens = useCallback(async (id: string, updates: Partial<Lens>) => {
    const { data, error } = await supabase.from('lenses').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setLenses(prev => prev.map(l => l.id === id ? data : l));
    toast.success('镜头更新成功');
    return data;
  }, []);

  const deleteLens = useCallback(async (id: string) => {
    const { error } = await supabase.from('lenses').delete().eq('id', id);
    if (error) throw error;
    setLenses(prev => prev.filter(l => l.id !== id));
    toast.success('镜头删除成功');
  }, []);

  // Light CRUD
  const addLight = useCallback(async (light: Omit<Light, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('lights').insert(light).select().single();
    if (error) throw error;
    setLights(prev => [...prev, data]);
    toast.success('光源添加成功');
    return data;
  }, []);

  const updateLight = useCallback(async (id: string, updates: Partial<Light>) => {
    const { data, error } = await supabase.from('lights').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setLights(prev => prev.map(l => l.id === id ? data : l));
    toast.success('光源更新成功');
    return data;
  }, []);

  const deleteLight = useCallback(async (id: string) => {
    const { error } = await supabase.from('lights').delete().eq('id', id);
    if (error) throw error;
    setLights(prev => prev.filter(l => l.id !== id));
    toast.success('光源删除成功');
  }, []);

  // Controller CRUD
  const addController = useCallback(async (controller: Omit<Controller, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('controllers').insert(controller).select().single();
    if (error) throw error;
    setControllers(prev => [...prev, data]);
    toast.success('控制器添加成功');
    return data;
  }, []);

  const updateController = useCallback(async (id: string, updates: Partial<Controller>) => {
    const { data, error } = await supabase.from('controllers').update(updates).eq('id', id).select().single();
    if (error) throw error;
    setControllers(prev => prev.map(c => c.id === id ? data : c));
    toast.success('控制器更新成功');
    return data;
  }, []);

  const deleteController = useCallback(async (id: string) => {
    const { error } = await supabase.from('controllers').delete().eq('id', id);
    if (error) throw error;
    setControllers(prev => prev.filter(c => c.id !== id));
    toast.success('控制器删除成功');
  }, []);

  const value = useMemo(() => ({
    cameras,
    lenses,
    lights,
    controllers,
    loading,
    addCamera,
    updateCamera,
    deleteCamera,
    addLens,
    updateLens,
    deleteLens,
    addLight,
    updateLight,
    deleteLight,
    addController,
    updateController,
    deleteController,
    refetch: fetchAll,
  }), [
    cameras, lenses, lights, controllers, loading,
    addCamera, updateCamera, deleteCamera,
    addLens, updateLens, deleteLens,
    addLight, updateLight, deleteLight,
    addController, updateController, deleteController,
    fetchAll,
  ]);

  return (
    <HardwareContext.Provider value={value}>
      {children}
    </HardwareContext.Provider>
  );
}

export function useHardware() {
  const context = useContext(HardwareContext);
  if (!context) {
    throw new Error('useHardware must be used within a HardwareProvider');
  }
  return context;
}

// Convenience hooks for backwards compatibility
export function useCameras() {
  const { cameras, loading, addCamera, updateCamera, deleteCamera, refetch } = useHardware();
  return { cameras, loading, error: null, fetchCameras: refetch, addCamera, updateCamera, deleteCamera };
}

export function useLenses() {
  const { lenses, loading, addLens, updateLens, deleteLens, refetch } = useHardware();
  return { lenses, loading, error: null, fetchLenses: refetch, addLens, updateLens, deleteLens };
}

export function useLights() {
  const { lights, loading, addLight, updateLight, deleteLight, refetch } = useHardware();
  return { lights, loading, error: null, fetchLights: refetch, addLight, updateLight, deleteLight };
}

export function useControllers() {
  const { controllers, loading, addController, updateController, deleteController, refetch } = useHardware();
  return { controllers, loading, error: null, fetchControllers: refetch, addController, updateController, deleteController };
}

// Keep image upload utility
export function useHardwareImageUpload() {
  const uploadImage = async (file: File, type: 'cameras' | 'lenses' | 'lights' | 'controllers'): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('hardware-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('hardware-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  return { uploadImage };
}
