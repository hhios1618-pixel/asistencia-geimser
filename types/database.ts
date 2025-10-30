export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  asistencia: {
    Tables: {
      people: {
        Row: {
          id: string;
          rut: string | null;
          name: string;
          service: string | null;
          role: 'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER';
          is_active: boolean;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rut?: string | null;
          name: string;
          service?: string | null;
          role: 'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER';
          is_active?: boolean;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          rut?: string | null;
          name?: string;
          service?: string | null;
          role?: 'WORKER' | 'ADMIN' | 'SUPERVISOR' | 'DT_VIEWER';
          is_active?: boolean;
          email?: string | null;
          created_at?: string;
        };
      };
      sites: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          lat: number;
          lng: number;
          radius_m: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          lat: number;
          lng: number;
          radius_m: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          address?: string | null;
          lat?: number;
          lng?: number;
          radius_m?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      people_sites: {
        Row: {
          person_id: string;
          site_id: string;
          active: boolean;
          assigned_at: string;
        };
        Insert: {
          person_id: string;
          site_id: string;
          active?: boolean;
          assigned_at?: string;
        };
        Update: {
          active?: boolean;
          assigned_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          person_id: string | null;
          group_id: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          break_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          person_id?: string | null;
          group_id?: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          break_minutes?: number;
          created_at?: string;
        };
        Update: {
          person_id?: string | null;
          group_id?: string | null;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          break_minutes?: number;
          created_at?: string;
        };
      };
      attendance_marks: {
        Row: {
          id: string;
          person_id: string;
          site_id: string;
          event_type: 'IN' | 'OUT';
          event_ts: string;
          geo_lat: number | null;
          geo_lng: number | null;
          geo_acc: number | null;
          device_id: string | null;
          client_ts: string | null;
          note: string | null;
          hash_prev: string | null;
          hash_self: string;
          receipt_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          site_id: string;
          event_type: 'IN' | 'OUT';
          event_ts?: string;
          geo_lat?: number | null;
          geo_lng?: number | null;
          geo_acc?: number | null;
          device_id?: string | null;
          client_ts?: string | null;
          note?: string | null;
          hash_prev?: string | null;
          hash_self: string;
          receipt_url?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      attendance_modifications: {
        Row: {
          id: string;
          mark_id: string;
          requester_id: string;
          reason: string;
          requested_delta: string;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          resolver_id: string | null;
          resolved_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mark_id: string;
          requester_id: string;
          reason: string;
          requested_delta: string;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          resolver_id?: string | null;
          resolved_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          resolver_id?: string | null;
          resolved_at?: string | null;
          notes?: string | null;
        };
      };
      audit_events: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          ts: string;
          before: Json | null;
          after: Json | null;
          ip: string | null;
          user_agent: string | null;
          hash_chain: string | null;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          ts?: string;
          before?: Json | null;
          after?: Json | null;
          ip?: string | null;
          user_agent?: string | null;
          hash_chain?: string | null;
        };
        Update: never;
      };
      consent_logs: {
        Row: {
          id: string;
          person_id: string;
          consent_type: 'GEO' | 'PRIVACY';
          version: string;
          accepted_at: string;
          ip: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          person_id: string;
          consent_type: 'GEO' | 'PRIVACY';
          version: string;
          accepted_at?: string;
          ip?: string | null;
          user_agent?: string | null;
        };
        Update: never;
      };
      dt_access_tokens: {
        Row: {
          id: string;
          token_hash: string;
          scope: Json;
          expires_at: string;
          issued_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token_hash: string;
          scope: Json;
          expires_at: string;
          issued_by?: string | null;
          created_at?: string;
        };
        Update: never;
      };
      alerts: {
        Row: {
          id: string;
          person_id: string;
          kind: string;
          ts: string;
          resolved: boolean;
          resolved_at: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          person_id: string;
          kind: string;
          ts?: string;
          resolved?: boolean;
          resolved_at?: string | null;
          metadata?: Json | null;
        };
        Update: {
          resolved?: boolean;
          resolved_at?: string | null;
          metadata?: Json | null;
        };
      };
      settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          value?: Json;
          updated_at?: string;
        };
      };
      attendance_mark_hash_log: {
        Row: {
          mark_id: string;
          computed_at: string;
          hash_self: string;
          hash_prev: string | null;
        };
        Insert: {
          mark_id: string;
          computed_at?: string;
          hash_self: string;
          hash_prev?: string | null;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      fn_compute_mark_hash: {
        Args: { prev_hash: string | null; payload: Json };
        Returns: string;
      };
      fn_issue_dt_signed_link: {
        Args: { scope: Json; expires: string };
        Returns: string;
      };
      fn_validate_dt_token: {
        Args: { p_token: string; p_expires_epoch: number };
        Returns: Json;
      };
      fn_register_audit: {
        Args: {
          p_actor_id: string | null;
          p_action: string;
          p_entity: string;
          p_entity_id: string | null;
          p_before: Json;
          p_after: Json;
          p_ip: string | null;
          p_user_agent: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}

export type Tables = Database['asistencia']['Tables'];
export type TableRow<K extends keyof Tables> = Tables[K]['Row'];
export type TableInsert<K extends keyof Tables> = Tables[K]['Insert'];
export type TableUpdate<K extends keyof Tables> = Tables[K]['Update'];
