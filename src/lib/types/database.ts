export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_user_id: string
          email: string
          name: string
          username: string | null
          avatar_url: string | null
          default_timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          email: string
          name?: string
          username?: string | null
          avatar_url?: string | null
          default_timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          email?: string
          name?: string
          username?: string | null
          avatar_url?: string | null
          default_timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      event_types: {
        Row: {
          id: string
          user_id: string
          title: string
          slug: string
          description: string
          duration_minutes: number
          buffer_before_minutes: number
          buffer_after_minutes: number
          min_notice_minutes: number
          max_booking_days_ahead: number
          location_type: string
          location_value: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          slug: string
          description?: string
          duration_minutes: number
          buffer_before_minutes?: number
          buffer_after_minutes?: number
          min_notice_minutes?: number
          max_booking_days_ahead?: number
          location_type?: string
          location_value?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          slug?: string
          description?: string
          duration_minutes?: number
          buffer_before_minutes?: number
          buffer_after_minutes?: number
          min_notice_minutes?: number
          max_booking_days_ahead?: number
          location_type?: string
          location_value?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      availability_rules: {
        Row: {
          id: string
          user_id: string
          weekday: number
          start_time: string
          end_time: string
          timezone: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          weekday: number
          start_time: string
          end_time: string
          timezone: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          weekday?: number
          start_time?: string
          end_time?: string
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      availability_overrides: {
        Row: {
          id: string
          user_id: string
          date: string
          start_time: string | null
          end_time: string | null
          timezone: string
          is_available: boolean
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          start_time?: string | null
          end_time?: string | null
          timezone: string
          is_available?: boolean
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          start_time?: string | null
          end_time?: string | null
          timezone?: string
          is_available?: boolean
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      slot_holds: {
        Row: {
          id: string
          event_type_id: string
          host_user_id: string
          start_at: string
          end_at: string
          guest_email: string
          hold_token: string
          expires_at: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          event_type_id: string
          host_user_id: string
          start_at: string
          end_at: string
          guest_email: string
          hold_token?: string
          expires_at: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_type_id?: string
          host_user_id?: string
          start_at?: string
          end_at?: string
          guest_email?: string
          hold_token?: string
          expires_at?: string
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_holds_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_holds_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      bookings: {
        Row: {
          id: string
          event_type_id: string
          host_user_id: string
          guest_name: string
          guest_email: string
          guest_timezone: string
          notes: string
          start_at: string
          end_at: string
          status: string
          cancel_reason: string | null
          cancellation_token: string
          reschedule_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_type_id: string
          host_user_id: string
          guest_name: string
          guest_email: string
          guest_timezone: string
          notes?: string
          start_at: string
          end_at: string
          status?: string
          cancel_reason?: string | null
          cancellation_token?: string
          reschedule_token?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_type_id?: string
          host_user_id?: string
          guest_name?: string
          guest_email?: string
          guest_timezone?: string
          notes?: string
          start_at?: string
          end_at?: string
          status?: string
          cancel_reason?: string | null
          cancellation_token?: string
          reschedule_token?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      request_idempotency: {
        Row: {
          id: string
          scope: string
          idempotency_key: string
          request_hash: string
          status: string
          response_json: Json | null
          response_status: number | null
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scope: string
          idempotency_key: string
          request_hash: string
          status?: string
          response_json?: Json | null
          response_status?: number | null
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scope?: string
          idempotency_key?: string
          request_hash?: string
          status?: string
          response_json?: Json | null
          response_status?: number | null
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbox_events: {
        Row: {
          id: string
          org_id: string | null
          aggregate_type: string
          aggregate_id: string
          event_type: string
          payload: Json
          dedupe_key: string
          status: string
          available_at: string
          attempts: number
          last_error: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          aggregate_type: string
          aggregate_id: string
          event_type: string
          payload?: Json
          dedupe_key: string
          status?: string
          available_at?: string
          attempts?: number
          last_error?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          aggregate_type?: string
          aggregate_id?: string
          event_type?: string
          payload?: Json
          dedupe_key?: string
          status?: string
          available_at?: string
          attempts?: number
          last_error?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for convenience
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
