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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          content: string
          created_at: string
          end_position: number
          id: string
          parent_comment_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          script_id: string
          start_position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          end_position: number
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          script_id: string
          start_position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          end_position?: number
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          script_id?: string
          start_position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_filter: string | null
          created_at: string | null
          due_date: string | null
          eav_code: string
          id: string
          project_phase: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_filter?: string | null
          created_at?: string | null
          due_date?: string | null
          eav_code: string
          id: string
          project_phase?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_filter?: string | null
          created_at?: string | null
          due_date?: string | null
          eav_code?: string
          id?: string
          project_phase?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      script_components: {
        Row: {
          component_number: number
          content: string
          created_at: string | null
          id: string
          script_id: string | null
          word_count: number | null
        }
        Insert: {
          component_number: number
          content: string
          created_at?: string | null
          id?: string
          script_id?: string | null
          word_count?: number | null
        }
        Update: {
          component_number?: number
          content?: string
          created_at?: string | null
          id?: string
          script_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "script_components_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          component_count: number | null
          created_at: string | null
          id: string
          plain_text: string | null
          updated_at: string | null
          video_id: string | null
          yjs_state: string | null
        }
        Insert: {
          component_count?: number | null
          created_at?: string | null
          id?: string
          plain_text?: string | null
          updated_at?: string | null
          video_id?: string | null
          yjs_state?: string | null
        }
        Update: {
          component_count?: number | null
          created_at?: string | null
          id?: string
          plain_text?: string | null
          updated_at?: string | null
          video_id?: string | null
          yjs_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clients: {
        Row: {
          client_filter: string
          granted_at: string | null
          granted_by: string | null
          user_id: string
        }
        Insert: {
          client_filter: string
          granted_at?: string | null
          granted_by?: string | null
          user_id: string
        }
        Update: {
          client_filter?: string
          granted_at?: string | null
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string | null
          eav_code: string | null
          id: string
          main_stream_status: string | null
          production_type: string | null
          title: string
          updated_at: string | null
          vo_stream_status: string | null
        }
        Insert: {
          created_at?: string | null
          eav_code?: string | null
          id: string
          main_stream_status?: string | null
          production_type?: string | null
          title: string
          updated_at?: string | null
          vo_stream_status?: string | null
        }
        Update: {
          created_at?: string | null
          eav_code?: string | null
          id?: string
          main_stream_status?: string | null
          production_type?: string | null
          title?: string
          updated_at?: string | null
          vo_stream_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_eav_code_fkey"
            columns: ["eav_code"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["eav_code"]
          },
        ]
      }
    }
    Views: {
      available_clients: {
        Row: {
          name: string | null
        }
        Relationships: []
      }
      debug_user_access: {
        Row: {
          accessible_projects: number | null
          accessible_videos: number | null
          client_filters: string[] | null
          user_id: string | null
          user_role: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_client_access: {
        Args: Record<PropertyKey, never>
        Returns: {
          can_see_projects: boolean
          can_see_user_clients: boolean
          client_filters: string[]
          current_user_id: string
          current_user_role: string
        }[]
      }
      debug_client_access: {
        Args: { user_uuid: string }
        Returns: {
          client_filters: string[]
          matching_projects: Json
          user_role: string
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      save_script_with_components: {
        Args: {
          p_components: Json
          p_plain_text: string
          p_script_id: string
          p_yjs_state: string
        }
        Returns: {
          like: Database["public"]["Tables"]["scripts"]["Row"]
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
