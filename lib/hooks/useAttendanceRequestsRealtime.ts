'use client';

import { useEffect, useRef } from 'react';
import type { SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '../supabase/client';

type AttendanceRequestRow = {
  id: string;
  requester_id: string;
  supervisor_id: string;
  status: string;
  request_type: string;
  created_at: string;
  decided_at: string | null;
};

type EventHandler = (payload: RealtimePostgresChangesPayload<AttendanceRequestRow>) => void;

interface Options {
  enabled?: boolean;
  onEvent: EventHandler;
}

export const useAttendanceRequestsRealtime = ({ enabled = true, onEvent }: Options): void => {
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (!clientRef.current) {
      clientRef.current = createBrowserSupabaseClient();
    }

    const client = clientRef.current;
    const channel = client
      .channel('attendance_requests_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'asistencia',
          table: 'attendance_requests',
        },
        (payload) => {
          onEvent(payload as RealtimePostgresChangesPayload<AttendanceRequestRow>);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [enabled, onEvent]);
};

