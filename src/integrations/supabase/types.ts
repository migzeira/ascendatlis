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
      connected_account_secrets: {
        Row: {
          access_token_ct: string
          access_token_expires_at: string | null
          access_token_iv: string
          account_id: string
          refresh_token_ct: string | null
          refresh_token_iv: string | null
          updated_at: string
        }
        Insert: {
          access_token_ct: string
          access_token_expires_at?: string | null
          access_token_iv: string
          account_id: string
          refresh_token_ct?: string | null
          refresh_token_iv?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ct?: string
          access_token_expires_at?: string | null
          access_token_iv?: string
          account_id?: string
          refresh_token_ct?: string | null
          refresh_token_iv?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_account_secrets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          connected_at: string
          id: string
          last_synced_at: string | null
          needs_reauth: boolean
          nickname: string | null
          provider: string
          provider_user_id: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          last_synced_at?: string | null
          needs_reauth?: boolean
          nickname?: string | null
          provider: string
          provider_user_id: string
          user_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          last_synced_at?: string | null
          needs_reauth?: boolean
          nickname?: string | null
          provider?: string
          provider_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      index_snapshots: {
        Row: {
          breakdown: Json
          computed_at: string
          consistency_score: number
          evolution_score: number
          id: string
          is_calibrating: boolean
          matches_considered: number
          participation_score: number
          performance_score: number
          total_score: number
          user_id: string
        }
        Insert: {
          breakdown: Json
          computed_at?: string
          consistency_score: number
          evolution_score: number
          id?: string
          is_calibrating: boolean
          matches_considered: number
          participation_score: number
          performance_score: number
          total_score: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          computed_at?: string
          consistency_score?: number
          evolution_score?: number
          id?: string
          is_calibrating?: boolean
          matches_considered?: number
          participation_score?: number
          performance_score?: number
          total_score?: number
          user_id?: string
        }
        Relationships: []
      }
      match_stats: {
        Row: {
          adr: number
          assists: number
          created_at: string
          deaths: number
          headshot_pct: number
          headshots: number
          kd_ratio: number
          kills: number
          kr_ratio: number
          match_id: string
          mvps: number
          rating_approx: number
          rounds: number
          user_id: string
          won: boolean
        }
        Insert: {
          adr?: number
          assists?: number
          created_at?: string
          deaths?: number
          headshot_pct?: number
          headshots?: number
          kd_ratio?: number
          kills?: number
          kr_ratio?: number
          match_id: string
          mvps?: number
          rating_approx?: number
          rounds?: number
          user_id: string
          won?: boolean
        }
        Update: {
          adr?: number
          assists?: number
          created_at?: string
          deaths?: number
          headshot_pct?: number
          headshots?: number
          kd_ratio?: number
          kills?: number
          kr_ratio?: number
          match_id?: string
          mvps?: number
          rating_approx?: number
          rounds?: number
          user_id?: string
          won?: boolean
        }
        Relationships: []
      }
      matches: {
        Row: {
          competition_type: string | null
          created_at: string
          duration_seconds: number | null
          game: string
          id: string
          map: string | null
          match_id: string
          played_at: string
          provider: string
          raw: Json
          result: string
          rounds_lost: number | null
          rounds_won: number | null
          user_id: string
        }
        Insert: {
          competition_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          game: string
          id?: string
          map?: string | null
          match_id: string
          played_at: string
          provider: string
          raw: Json
          result: string
          rounds_lost?: number | null
          rounds_won?: number | null
          user_id: string
        }
        Update: {
          competition_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          game?: string
          id?: string
          map?: string | null
          match_id?: string
          played_at?: string
          provider?: string
          raw?: Json
          result?: string
          rounds_lost?: number | null
          rounds_won?: number | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at?: string
          provider: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_public: boolean
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_public?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_public?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          matches_synced: number
          provider: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          matches_synced?: number
          provider: string
          started_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          matches_synced?: number
          provider?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_profile_public: { Args: { p_id: string }; Returns: boolean }
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
