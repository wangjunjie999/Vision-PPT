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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          metadata: Json | null
          project_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          project_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
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
          aperture: string | null
          brand: string
          camera_dimension: string
          created_at: string
          enabled: boolean | null
          focal_length: string | null
          frame_rate: number
          front_view_url: string | null
          id: string
          image_url: string | null
          interface: string
          model: string
          model_3d_url: string | null
          name: string | null
          pixel_size_um: number | null
          profile_points: number | null
          reference_distance_mm: number | null
          resolution: string
          scan_frame_rate: number | null
          scan_mode: string
          scan_speed: string | null
          sensor_height_mm: number | null
          sensor_size: string
          sensor_width_mm: number | null
          shutter_type: string | null
          tags: string[] | null
          updated_at: string
          x_range: string | null
          z_range: string | null
        }
        Insert: {
          aperture?: string | null
          brand: string
          camera_dimension?: string
          created_at?: string
          enabled?: boolean | null
          focal_length?: string | null
          frame_rate: number
          front_view_url?: string | null
          id?: string
          image_url?: string | null
          interface: string
          model: string
          model_3d_url?: string | null
          name?: string | null
          pixel_size_um?: number | null
          profile_points?: number | null
          reference_distance_mm?: number | null
          resolution: string
          scan_frame_rate?: number | null
          scan_mode?: string
          scan_speed?: string | null
          sensor_height_mm?: number | null
          sensor_size: string
          sensor_width_mm?: number | null
          shutter_type?: string | null
          tags?: string[] | null
          updated_at?: string
          x_range?: string | null
          z_range?: string | null
        }
        Update: {
          aperture?: string | null
          brand?: string
          camera_dimension?: string
          created_at?: string
          enabled?: boolean | null
          focal_length?: string | null
          frame_rate?: number
          front_view_url?: string | null
          id?: string
          image_url?: string | null
          interface?: string
          model?: string
          model_3d_url?: string | null
          name?: string | null
          pixel_size_um?: number | null
          profile_points?: number | null
          reference_distance_mm?: number | null
          resolution?: string
          scan_frame_rate?: number | null
          scan_mode?: string
          scan_speed?: string | null
          sensor_height_mm?: number | null
          sensor_size?: string
          sensor_width_mm?: number | null
          shutter_type?: string | null
          tags?: string[] | null
          updated_at?: string
          x_range?: string | null
          z_range?: string | null
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          provider: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          provider?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          provider?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          lighting_photos: Json | null
          measurement_config: Json | null
          name: string
          ocr_config: Json | null
          output_types: string[] | null
          positioning_config: Json | null
          processing_time_limit: number | null
          roi_strategy: string | null
          rotation: number | null
          schematic_image_url: string | null
          schematic_layout: Json | null
          selected_camera: string | null
          selected_controller: string | null
          selected_lens: string | null
          selected_light: string | null
          sort_order: number | null
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
          lighting_photos?: Json | null
          measurement_config?: Json | null
          name: string
          ocr_config?: Json | null
          output_types?: string[] | null
          positioning_config?: Json | null
          processing_time_limit?: number | null
          roi_strategy?: string | null
          rotation?: number | null
          schematic_image_url?: string | null
          schematic_layout?: Json | null
          selected_camera?: string | null
          selected_controller?: string | null
          selected_lens?: string | null
          selected_light?: string | null
          sort_order?: number | null
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
          lighting_photos?: Json | null
          measurement_config?: Json | null
          name?: string
          ocr_config?: Json | null
          output_types?: string[] | null
          positioning_config?: Json | null
          processing_time_limit?: number | null
          roi_strategy?: string | null
          rotation?: number | null
          schematic_image_url?: string | null
          schematic_layout?: Json | null
          selected_camera?: string | null
          selected_controller?: string | null
          selected_lens?: string | null
          selected_light?: string | null
          sort_order?: number | null
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
      generated_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          format: string
          generation_method: string
          id: string
          metadata: Json | null
          page_count: number | null
          project_id: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          format?: string
          generation_method?: string
          id?: string
          metadata?: Json | null
          page_count?: number | null
          project_id: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          format?: string
          generation_method?: string
          id?: string
          metadata?: Json | null
          page_count?: number | null
          project_id?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lenses: {
        Row: {
          aperture: string
          brand: string
          compatible_cameras: string[] | null
          created_at: string
          enabled: boolean | null
          focal_length: string
          front_view_url: string | null
          id: string
          image_url: string | null
          max_sensor_size: string | null
          model: string
          mount: string
          resolving_power: number | null
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
          front_view_url?: string | null
          id?: string
          image_url?: string | null
          max_sensor_size?: string | null
          model: string
          mount: string
          resolving_power?: number | null
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
          front_view_url?: string | null
          id?: string
          image_url?: string | null
          max_sensor_size?: string | null
          model?: string
          mount?: string
          resolving_power?: number | null
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
          front_view_url: string | null
          id: string
          image_url: string | null
          model: string
          power: string
          recommended_cameras: string[] | null
          tags: string[] | null
          top_view_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          brand: string
          color: string
          created_at?: string
          enabled?: boolean | null
          front_view_url?: string | null
          id?: string
          image_url?: string | null
          model: string
          power: string
          recommended_cameras?: string[] | null
          tags?: string[] | null
          top_view_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          brand?: string
          color?: string
          created_at?: string
          enabled?: boolean | null
          front_view_url?: string | null
          id?: string
          image_url?: string | null
          model?: string
          power?: string
          recommended_cameras?: string[] | null
          tags?: string[] | null
          top_view_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      mechanical_layouts: {
        Row: {
          auxiliary_view: string | null
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
          isometric_view_image_url: string | null
          isometric_view_saved: boolean | null
          layout_description: string | null
          layout_objects: Json | null
          layout_type: string | null
          machine_outline: Json | null
          mechanisms: Json | null
          name: string
          primary_view: string | null
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
          auxiliary_view?: string | null
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
          isometric_view_image_url?: string | null
          isometric_view_saved?: boolean | null
          layout_description?: string | null
          layout_objects?: Json | null
          layout_type?: string | null
          machine_outline?: Json | null
          mechanisms?: Json | null
          name: string
          primary_view?: string | null
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
          auxiliary_view?: string | null
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
          isometric_view_image_url?: string | null
          isometric_view_saved?: boolean | null
          layout_description?: string | null
          layout_objects?: Json | null
          layout_type?: string | null
          machine_outline?: Json | null
          mechanisms?: Json | null
          name?: string
          primary_view?: string | null
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
          model_3d_url: string | null
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
          model_3d_url?: string | null
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
          model_3d_url?: string | null
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
          is_ppt_default: boolean
          media_id: string | null
          remark: string | null
          snapshot_url: string
          sort_order: number
          updated_at: string
          user_id: string
          version: number
          view_meta: Json | null
          workstation_id: string | null
        }
        Insert: {
          annotations_json?: Json
          asset_id: string
          created_at?: string
          id?: string
          is_ppt_default?: boolean
          media_id?: string | null
          remark?: string | null
          snapshot_url: string
          sort_order?: number
          updated_at?: string
          user_id: string
          version?: number
          view_meta?: Json | null
          workstation_id?: string | null
        }
        Update: {
          annotations_json?: Json
          asset_id?: string
          created_at?: string
          id?: string
          is_ppt_default?: boolean
          media_id?: string | null
          remark?: string | null
          snapshot_url?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          version?: number
          view_meta?: Json | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_annotations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "product_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_annotations_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "product_media"
            referencedColumns: ["id"]
          },
        ]
      }
      product_assets: {
        Row: {
          created_at: string
          detection_method: string | null
          detection_requirements: Json | null
          document_images_per_page: number
          height_mm: number | null
          id: string
          is_primary: boolean
          length_mm: number | null
          model_file_url: string | null
          module_id: string | null
          parent_product_id: string | null
          pos_x: number | null
          pos_y: number | null
          pos_z: number | null
          preview_images: Json | null
          product_code: string | null
          product_models: Json | null
          product_name: string | null
          product_spec: string | null
          scope_type: Database["public"]["Enums"]["product_scope_type"]
          sort_order: number
          source_type: string
          updated_at: string
          user_id: string
          width_mm: number | null
          workstation_id: string | null
        }
        Insert: {
          created_at?: string
          detection_method?: string | null
          detection_requirements?: Json | null
          document_images_per_page?: number
          height_mm?: number | null
          id?: string
          is_primary?: boolean
          length_mm?: number | null
          model_file_url?: string | null
          module_id?: string | null
          parent_product_id?: string | null
          pos_x?: number | null
          pos_y?: number | null
          pos_z?: number | null
          preview_images?: Json | null
          product_code?: string | null
          product_models?: Json | null
          product_name?: string | null
          product_spec?: string | null
          scope_type: Database["public"]["Enums"]["product_scope_type"]
          sort_order?: number
          source_type?: string
          updated_at?: string
          user_id: string
          width_mm?: number | null
          workstation_id?: string | null
        }
        Update: {
          created_at?: string
          detection_method?: string | null
          detection_requirements?: Json | null
          document_images_per_page?: number
          height_mm?: number | null
          id?: string
          is_primary?: boolean
          length_mm?: number | null
          model_file_url?: string | null
          module_id?: string | null
          parent_product_id?: string | null
          pos_x?: number | null
          pos_y?: number | null
          pos_z?: number | null
          preview_images?: Json | null
          product_code?: string | null
          product_models?: Json | null
          product_name?: string | null
          product_spec?: string | null
          scope_type?: Database["public"]["Enums"]["product_scope_type"]
          sort_order?: number
          source_type?: string
          updated_at?: string
          user_id?: string
          width_mm?: number | null
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
            foreignKeyName: "product_assets_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "product_assets"
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
      product_media: {
        Row: {
          asset_id: string
          created_at: string
          display_url: string | null
          file_name: string | null
          file_size: number | null
          id: string
          is_primary: boolean
          metadata: Json
          mime_type: string | null
          original_url: string
          sort_order: number
          updated_at: string
          user_id: string
          workstation_id: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          display_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          mime_type?: string | null
          original_url: string
          sort_order?: number
          updated_at?: string
          user_id: string
          workstation_id?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          display_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_primary?: boolean
          metadata?: Json
          mime_type?: string | null
          original_url?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "product_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          module_count: number | null
          name: string
          preview_image_url: string | null
          template_data: Json
          updated_at: string
          user_id: string
          workstation_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          module_count?: number | null
          name: string
          preview_image_url?: string | null
          template_data?: Json
          updated_at?: string
          user_id: string
          workstation_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          module_count?: number | null
          name?: string
          preview_image_url?: string | null
          template_data?: Json
          updated_at?: string
          user_id?: string
          workstation_count?: number | null
        }
        Relationships: []
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
          sort_order: number | null
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
          sort_order?: number | null
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
          sort_order?: number | null
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
          design_responsible: string | null
          enclosed: boolean | null
          environment_description: string | null
          id: string
          install_space: Json | null
          motion_description: string | null
          name: string
          notes: string | null
          observation_target: string | null
          process_stage: string | null
          product_dimensions: Json | null
          product_position: Json | null
          project_id: string
          risk_notes: string | null
          shot_count: number | null
          sort_order: number | null
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
          design_responsible?: string | null
          enclosed?: boolean | null
          environment_description?: string | null
          id?: string
          install_space?: Json | null
          motion_description?: string | null
          name: string
          notes?: string | null
          observation_target?: string | null
          process_stage?: string | null
          product_dimensions?: Json | null
          product_position?: Json | null
          project_id: string
          risk_notes?: string | null
          shot_count?: number | null
          sort_order?: number | null
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
          design_responsible?: string | null
          enclosed?: boolean | null
          environment_description?: string | null
          id?: string
          install_space?: Json | null
          motion_description?: string | null
          name?: string
          notes?: string | null
          observation_target?: string | null
          process_stage?: string | null
          product_dimensions?: Json | null
          product_position?: Json | null
          project_id?: string
          risk_notes?: string | null
          shot_count?: number | null
          sort_order?: number | null
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
      set_product_annotation_default: {
        Args: { p_annotation_id: string; p_asset_id: string }
        Returns: undefined
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
