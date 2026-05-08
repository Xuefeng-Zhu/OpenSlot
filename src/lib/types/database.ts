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
      user_settings: {
        Row: {
          profile_id: string
          date_format: string
          time_format: string
          notify_new_booking: boolean
          notify_cancellation: boolean
          notify_reminder: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          date_format?: string
          time_format?: string
          notify_new_booking?: boolean
          notify_cancellation?: boolean
          notify_reminder?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          date_format?: string
          time_format?: string
          notify_new_booking?: boolean
          notify_cancellation?: boolean
          notify_reminder?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      provider_connections: {
        Row: {
          id: string
          profile_id: string
          provider: string
          account_email: string
          scopes: string[]
          access_token_encrypted: string | null
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          status: string
          metadata: Json
          connected_at: string
          last_synced_at: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          provider: string
          account_email: string
          scopes?: string[]
          access_token_encrypted?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          status?: string
          metadata?: Json
          connected_at?: string
          last_synced_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          provider?: string
          account_email?: string
          scopes?: string[]
          access_token_encrypted?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          status?: string
          metadata?: Json
          connected_at?: string
          last_synced_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      provider_calendars: {
        Row: {
          id: string
          connection_id: string
          external_calendar_id: string
          summary: string
          timezone: string | null
          is_primary: boolean
          use_for_availability: boolean
          use_for_writes: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          connection_id: string
          external_calendar_id: string
          summary?: string
          timezone?: string | null
          is_primary?: boolean
          use_for_availability?: boolean
          use_for_writes?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          connection_id?: string
          external_calendar_id?: string
          summary?: string
          timezone?: string | null
          is_primary?: boolean
          use_for_availability?: boolean
          use_for_writes?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_calendars_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "provider_connections"
            referencedColumns: ["id"]
          }
        ]
      }
      provider_watches: {
        Row: {
          id: string
          connection_id: string
          provider: string
          external_calendar_id: string
          channel_id: string | null
          resource_id: string | null
          sync_cursor: string | null
          expiration_at: string | null
          status: string
          last_sync_at: string | null
          last_error: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          connection_id: string
          provider: string
          external_calendar_id: string
          channel_id?: string | null
          resource_id?: string | null
          sync_cursor?: string | null
          expiration_at?: string | null
          status?: string
          last_sync_at?: string | null
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          connection_id?: string
          provider?: string
          external_calendar_id?: string
          channel_id?: string | null
          resource_id?: string | null
          sync_cursor?: string | null
          expiration_at?: string | null
          status?: string
          last_sync_at?: string | null
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_watches_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "provider_connections"
            referencedColumns: ["id"]
          }
        ]
      }
      external_busy_cache: {
        Row: {
          id: string
          provider_calendar_id: string
          source_event_id: string
          start_at: string
          end_at: string
          transparency: string
          etag: string | null
          last_synced_at: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_calendar_id: string
          source_event_id: string
          start_at: string
          end_at: string
          transparency?: string
          etag?: string | null
          last_synced_at?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_calendar_id?: string
          source_event_id?: string
          start_at?: string
          end_at?: string
          transparency?: string
          etag?: string | null
          last_synced_at?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_busy_cache_provider_calendar_id_fkey"
            columns: ["provider_calendar_id"]
            isOneToOne: false
            referencedRelation: "provider_calendars"
            referencedColumns: ["id"]
          }
        ]
      }
      calendar_event_refs: {
        Row: {
          id: string
          booking_id: string
          provider_calendar_id: string
          external_event_id: string
          provider_event_url: string | null
          status: string
          last_synced_at: string
          last_error: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          provider_calendar_id: string
          external_event_id: string
          provider_event_url?: string | null
          status?: string
          last_synced_at?: string
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          provider_calendar_id?: string
          external_event_id?: string
          provider_event_url?: string | null
          status?: string
          last_synced_at?: string
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_refs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_refs_provider_calendar_id_fkey"
            columns: ["provider_calendar_id"]
            isOneToOne: false
            referencedRelation: "provider_calendars"
            referencedColumns: ["id"]
          }
        ]
      }
      webhook_endpoints: {
        Row: {
          id: string
          profile_id: string
          url: string
          description: string
          subscribed_events: string[]
          secret_token: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          url: string
          description?: string
          subscribed_events?: string[]
          secret_token?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          url?: string
          description?: string
          subscribed_events?: string[]
          secret_token?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      webhook_deliveries: {
        Row: {
          id: string
          endpoint_id: string
          outbox_event_id: string | null
          event_type: string
          payload: Json
          attempt_no: number
          status: string
          next_attempt_at: string
          response_code: number | null
          response_body: string | null
          last_error: string | null
          delivered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          endpoint_id: string
          outbox_event_id?: string | null
          event_type: string
          payload?: Json
          attempt_no?: number
          status?: string
          next_attempt_at?: string
          response_code?: number | null
          response_body?: string | null
          last_error?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          endpoint_id?: string
          outbox_event_id?: string | null
          event_type?: string
          payload?: Json
          attempt_no?: number
          status?: string
          next_attempt_at?: string
          response_code?: number | null
          response_body?: string | null
          last_error?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_outbox_event_id_fkey"
            columns: ["outbox_event_id"]
            isOneToOne: false
            referencedRelation: "outbox_events"
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
      host_reservations: {
        Row: {
          id: string
          host_user_id: string
          source: string
          source_id: string
          start_at: string
          end_at: string
          status: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_user_id: string
          source: string
          source_id: string
          start_at: string
          end_at: string
          status?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_user_id?: string
          source?: string
          source_id?: string
          start_at?: string
          end_at?: string
          status?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_reservations_host_user_id_fkey"
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
          rescheduled_from_booking_id: string | null
          rescheduled_to_booking_id: string | null
          rescheduled_at: string | null
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
          rescheduled_from_booking_id?: string | null
          rescheduled_to_booking_id?: string | null
          rescheduled_at?: string | null
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
          rescheduled_from_booking_id?: string | null
          rescheduled_to_booking_id?: string | null
          rescheduled_at?: string | null
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
          },
          {
            foreignKeyName: "bookings_rescheduled_from_booking_id_fkey"
            columns: ["rescheduled_from_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rescheduled_to_booking_id_fkey"
            columns: ["rescheduled_to_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      booking_events: {
        Row: {
          id: string
          booking_id: string
          event_type: string
          actor_type: string
          actor_id: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          event_type: string
          actor_type?: string
          actor_id?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          event_type?: string
          actor_type?: string
          actor_id?: string | null
          payload?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
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
      create_slot_hold_with_reservation: {
        Args: {
          p_event_type_id: string
          p_host_user_id: string
          p_start_at: string
          p_end_at: string
          p_guest_email: string
          p_expires_at: string
        }
        Returns: {
          hold_id: string
          hold_token: string
          expires_at: string
        }[]
      }
      claim_outbox_events: {
        Args: {
          p_limit?: number
          p_max_attempts?: number
        }
        Returns: Database['public']['Tables']['outbox_events']['Row'][]
      }
      claim_webhook_deliveries: {
        Args: {
          p_limit?: number
          p_max_attempts?: number
        }
        Returns: Database['public']['Tables']['webhook_deliveries']['Row'][]
      }
      reschedule_booking_with_hold: {
        Args: {
          p_reschedule_token: string
          p_hold_token: string
          p_guest_name: string
          p_guest_email: string
          p_guest_timezone: string
          p_notes?: string
        }
        Returns: {
          old_booking_id: string
          new_booking_id: string
          event_type_id: string
          host_user_id: string
          start_at: string
          end_at: string
          previous_start_at: string
          previous_end_at: string
          cancellation_token: string
          reschedule_token: string
        }[]
      }
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
