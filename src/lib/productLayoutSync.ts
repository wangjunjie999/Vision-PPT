import type { Database } from '@/integrations/supabase/types';

export type WorkstationProductAsset = Database['public']['Tables']['product_assets']['Row'];
