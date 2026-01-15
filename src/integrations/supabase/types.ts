export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      asset_registry: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          file_path: string
          file_size: number | null
          file_url: string
          id: string
          is_current: boolean
          metadata: Json | null
          mime_type: string | null
          original_name: string | null
          related_id: string
          related_type: string
          standard_name: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          file_path: string
          file_size?: number | null
          file_url: string
          id?: string
          is_current?: boolean
          metadata?: Json | null
          mime_type?: string | null
          original_name?: string | null
          related_id: string
          related_type: string
          standard_name: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          file_path?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_current?: boolean
          metadata?: Json | null
          mime_type?: string | null
          original_name?: string | null
          related_id?: string
          related_type?: string
          standard_name?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      cameras: {
        Row: {
          brand: string
          created_at: string
          enabled: boolean | null
          frame_rate: number
          id: string
          image_url: string | null
          interface: string
          model: string
          resolution: string
          sensor_size: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          enabled?: boolean | null
          frame_rate: number
          id?: string
          image_url?: string | null
          interface: string
          model: string
          resolution: string
          sensor_size: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          enabled?: boolean | null
          frame_rate?: number
          id?: string
          image_url?: string | null
          interface?: string
          model?: string
          resolution?: string
          sensor_size?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      controllers: {
        Row: {
          brand: string
          cpu: string
          created_at: string
          enabled: boolean | null
          gpu: string | null
          id: string
          image_url: string | null
          memory: string
          model: string
          performance: string
          storage: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          brand: string
          cpu: string
          created_at?: string
          enabled?: boolean | null
          gpu?: string | null
          id?: string
          image_url?: string | null
          memory: string
          model: string
          performance: string
          storage: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          brand?: string
          cpu?: string
          created_at?: string
          enabled?: boolean | null
          gpu?: string | null
          id?: string
          image_url?: string | null
          memory?: string
          model?: string
          performance?: string
          storage?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      function_modules: {
        Row: {
          camera_id: string | null
          controller_id: string | null
          created_at: string
          deep_learning_config: Json | null
          defect_config: Json | null
          description: string | null
          id: string
          lens_id: string | null
          light_id: string | null
          measurement_config: Json | null
          name: string
          ocr_config: Json | null
          output_types: string[] | null
          positioning_config: Json | null
          processing_time_limit: number | null
          roi_strategy: string | null
          rotation: number | null
          schematic_image_url: string | null
          selected_camera: string | null
          selected_controller: string | null
          selected_lens: string | null
          selected_light: string | null
          status: string | null
          trigger_type: string | null
          type: string | null
          updated_at: string
          user_id: string
          workstation_id: string
          x: number | null
          y: number | null
        }
        Insert: {
          camera_id?: string | null
          controller_id?: string | null
          created_at?: string
          deep_learning_config?: Json | null
          defect_config?: Json | null
          description?: string | null
          id?: string
          lens_id?: string | null
          light_id?: string | null
          measurement_config?: Json | null
          name: string
          ocr_config?: Json | null
          output_types?: string[] | null
          positioning_config?: Json | null
          processing_time_limit?: number | null
          roi_strategy?: string | null
          rotation?: number | null
          schematic_image_url?: string | null
          selected_camera?: string | null
          selected_controller?: string | null
          selected_lens?: string | null
          selected_light?: string | null
          status?: string | null
          trigger_type?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
          workstation_id: string
          x?: number | null
          y?: number | null
        }
        Update: {
          camera_id?: string | null
          controller_id?: string | null
          created_at?: string
          deep_learning_config?: Json | null
          defect_config?: Json | null
          description?: string | null
          id?: string
          lens_id?: string | null
          light_id?: string | null
          measurement_config?: Json | null
          name?: string
          ocr_config?: Json | null
          output_types?: string[] | null
          positioning_config?: Json | null
          processing_time_limit?: number | null
          roi_strategy?: string | null
          rotation?: number | null
          schematic_image_url?: string | null
          selected_camera?: string | null
          selected_controller?: string | null
          selected_lens?: string | null
          selected_light?: string | null
          status?: string | null
          trigger_type?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
          workstation_id?: string
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "function_modules_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      lenses: {
        Row: {
          aperture: string
          brand: string
          compatible_cameras: string[] | null
          created_at: string
          enabled: boolean | null
          focal_length: string
          id: string
          image_url: string | null
          model: string
          mount: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          aperture: string
          brand: string
          compatible_cameras?: string[] | null
          created_at?: string
          enabled?: boolean | null
          focal_length: string
          id?: string
          image_url?: string | null
          model: string
          mount: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          aperture?: string
          brand?: string
          compatible_cameras?: string[] | null
          created_at?: string
          enabled?: boolean | null
          focal_length?: string
          id?: string
          image_url?: string | null
          model?: string
          mount?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      lights: {
        Row: {
          brand: string
          color: string
          created_at: string
          enabled: boolean | null
          id: string
          image_url: string | null
          model: string
          power: string
          recommended_cameras: string[] | null
          tags: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          brand: string
          color: string
          created_at?: string
          enabled?: boolean | null
          id?: string
          image_url?: string | null
          model: string
          power: string
          recommended_cameras?: string[] | null
          tags?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          brand?: string
          color?: string
          created_at?: string
          enabled?: boolean | null
          id?: string
          image_url?: string | null
          model?: string
          power?: string
          recommended_cameras?: string[] | null
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      mechanical_layouts: {
        Row: {
          camera_count: number | null
          camera_mounts: Json | null
          conveyor_type: string | null
          created_at: string
          depth: number | null
          description: string | null
          front_view_image_url: string | null
          front_view_saved: boolean | null
          grid_enabled: boolean | null
          height: number | null
          id: string
          layout_objects: Json | null
          layout_type: string | null
          machine_outline: Json | null
          mechanisms: Json | null
          name: string
          selected_cameras: Json | null
          selected_controller: Json | null
          selected_lenses: Json | null
          selected_lights: Json | null
          show_distances: boolean | null
          side_view_image_url: string | null
          side_view_saved: boolean | null
          snap_enabled: boolean | null
          top_view_image_url: string | null
          top_view_saved: boolean | null
          updated_at: string
          user_id: string
          width: number | null
          workstation_id: string
        }
        Insert: {
          camera_count?: number | null
          camera_mounts?: Json | null
          conveyor_type?: string | null
          created_at?: string
          depth?: number | null
          description?: string | null
          front_view_image_url?: string | null
          front_view_saved?: boolean | null
          grid_enabled?: boolean | null
          height?: number | null
          id?: string
          layout_objects?: Json | null
          layout_type?: string | null
          machine_outline?: Json | null
          mechanisms?: Json | null
          name: string
          selected_cameras?: Json | null
          selected_controller?: Json | null
          selected_lenses?: Json | null
          selected_lights?: Json | null
          show_distances?: boolean | null
          side_view_image_url?: string | null
          side_view_saved?: boolean | null
          snap_enabled?: boolean | null
          top_view_image_url?: string | null
          top_view_saved?: boolean | null
          updated_at?: string
          user_id: string
          width?: number | null
          workstation_id: string
        }
        Update: {
          camera_count?: number | null
          camera_mounts?: Json | null
          conveyor_type?: string | null
          created_at?: string
          depth?: number | null
          description?: string | null
          front_view_image_url?: string | null
          front_view_saved?: boolean | null
          grid_enabled?: boolean | null
          height?: number | null
          id?: string
          layout_objects?: Json | null
          layout_type?: string | null
          machine_outline?: Json | null
          mechanisms?: Json | null
          name?: string
          selected_cameras?: Json | null
          selected_controller?: Json | null
          selected_lenses?: Json | null
          selected_lights?: Json | null
          show_distances?: boolean | null
          side_view_image_url?: string | null
          side_view_saved?: boolean | null
          snap_enabled?: boolean | null
          top_view_image_url?: string | null
          top_view_saved?: boolean | null
          updated_at?: string
          user_id?: string
          width?: number | null
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mechanical_layouts_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanisms: {
        Row: {
          camera_mount_points: Json | null
          camera_work_distance_range: Json | null
          compatible_camera_mounts: string[] | null
          created_at: string
          default_depth: number | null
          default_height: number | null
          default_width: number | null
          description: string | null
          enabled: boolean | null
          front_view_image_url: string | null
          id: string
          name: string
          notes: string | null
          side_view_image_url: string | null
          top_view_image_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          camera_mount_points?: Json | null
          camera_work_distance_range?: Json | null
          compatible_camera_mounts?: string[] | null
          created_at?: string
          default_depth?: number | null
          default_height?: number | null
          default_width?: number | null
          description?: string | null
          enabled?: boolean | null
          front_view_image_url?: string | null
          id?: string
          name: string
          notes?: string | null
          side_view_image_url?: string | null
          top_view_image_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          camera_mount_points?: Json | null
          camera_work_distance_range?: Json | null
          compatible_camera_mounts?: string[] | null
          created_at?: string
          default_depth?: number | null
          default_height?: number | null
          default_width?: number | null
          description?: string | null
          enabled?: boolean | null
          front_view_image_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          side_view_image_url?: string | null
          top_view_image_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ppt_templates: {
        Row: {
          background_image_url: string | null
          created_at: string
          description: string | null
          enabled: boolean | null
          file_url: string | null
          id: string
          is_default: boolean | null
          name: string
          scope: string | null
          structure_meta: Json | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          file_url?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          scope?: string | null
          structure_meta?: Json | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          background_image_url?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean | null
          file_url?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          scope?: string | null
          structure_meta?: Json | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      product_annotations: {
        Row: {
          annotations_json: Json
          asset_id: string
          created_at: string
          id: string
          remark: string | null
          snapshot_url: string
          user_id: string
          version: number
          view_meta: Json | null
        }
        Insert: {
          annotations_json?: Json
          asset_id: string
          created_at?: string
          id?: string
          remark?: string | null
          snapshot_url: string
          user_id: string
          version?: number
          view_meta?: Json | null
        }
        Update: {
          annotations_json?: Json
          asset_id?: string
          created_at?: string
          id?: string
          remark?: string | null
          snapshot_url?: string
          user_id?: string
          version?: number
          view_meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "product_annotations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "product_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      product_assets: {
        Row: {
          created_at: string
          detection_method: string | null
          detection_requirements: Json | null
          id: string
          model_file_url: string | null
          module_id: string | null
          preview_images: Json | null
          product_models: Json | null
          scope_type: Database["public"]["Enums"]["product_scope_type"]
          source_type: string
          updated_at: string
          user_id: string
          workstation_id: string | null
        }
        Insert: {
          created_at?: string
          detection_method?: string | null
          detection_requirements?: Json | null
          id?: string
          model_file_url?: string | null
          module_id?: string | null
          preview_images?: Json | null
          product_models?: Json | null
          scope_type: Database["public"]["Enums"]["product_scope_type"]
          source_type?: string
          updated_at?: string
          user_id: string
          workstation_id?: string | null
        }
        Update: {
          created_at?: string
          detection_method?: string | null
          detection_requirements?: Json | null
          id?: string
          model_file_url?: string | null
          module_id?: string | null
          preview_images?: Json | null
          product_models?: Json | null
          scope_type?: Database["public"]["Enums"]["product_scope_type"]
          source_type?: string
          updated_at?: string
          user_id?: string
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_assets_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "function_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_assets_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string | null
          created_at: string
          customer: string | null
          cycle_time_target: number | null
          date: string | null
          description: string | null
          environment: string | null
          id: string
          main_camera_brand: string | null
          name: string
          notes: string | null
          product_process: string | null
          production_line: string | null
          quality_strategy: string | null
          responsible: string | null
          revision_history: Json | null
          sales_responsible: string | null
          spec_version: string | null
          status: string | null
          template_id: string | null
          updated_at: string
          use_3d: boolean | null
          use_ai: boolean | null
          user_id: string
          vision_responsible: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          customer?: string | null
          cycle_time_target?: number | null
          date?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          main_camera_brand?: string | null
          name: string
          notes?: string | null
          product_process?: string | null
          production_line?: string | null
          quality_strategy?: string | null
          responsible?: string | null
          revision_history?: Json | null
          sales_responsible?: string | null
          spec_version?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string
          use_3d?: boolean | null
          use_ai?: boolean | null
          user_id: string
          vision_responsible?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          customer?: string | null
          cycle_time_target?: number | null
          date?: string | null
          description?: string | null
          environment?: string | null
          id?: string
          main_camera_brand?: string | null
          name?: string
          notes?: string | null
          product_process?: string | null
          production_line?: string | null
          quality_strategy?: string | null
          responsible?: string | null
          revision_history?: Json | null
          sales_responsible?: string | null
          spec_version?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string
          use_3d?: boolean | null
          use_ai?: boolean | null
          user_id?: string
          vision_responsible?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workstations: {
        Row: {
          acceptance_criteria: Json | null
          action_script: string | null
          code: string | null
          created_at: string
          cycle_time: number | null
          description: string | null
          enclosed: boolean | null
          id: string
          install_space: Json | null
          motion_description: string | null
          name: string
          observation_target: string | null
          process_stage: string | null
          product_dimensions: Json | null
          project_id: string
          risk_notes: string | null
          shot_count: number | null
          status: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acceptance_criteria?: Json | null
          action_script?: string | null
          code?: string | null
          created_at?: string
          cycle_time?: number | null
          description?: string | null
          enclosed?: boolean | null
          id?: string
          install_space?: Json | null
          motion_description?: string | null
          name: string
          observation_target?: string | null
          process_stage?: string | null
          product_dimensions?: Json | null
          project_id: string
          risk_notes?: string | null
          shot_count?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acceptance_criteria?: Json | null
          action_script?: string | null
          code?: string | null
          created_at?: string
          cycle_time?: number | null
          description?: string | null
          enclosed?: boolean | null
          id?: string
          install_space?: Json | null
          motion_description?: string | null
          name?: string
          observation_target?: string | null
          process_stage?: string | null
          product_dimensions?: Json | null
          project_id?: string
          risk_notes?: string | null
          shot_count?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      asset_type:
        | "workstation_product"
        | "module_annotation"
        | "layout_front_view"
        | "layout_side_view"
        | "layout_top_view"
        | "module_schematic"
        | "hardware_image"
        | "mechanism_view"
        | "ppt_template"
      product_scope_type: "workstation" | "module"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      asset_type: [
        "workstation_product",
        "module_annotation",
        "layout_front_view",
        "layout_side_view",
        "layout_top_view",
        "module_schematic",
        "hardware_image",
        "mechanism_view",
        "ppt_template",
      ],
      product_scope_type: ["workstation", "module"],
    },
  },
} as const
